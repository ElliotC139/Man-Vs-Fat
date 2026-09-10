/**
 * Checkout, the customer portal, and the webhook.
 *
 * The webhook is the important one. It is the only thing in the app that may
 * change what plan someone is on — not the checkout redirect, not a client
 * request, not the "success" page. A redirect is a URL anyone can visit, and
 * an app that hands out Pro because a browser arrived at /billing/done is an
 * app that gives itself away.
 */

import { Router, raw } from "express";
import type Stripe from "stripe";
import { prisma } from "../db";
import { config, stripeConfigured } from "../config";
import { requireAuth } from "../auth";
import { canSendMail, sendMail } from "../mailer";
import { recordError } from "../errorLog";
import { planFor } from "../plans";
import { REFERRAL_REWARD_CAP, REFERRAL_TRIAL_DAYS, rewardPence } from "../referrals";
import {
  endsAtOfSubscription,
  intervalForPriceId,
  planFromSubscription,
  priceIdFor,
  priceIdOfSubscription,
  purchasableIntervals,
  readPlanId,
  stripe,
} from "../billing";

/**
 * The authenticated half: checkout, the portal, and where you stand. Mounted
 * with the rest of the API, after the cookie parser.
 */
export const billingRouter = Router();

/**
 * The webhook, on its own router because it has to be mounted before
 * express.json() — and mustn't drag the authenticated routes in front of the
 * cookie parser with it. See src/server.ts.
 */
export const billingWebhookRouter = Router();

/**
 * The one currency referral rewards are denominated in.
 *
 * src/plans.ts states every price in pence, and the reward is capped against
 * the payment that funds it, so both sides of that comparison have to be the
 * same money. See applyReferralReward.
 */
const REWARD_CURRENCY = "gbp";

/** What the settings screen needs to know before it offers anything. */
billingRouter.get("/status", requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.userId! },
    select: {
      plan: true,
      subscriptionStatus: true,
      subscriptionEndsAt: true,
      subscriptionInterval: true,
      stripeCustomerId: true,
    },
  });

  res.json({
    configured: stripeConfigured,
    purchasable: purchasableIntervals(),
    plan: user?.plan ?? "free",
    status: user?.subscriptionStatus ?? null,
    endsAt: user?.subscriptionEndsAt ?? null,
    // Null for a free account, and for anyone who subscribed before this was
    // recorded. The card falls back to the plan's monthly price rather than
    // inventing one.
    interval: user?.subscriptionInterval ?? null,
    // Whether there is anything for the portal to manage. A customer who has
    // never checked out has no billing to look at, and a button that opens an
    // empty portal is worse than no button.
    canManage: Boolean(user?.stripeCustomerId),
  });
});

/**
 * Starts a checkout.
 *
 * Creates the Stripe customer on first use and stores the id, so a second
 * subscription doesn't produce a second customer with half the history.
 */
billingRouter.post("/checkout", requireAuth, async (req, res) => {
  const client = stripe();
  if (!client) {
    res.status(503).json({ error: "Payments aren't set up on this server yet." });
    return;
  }

  const plan = readPlanId(req.body?.plan);
  const interval = req.body?.interval === "yearly" ? "yearly" : "monthly";
  if (!plan) {
    res.status(400).json({ error: "Pick a plan to subscribe to." });
    return;
  }
  const price = priceIdFor(plan, interval);
  if (!price) {
    res.status(400).json({ error: "That plan isn't available at the moment." });
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: req.userId! },
    select: {
      id: true,
      username: true,
      email: true,
      stripeCustomerId: true,
      referredById: true,
      referralTrialUsed: true,
    },
  });
  if (!user) {
    res.status(401).json({ error: "Not signed in" });
    return;
  }

  try {
    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await client.customers.create({
        email: user.email ?? undefined,
        // So a Stripe dashboard row can be traced back to an account without
        // a lookup, which matters when a payment needs chasing.
        metadata: { userId: String(user.id), username: user.username },
      });
      customerId = customer.id;
      await prisma.user.update({ where: { id: user.id }, data: { stripeCustomerId: customerId } });
    }

    // The free month someone was invited with. Granted by Stripe rather than
    // by this app, which is what puts a card on file before it starts — see
    // src/referrals.ts for why that is the property the whole scheme rests on.
    // Offered once: a cancel-and-resubscribe doesn't earn a second one.
    const trialDays = user.referredById && !user.referralTrialUsed ? REFERRAL_TRIAL_DAYS : null;

    const session = await client.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price, quantity: 1 }],
      success_url: `${config.APP_BASE_URL}/?billing=done`,
      cancel_url: `${config.APP_BASE_URL}/?billing=cancelled`,
      // Carried so the webhook can find the account even if the customer
      // record is somehow not the one on file.
      client_reference_id: String(user.id),
      subscription_data: {
        metadata: { userId: String(user.id) },
        ...(trialDays ? { trial_period_days: trialDays } : {}),
      },
      allow_promotion_codes: true,
      // VAT. The prices in Stripe are configured tax-inclusive, so £4.99 is
      // what someone pays and the VAT is carved out of it rather than added
      // at the last step — see src/plans.ts for what that leaves.
      //
      // Stripe is the merchant of record here (Managed Payments), so it works
      // the VAT out, collects it and remits it, from the first payment.
      //
      // Two things this needs that aren't obvious, both of which fail as a
      // dead checkout button rather than as anything visible in a log:
      //
      //   - An address, which is how Stripe decides the rate, plus permission
      //     to write it back onto an existing customer. That is what
      //     customer_update is for; combining `customer` with `automatic_tax`
      //     without it is a hard error.
      //   - A product tax code on every Stripe Product, which Managed Payments
      //     requires. It lives in the dashboard, not here, so a Product added
      //     later without one breaks checkout for that plan alone. If this
      //     ever starts refusing with "the product tax code is missing", that
      //     is where to look.
      automatic_tax: { enabled: true },
      billing_address_collection: "required",
      customer_update: { address: "auto", name: "auto" },
    });

    res.json({ url: session.url });
  } catch (error) {
    void recordError("billing:checkout", error);
    res.status(502).json({ error: "Couldn't start checkout — please try again." });
  }
});

/** A link into Stripe's own portal, which is where cancelling happens. */
billingRouter.post("/portal", requireAuth, async (req, res) => {
  const client = stripe();
  if (!client) {
    res.status(503).json({ error: "Payments aren't set up on this server yet." });
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: req.userId! },
    select: { stripeCustomerId: true },
  });
  if (!user?.stripeCustomerId) {
    res.status(400).json({ error: "There's no subscription on this account yet." });
    return;
  }

  try {
    const session = await client.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${config.APP_BASE_URL}/`,
    });
    res.json({ url: session.url });
  } catch (error) {
    void recordError("billing:portal", error);
    res.status(502).json({ error: "Couldn't open the billing page — please try again." });
  }
});

/**
 * Stripe's callbacks. The only thing that changes a plan.
 *
 * Mounted with a raw body parser because the signature is over the exact
 * bytes Stripe sent — a JSON round trip re-orders keys and the check fails.
 * See src/server.ts, where this route is mounted before express.json().
 *
 * Unsigned or badly signed requests are refused outright. An unverified
 * webhook is an unauthenticated request that hands out paid plans.
 */
billingWebhookRouter.post("/webhook", raw({ type: "application/json" }), async (req, res) => {
  const client = stripe();
  if (!client || !config.STRIPE_WEBHOOK_SECRET) {
    res.status(503).json({ error: "Payments aren't set up on this server yet." });
    return;
  }

  const signature = req.headers["stripe-signature"];
  if (typeof signature !== "string") {
    res.status(400).json({ error: "Missing signature" });
    return;
  }

  let event: Stripe.Event;
  try {
    event = client.webhooks.constructEvent(req.body as Buffer, signature, config.STRIPE_WEBHOOK_SECRET);
  } catch (error) {
    // Not recorded as an app error: a bad signature is far more likely to be
    // someone poking the endpoint than a fault worth waking anyone for.
    console.warn("Rejected a Stripe webhook with a bad signature:", error);
    res.status(400).json({ error: "Bad signature" });
    return;
  }

  try {
    await applyEvent(event);
  } catch (error) {
    // Answered with a 500 on purpose, so Stripe retries. Swallowing it would
    // mean a subscription change that never reached the account, with nothing
    // left to notice it.
    void recordError("billing:webhook", error);
    res.status(500).json({ error: "Couldn't apply that event." });
    return;
  }

  res.json({ received: true });
});

/**
 * Applies one event.
 *
 * Only subscription events matter. A checkout that completed without one is
 * ignored: the subscription event follows, and acting on the checkout as well
 * would mean two writes racing to say the same thing.
 */
async function applyEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      await applySubscription(event.data.object as Stripe.Subscription);
      return;
    case "invoice.payment_succeeded":
      await applyReferralReward(event.data.object as Stripe.Invoice);
      return;
    case "invoice.payment_failed":
      await warnAboutFailedPayment(event.data.object as Stripe.Invoice);
      return;
    default:
      return;
  }
}

/**
 * The subscription as Stripe holds it *now*, not as this event describes it.
 *
 * Webhook delivery is not ordered. A `subscription.updated` that was delayed
 * in the network can arrive after the `subscription.deleted` that followed
 * it, and acting on each payload in the order they turn up would then
 * resurrect a cancelled plan — the app would hand back access to somebody who
 * had cancelled, and nothing would ever correct it because no further event
 * is coming.
 *
 * Re-reading makes the handler idempotent and order-independent: whichever
 * event arrives, and however late, the answer written is the current truth.
 * The event becomes a nudge to go and look rather than the thing believed.
 *
 * A failed read throws, which answers the webhook with a 500 and brings
 * Stripe back — better than applying a payload that may be stale.
 */
async function currentSubscription(subscription: Stripe.Subscription): Promise<Stripe.Subscription> {
  const client = stripe();
  if (!client) return subscription;
  return client.subscriptions.retrieve(subscription.id);
}

/**
 * Tells someone their payment didn't go through, once.
 *
 * Without this a dead card is discovered only when Stripe finally gives up
 * days later and the plan lapses — by which point the app has silently
 * downgraded somebody who would have fixed it in thirty seconds had anyone
 * mentioned it.
 *
 * Only on the first attempt. Stripe retries a failed invoice several times
 * over about two weeks and every retry fires this event; mailing on each one
 * turns a helpful nudge into a fortnight of nagging about the same card.
 *
 * Never throws. A subscription's billing state must not depend on whether an
 * email could be sent, and this is the courtesy rather than the mechanism —
 * Stripe's own dunning still runs either way.
 */
async function warnAboutFailedPayment(invoice: Stripe.Invoice): Promise<void> {
  try {
    if ((invoice.attempt_count ?? 1) > 1) return;
    if (!canSendMail()) return;

    const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
    if (!customerId) return;

    const user = await prisma.user.findFirst({
      where: { stripeCustomerId: customerId },
      select: { username: true, email: true },
    });
    // No address on file is normal: an account can be created with a username
    // and password alone.
    if (!user?.email) return;

    await sendMail({
      to: user.email,
      subject: "Your QuicKcals payment didn't go through",
      text: `Hello ${user.username},\n\nThe card on your QuicKcals subscription was declined, so this month's payment hasn't gone through.\n\nNothing has changed yet — your plan keeps working while your bank and Stripe retry over the next few days. If it keeps failing the plan will drop back to Free, and your diary stays exactly as it is either way.\n\nTo update your card, open QuicKcals, go to Settings, and choose "Manage subscription".\n\n${config.APP_BASE_URL}\n`,
    });
  } catch (error) {
    void recordError("billing:payment-failed-notice", error);
  }
}

async function applySubscription(event: Stripe.Subscription): Promise<void> {
  // Read it back from Stripe rather than trusting the payload — see
  // currentSubscription for why the order events arrive in cannot be relied on.
  const subscription = await currentSubscription(event);

  const customerId = typeof subscription.customer === "string"
    ? subscription.customer
    : subscription.customer?.id;

  // Matched on the customer first, then on the id carried through checkout.
  // Both, because a customer created outside this app — someone re-subscribed
  // from the Stripe dashboard — has no row here to match on yet.
  const metadataUserId = Number(subscription.metadata?.userId);
  const user = customerId
    ? await prisma.user.findFirst({
        where: { OR: [{ stripeCustomerId: customerId }, ...(metadataUserId ? [{ id: metadataUserId }] : [])] },
        select: { id: true },
      })
    : null;

  if (!user) {
    console.warn(`Stripe subscription ${subscription.id} matched no account; ignoring.`);
    return;
  }

  const endsAt = endsAtOfSubscription(subscription);
  const priceId = priceIdOfSubscription(subscription);
  const plan = planFromSubscription({ status: subscription.status, priceId, endsAt });

  await prisma.user.update({
    where: { id: user.id },
    data: {
      plan,
      stripeCustomerId: customerId ?? undefined,
      stripeSubscriptionId: subscription.id,
      subscriptionStatus: subscription.status,
      subscriptionEndsAt: endsAt,
      subscriptionInterval: intervalForPriceId(priceId),
      // Their invited free month has started, so it is spent. Recorded here
      // rather than at checkout because a checkout somebody abandoned should
      // not cost them the offer.
      ...(subscription.trial_end ? { referralTrialUsed: true } : {}),
    },
  });
}

/**
 * Pays the person who invited this customer, once, when money actually
 * arrives.
 *
 * Every guard here is load-bearing:
 *
 *   - **amount_paid > 0.** The invoice that opens a referred subscription is
 *     for nothing, because the first month is free. Paying out on it would
 *     make the free month the trigger, which is the exact thing this scheme
 *     is built not to do.
 *   - **referralRewardedAt claimed before the credit is issued.** Stripe
 *     retries webhooks, and a reward paid twice is a reward that can be made
 *     to pay indefinitely by failing on purpose. The claim is a conditional
 *     update, so only one attempt can win it; if the credit then fails, the
 *     claim is released and the 500 that follows brings Stripe back.
 *   - **capped at what was paid.** See rewardPence in src/referrals.ts. The
 *     credit can never exceed the payment that funds it.
 */
async function applyReferralReward(invoice: Stripe.Invoice): Promise<void> {
  const paid = invoice.amount_paid ?? 0;
  if (paid <= 0) return;

  // amount_paid is in the invoice's own currency and smallest unit, and it is
  // compared below against plan prices in GBP pence. That comparison is what
  // caps the reward at the payment funding it, so a currency mismatch would
  // not merely mis-state a figure — it would break the guarantee the whole
  // scheme rests on. 5,000 JPY against a 499p cap reads as "plenty", and the
  // credit would be issued in a currency the customer's balance is not in.
  //
  // Every price this deployment sells is in GBP, so this refuses something
  // that cannot currently happen. It is here so that adding a second currency
  // is a decision somebody makes on purpose rather than a silent change to
  // what a referral pays.
  if (invoice.currency && invoice.currency.toLowerCase() !== REWARD_CURRENCY) {
    console.warn(
      `Referral reward skipped: invoice ${invoice.id} is in ${invoice.currency}, not ${REWARD_CURRENCY}.`,
    );
    return;
  }

  const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
  if (!customerId) return;

  const payer = await prisma.user.findFirst({
    where: { stripeCustomerId: customerId },
    select: { id: true, referredById: true, referralRewardedAt: true },
  });
  if (!payer?.referredById || payer.referralRewardedAt) return;

  const referrer = await prisma.user.findUnique({
    where: { id: payer.referredById },
    select: { id: true, username: true, email: true, plan: true, stripeCustomerId: true },
  });
  if (!referrer) return;

  // The cap is a liability limit, not an arithmetic one — see src/referrals.ts.
  // Past it the invite still worked and still converted; it just doesn't pay.
  const alreadyRewarded = await prisma.user.count({
    where: { referredById: referrer.id, referralRewardedAt: { not: null } },
  });
  if (alreadyRewarded >= REFERRAL_REWARD_CAP) return;

  const pence = rewardPence({
    referrerPlanPence: planFor(referrer.plan).pricePence,
    fallbackPence: planFor("plus").pricePence,
    paidPence: paid,
  });
  if (pence <= 0) return;

  // Claim it first. Only one webhook delivery can turn this row from null.
  const claimed = await prisma.user.updateMany({
    where: { id: payer.id, referralRewardedAt: null },
    data: { referralRewardedAt: new Date() },
  });
  if (claimed.count !== 1) return;

  try {
    await creditReferrer(referrer, pence, REWARD_CURRENCY);
  } catch (error) {
    // Hand the claim back so the retry can try again, then let the caller
    // answer 500 so there is a retry to hand it to.
    await prisma.user.updateMany({ where: { id: payer.id }, data: { referralRewardedAt: null } });
    throw error;
  }
}

/**
 * Puts the reward on the referrer's Stripe customer as credit.
 *
 * Credit rather than a month granted in this app's own database because it
 * survives a plan change and works for a referrer who hasn't subscribed yet —
 * which is why the customer is created here if there isn't one. It then sits
 * on their record and eats their first invoice whenever they do subscribe,
 * which turns "a friend paid" into a reason for the referrer to upgrade too.
 *
 * A negative amount is a credit in Stripe's sign convention.
 */
async function creditReferrer(
  referrer: { id: number; username: string; email: string | null; stripeCustomerId: string | null },
  pence: number,
  currency: string,
): Promise<void> {
  const client = stripe();
  if (!client) return;

  let customerId = referrer.stripeCustomerId;
  if (!customerId) {
    const customer = await client.customers.create({
      email: referrer.email ?? undefined,
      metadata: { userId: String(referrer.id), username: referrer.username },
    });
    customerId = customer.id;
    await prisma.user.update({ where: { id: referrer.id }, data: { stripeCustomerId: customerId } });
  }

  await client.customers.createBalanceTransaction(customerId, {
    amount: -pence,
    currency,
    description: "QuicKcals referral reward",
  });
}
