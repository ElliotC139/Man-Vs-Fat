import { describe, expect, it, vi } from "vitest";

vi.mock("../src/config", () => ({
  adminUsernames: [],
  config: {
    GBP_PER_USD: 0.8,
    ANTHROPIC_MODEL: "claude-sonnet-5",
    ANTHROPIC_MODEL_FREE: "claude-haiku-4-5",
  },
}));

import { classifyAccount, monthlyPence, summariseRevenue, type BillingFacts } from "../src/accounting";
import { planFor } from "../src/plans";

/**
 * The number the pricing structure exists to keep positive.
 *
 * It was computed by summing the price of everybody's plan, which counted
 * comped accounts as income and priced yearly subscribers monthly — both
 * errors flattering, in the one figure nobody would think to question. These
 * tests exist so it cannot drift back.
 */

function account(over: Partial<BillingFacts> = {}): BillingFacts {
  return {
    plan: "free",
    stripeSubscriptionId: null,
    subscriptionStatus: null,
    subscriptionInterval: null,
    ...over,
  };
}

const paying = (plan: string, interval: string | null = "month") =>
  account({ plan, stripeSubscriptionId: "sub_123", subscriptionStatus: "active", subscriptionInterval: interval });

describe("telling a customer from a comp", () => {
  it("calls a free account free", () => {
    expect(classifyAccount(account())).toBe("free");
  });

  it("calls a paid plan with no subscription behind it a comp", () => {
    // The operator's own account, and anybody set by hand from the admin
    // screen. They are a cost, not a customer.
    expect(classifyAccount(account({ plan: "pro" }))).toBe("comped");
    expect(classifyAccount(account({ plan: "plus" }))).toBe("comped");
  });

  it("calls a paid plan with a live subscription paying", () => {
    expect(classifyAccount(paying("plus"))).toBe("paying");
    expect(classifyAccount(paying("pro"))).toBe("paying");
  });

  it("still counts someone whose card just bounced", () => {
    // past_due entitles deliberately — Stripe retries for days, and a bank's
    // fraud check is not a cancellation. billing.ts makes that call; this
    // follows it rather than making a second, different one.
    expect(classifyAccount(account({
      plan: "pro", stripeSubscriptionId: "sub_1", subscriptionStatus: "past_due",
    }))).toBe("paying");
    expect(classifyAccount(account({
      plan: "pro", stripeSubscriptionId: "sub_1", subscriptionStatus: "trialing",
    }))).toBe("paying");
  });

  it("calls a cancelled or unpaid subscription lapsed", () => {
    for (const status of ["canceled", "unpaid", "incomplete_expired"]) {
      expect(classifyAccount(account({
        plan: "pro", stripeSubscriptionId: "sub_1", subscriptionStatus: status,
      }))).toBe("lapsed");
    }
  });
});

describe("what an account is worth a month", () => {
  it("is nothing at all for anyone not paying", () => {
    expect(monthlyPence(account())).toBe(0);
    expect(monthlyPence(account({ plan: "pro" }))).toBe(0); // comped
    expect(monthlyPence(account({
      plan: "pro", stripeSubscriptionId: "s", subscriptionStatus: "canceled",
    }))).toBe(0);
  });

  it("is the headline price for a monthly subscriber", () => {
    expect(monthlyPence(paying("plus"))).toBe(planFor("plus").pricePence);
    expect(monthlyPence(paying("pro"))).toBe(planFor("pro").pricePence);
  });

  it("divides a yearly subscription down to its real monthly share", () => {
    // A year costs nine months, so a yearly Pro is well under the £9.99 the
    // old sum credited them with.
    const pro = planFor("pro");
    expect(monthlyPence(paying("pro", "year"))).toBe(Math.round(pro.yearlyPence! / 12));
    expect(monthlyPence(paying("pro", "year"))).toBeLessThan(pro.pricePence);
  });

  it("falls back to the monthly price rather than reporting a payer as free", () => {
    // A subscription bought before the interval was recorded. Counting it as
    // zero would be the same class of error in the other direction.
    expect(monthlyPence(paying("plus", null))).toBe(planFor("plus").pricePence);
  });
});

describe("the month's revenue, across everybody", () => {
  it("leaves comped accounts out of the total but not out of the count", () => {
    const users = [
      account(),                 // free
      account({ plan: "pro" }),  // comped — the operator
      paying("plus"),
    ];

    const summary = summariseRevenue(users);
    expect(summary.monthlyPence).toBe(planFor("plus").pricePence);
    expect(summary.counts).toEqual({ free: 1, paying: 1, comped: 1, lapsed: 0 });
  });

  it("splits each plan into who pays for it and who was given it", () => {
    const summary = summariseRevenue([
      paying("pro"), account({ plan: "pro" }), account({ plan: "pro" }),
      paying("plus"),
    ]);

    expect(summary.byPlan.pro).toMatchObject({ paying: 1, comped: 2, lapsed: 0 });
    expect(summary.byPlan.plus).toMatchObject({ paying: 1, comped: 0 });
    // Three accounts on Pro, one Pro's worth of money.
    expect(summary.byPlan.pro!.monthlyPence).toBe(planFor("pro").pricePence);
  });

  it("reports nothing rather than throwing on an empty app", () => {
    const summary = summariseRevenue([]);
    expect(summary.monthlyPence).toBe(0);
    expect(summary.counts.paying).toBe(0);
    expect(summary.byPlan).toEqual({});
  });

  it("would have been overstated by the old sum, which is the whole point", () => {
    // The exact shape that was wrong: an operator on a comped Pro, and one
    // real customer paying yearly.
    const users = [account({ plan: "pro" }), paying("pro", "year")];

    const oldWay = users.reduce((sum, u) => sum + planFor(u.plan).pricePence, 0);
    const actual = summariseRevenue(users).monthlyPence;

    expect(actual).toBeLessThan(oldWay);
    // Not a rounding difference — the old figure was more than double.
    expect(oldWay).toBeGreaterThan(actual * 2);
  });
});
