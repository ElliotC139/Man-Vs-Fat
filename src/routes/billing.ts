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
import { recordError } from "../errorLog";
import {
  endsAtOfSubscription,
  planFromSubscription,
  priceIdFor,
  priceIdOfSubscription,
  purchasablePlans,
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

/** What the settings screen needs to know before it offers anything. */
billingRouter.get("/status", requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.userId! },
    select: { plan: true, subscriptionStatus: true, subscriptionEndsAt: true, stripeCustomerId: true },
  });

  res.json({
    configured: stripeConfigured,
    purchasable: purchasablePlans(),
    plan: user?.plan ?? "free",
    status: user?.subscriptionStatus ?? null,
    endsAt: user?.subscriptionEndsAt ?? null,
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
    select: { id: true, username: true, email: true, stripeCustomerId: true },
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

    const session = await client.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price, quantity: 1 }],
      success_url: `${config.APP_BASE_URL}/?billing=done`,
      cancel_url: `${config.APP_BASE_URL}/?billing=cancelled`,
      // Carried so the webhook can find the account even if the customer
      // record is somehow not the one on file.
      client_reference_id: String(user.id),
      subscription_data: { metadata: { userId: String(user.id) } },
      allow_promotion_codes: true,
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
    default:
      return;
  }
}

async function applySubscription(subscription: Stripe.Subscription): Promise<void> {
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
  const plan = planFromSubscription({
    status: subscription.status,
    priceId: priceIdOfSubscription(subscription),
    endsAt,
  });

  await prisma.user.update({
    where: { id: user.id },
    data: {
      plan,
      stripeCustomerId: customerId ?? undefined,
      stripeSubscriptionId: subscription.id,
      subscriptionStatus: subscription.status,
      subscriptionEndsAt: endsAt,
    },
  });
}
