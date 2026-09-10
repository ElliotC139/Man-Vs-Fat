import { describe, expect, it, vi } from "vitest";

vi.mock("../src/config", () => ({
  // reconcileAdmin and toPublicUser both read this on every sign-in.
  adminUsernames: [],
  config: {
    GBP_PER_USD: 0.8,
    ANTHROPIC_MODEL: "claude-sonnet-5",
    ANTHROPIC_MODEL_FREE: "claude-haiku-4-5",
    STRIPE_SECRET_KEY: "sk_test_x",
    STRIPE_WEBHOOK_SECRET: "whsec_x",
    STRIPE_PRICE_PLUS_MONTHLY: "price_plus_m",
    STRIPE_PRICE_PLUS_YEARLY: "price_plus_y",
    STRIPE_PRICE_PRO_MONTHLY: "price_pro_m",
    STRIPE_PRICE_PRO_YEARLY: undefined,
  },
  stripeConfigured: true,
}));

import {
  planForPriceId,
  planFromSubscription,
  intervalForPriceId,
  priceIdFor,
  purchasableIntervals,
  readPlanId,
  statusEntitles,
} from "../src/billing";

/**
 * The rules that decide what someone is entitled to once Stripe has spoken.
 * Pure on purpose — none of this needs a Stripe account to check, and all of
 * it is the difference between a paying customer and a locked-out one.
 */

describe("prices and plans", () => {
  it("maps a plan and interval to its price, and back", () => {
    expect(priceIdFor("plus", "monthly")).toBe("price_plus_m");
    expect(planForPriceId("price_plus_m")).toBe("plus");
    expect(planForPriceId("price_pro_m")).toBe("pro");
  });

  it("offers a plan at whichever intervals it has prices for", () => {
    // Pro has no yearly price configured here, which is a normal state — it
    // is simply not offered yearly rather than offered and broken. The
    // settings screen renders exactly this shape, so a half-filled Stripe
    // dashboard has to come back as a partial answer rather than a whole one.
    expect(priceIdFor("pro", "yearly")).toBeNull();
    expect(purchasableIntervals()).toEqual({
      plus: ["monthly", "yearly"],
      pro: ["monthly"],
    });
  });

  it("says which way a price bills, and admits when it doesn't know", () => {
    // Nothing is entitled on the strength of this — it decides what price a
    // screen quotes — so an unknown price is unknown rather than monthly.
    expect(intervalForPriceId("price_plus_m")).toBe("monthly");
    expect(intervalForPriceId("price_plus_y")).toBe("yearly");
    expect(intervalForPriceId("price_from_somewhere_else")).toBeNull();
    expect(intervalForPriceId(null)).toBeNull();
  });

  it("refuses to recognise a price it doesn't know", () => {
    // The webhook decides entitlement from this, so an unknown price has to
    // mean "leave them alone", never "give them something".
    expect(planForPriceId("price_from_somewhere_else")).toBeNull();
    expect(planForPriceId(null)).toBeNull();
    expect(planForPriceId(undefined)).toBeNull();
  });

  it("won't let anyone check out onto the free plan", () => {
    expect(readPlanId("free")).toBeNull();
    expect(readPlanId("pro")).toBe("pro");
    expect(readPlanId("enterprise")).toBeNull();
    expect(readPlanId(undefined)).toBeNull();
  });
});

describe("which statuses count as paid", () => {
  it("counts an active subscription, and a trial", () => {
    expect(statusEntitles("active")).toBe(true);
    // A trial is a promise the app made and should keep.
    expect(statusEntitles("trialing")).toBe(true);
  });

  it("keeps someone on while Stripe is still retrying their card", () => {
    // Switching someone off the moment a renewal bounces punishes them for a
    // bank's fraud check. Stripe retries for days before giving up.
    expect(statusEntitles("past_due")).toBe(true);
  });

  it("stops once Stripe has given up", () => {
    expect(statusEntitles("canceled")).toBe(false);
    expect(statusEntitles("unpaid")).toBe(false);
    expect(statusEntitles("incomplete_expired")).toBe(false);
    expect(statusEntitles(null)).toBe(false);
  });
});

describe("the plan a subscription entitles", () => {
  const NOW = new Date("2026-09-15T12:00:00Z");

  it("gives the plan the price names", () => {
    expect(planFromSubscription({ status: "active", priceId: "price_pro_m", now: NOW })).toBe("pro");
    expect(planFromSubscription({ status: "active", priceId: "price_plus_y", now: NOW })).toBe("plus");
  });

  it("keeps a cancelled plan until the period they paid for runs out", () => {
    // They bought the month. Taking it back on the day they cancel would be
    // charging for something and then not providing it.
    expect(planFromSubscription({
      status: "canceled",
      priceId: "price_pro_m",
      endsAt: new Date("2026-09-30T00:00:00Z"),
      now: NOW,
    })).toBe("pro");
  });

  it("drops to free once that period has passed", () => {
    expect(planFromSubscription({
      status: "canceled",
      priceId: "price_pro_m",
      endsAt: new Date("2026-09-01T00:00:00Z"),
      now: NOW,
    })).toBe("free");
  });

  it("drops to free on a price it doesn't recognise, whatever the status", () => {
    // The safe direction: an unrecognised price must never be read as an
    // entitlement to the most expensive thing on the list.
    expect(planFromSubscription({ status: "active", priceId: "price_mystery", now: NOW })).toBe("free");
  });

  it("drops to free with no price at all", () => {
    expect(planFromSubscription({ status: "active", priceId: null, now: NOW })).toBe("free");
  });
});
