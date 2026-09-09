/**
 * Taking money, and knowing when it stopped arriving.
 *
 * The plan catalogue (src/plans.ts) says what each tier costs and includes.
 * Stripe holds the thing that actually gets charged. This is the join between
 * them, and it is deliberately thin: the app's own idea of who is on what
 * lives in the `plan` column, and Stripe's job is only to tell it when that
 * should change.
 *
 * Two rules run through the whole file:
 *
 *   - **Stripe is the authority on payment, never on entitlement.** Nothing
 *     here reads a plan out of a checkout redirect or a client request. A plan
 *     changes when a signed webhook says the subscription changed, and at no
 *     other time. A redirect is a URL anyone can visit.
 *
 *   - **Failing to bill is not the same as failing to work.** With no keys
 *     configured the whole surface reports itself off and the app runs as a
 *     free one, the same way it does without WHOOP or Nutritionix. A
 *     deployment with no card processor should still be a working diary.
 */

import Stripe from "stripe";
import { config, stripeConfigured } from "./config";
import { isPlanId, planFor, type PlanId } from "./plans";

export type BillingInterval = "monthly" | "yearly";

let client: Stripe | null = null;

/** The Stripe client, or null where billing isn't configured. */
export function stripe(): Stripe | null {
  if (!stripeConfigured) return null;
  client ??= new Stripe(config.STRIPE_SECRET_KEY!);
  return client;
}

/**
 * The Stripe price for a plan and interval, or null.
 *
 * Null means this deployment hasn't been given a price for that combination,
 * which is a perfectly normal state — a yearly price may simply not exist
 * yet — and the plan is then not offered at that interval rather than
 * offered and broken.
 */
export function priceIdFor(plan: PlanId, interval: BillingInterval): string | null {
  const ids: Record<string, string | undefined> = {
    "plus:monthly": config.STRIPE_PRICE_PLUS_MONTHLY,
    "plus:yearly": config.STRIPE_PRICE_PLUS_YEARLY,
    "pro:monthly": config.STRIPE_PRICE_PRO_MONTHLY,
    "pro:yearly": config.STRIPE_PRICE_PRO_YEARLY,
  };
  return ids[`${plan}:${interval}`] ?? null;
}

/** Which plans this deployment can actually sell right now. */
export function purchasablePlans(): PlanId[] {
  if (!stripeConfigured) return [];
  return (["plus", "pro"] as const).filter(
    (id) => priceIdFor(id, "monthly") !== null || priceIdFor(id, "yearly") !== null,
  );
}

/**
 * Which plan a Stripe price belongs to.
 *
 * The reverse of priceIdFor, and the only way a webhook is allowed to decide
 * what someone is entitled to: the subscription names a price, and the price
 * names a plan. Anything unrecognised returns null and the webhook leaves the
 * plan alone rather than guessing.
 */
export function planForPriceId(priceId: string | null | undefined): PlanId | null {
  if (!priceId) return null;
  for (const id of ["plus", "pro"] as const) {
    for (const interval of ["monthly", "yearly"] as const) {
      if (priceIdFor(id, interval) === priceId) return id;
    }
  }
  return null;
}

/**
 * The statuses that mean someone is paid up.
 *
 * "trialing" counts: a trial is a promise the app has made and should keep.
 * "past_due" also counts, deliberately — Stripe retries a failed card for
 * days, and switching someone off the moment a renewal bounces punishes them
 * for a bank's fraud check. It becomes "canceled" or "unpaid" when Stripe
 * gives up, and those don't count.
 */
const PAID_STATUSES = new Set(["active", "trialing", "past_due"]);

export function statusEntitles(status: string | null | undefined): boolean {
  return typeof status === "string" && PAID_STATUSES.has(status);
}

/**
 * The plan an account should be on, given what Stripe last said.
 *
 * Kept as a pure function so the rule is testable without a Stripe account:
 * a paid status on a recognised price entitles that plan, and everything
 * else falls back to free.
 */
export function planFromSubscription(input: {
  status: string | null | undefined;
  priceId: string | null | undefined;
  endsAt?: Date | null;
  now?: Date;
}): PlanId {
  const plan = planForPriceId(input.priceId);
  if (!plan) return "free";
  if (statusEntitles(input.status)) return plan;

  // Cancelled, but the period they paid for hasn't run out. They keep it
  // until it does — that is what they bought.
  if (input.endsAt && input.endsAt.getTime() > (input.now ?? new Date()).getTime()) return plan;

  return "free";
}

/** The price a subscription is actually on, dug out of Stripe's shape. */
export function priceIdOfSubscription(subscription: Stripe.Subscription): string | null {
  return subscription.items?.data?.[0]?.price?.id ?? null;
}

/**
 * A subscription's end, whichever field Stripe put it in.
 *
 * `cancel_at` is set when someone cancels ahead of time; otherwise the paid
 * period runs to the end of the current one. Both arrive as Unix seconds.
 */
export function endsAtOfSubscription(subscription: Stripe.Subscription): Date | null {
  const seconds = subscription.cancel_at
    ?? (subscription as unknown as { current_period_end?: number }).current_period_end
    ?? subscription.items?.data?.[0]?.current_period_end
    ?? null;
  return seconds ? new Date(seconds * 1000) : null;
}

/** Guards a plan id arriving from a request. */
export function readPlanId(value: unknown): PlanId | null {
  if (!isPlanId(value) || value === "free") return null;
  return planFor(value).id;
}
