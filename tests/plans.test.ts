import { describe, expect, it, vi } from "vitest";

vi.mock("../src/config", () => ({
  // reconcileAdmin and toPublicUser both read this on every sign-in.
  adminUsernames: [],
  config: {
    GBP_PER_USD: 0.8,
    ANTHROPIC_MODEL: "claude-sonnet-5",
    ANTHROPIC_MODEL_FREE: "claude-haiku-4-5",
  },
}));

import { allPlans, planFor, PLAN_IDS , type Plan } from "../src/plans";
import { costMicros } from "../src/modelPricing";

/**
 * The promise: no plan can cost more to serve than it brings in.
 *
 * These are not tests of the code so much as tests of the *prices*. They
 * exist so that changing a price, an allowance or a model breaks a test
 * rather than quietly breaking the business — which is exactly the failure
 * nobody notices until the API bill arrives.
 */

/**
 * What actually arrives from a headline price.
 *
 * The prices are VAT-inclusive, so a sixth of £4.99 was never ours — it is
 * carved out, not added on. Then Stripe takes 1.5% + 20p on a domestic card.
 * Every margin assertion below is against this, not the headline, because the
 * headline is the number that flatters and this is the number that pays the
 * API bill.
 */
function netPence(pricePence: number, feeRate = 0.015): number {
  if (pricePence === 0) return 0;
  const exVat = Math.round(pricePence / 1.2);
  return exVat - Math.round(pricePence * feeRate) - 20;
}

/**
 * A fee well above anything Stripe plausibly charges.
 *
 * Managed Payments takes on the tax work and may price higher than standard
 * card processing for it, and that rate isn't fixed here. Rather than track a
 * number that lives in someone else's dashboard, the promise is checked
 * against a fee dearer than any of them — if it holds at 4%, the exact rate
 * stops being something this file has to know.
 */
const PESSIMISTIC_FEE = 0.04;

/** The dearest single estimate a plan can produce: a photo, on its model. */
function worstEstimateMicros(model: string): number {
  return costMicros({ model, inputTokens: 2800, outputTokens: 200 });
}

const LONGEST_MONTH = 31;

describe("every paid plan makes money at its ceiling", () => {
  for (const id of PLAN_IDS) {
    const plan = planFor(id);
    if (plan.pricePence === 0) continue;

    it(`${plan.name} nets more than its ceiling can cost`, () => {
      const netMicros = netPence(plan.pricePence) * 10_000; // pence -> micros
      expect(plan.monthlyCostCapMicros).toBeLessThan(netMicros);
      // And with real headroom, not by a penny: a plan whose margin is noise
      // is one bad month of exchange rate from losing money.
      expect(netMicros - plan.monthlyCostCapMicros).toBeGreaterThan(1_000_000);
    });
  }
});

describe("the ceiling is what makes the promise, not the allowance", () => {
  it("free's ceiling sits under what ads plausibly bring in", () => {
    // Display advertising on an app like this is roughly 20-40p per active
    // user per month. The ceiling has to sit under the bottom of that.
    expect(planFor("free").monthlyCostCapMicros).toBeLessThanOrEqual(0.2 * 1_000_000);
  });

  it("free's allowance alone would already cost more than its ceiling", () => {
    // Which is the point: the allowance is the headline, the ceiling is the
    // promise, and the ceiling is deliberately the tighter of the two.
    const plan = planFor("free");
    const allowanceWorstCase = LONGEST_MONTH * plan.dailyEstimates * worstEstimateMicros(plan.model);
    expect(allowanceWorstCase).toBeGreaterThan(plan.monthlyCostCapMicros);
  });

  it("keeps a guaranteed floor under Pro that the allowance alone doesn't", () => {
    // Why a count is not a cost, stated as the thing that stays true when the
    // price changes. Forty photo estimates a day for a long month eats most of
    // what Pro brings in — the exact share moves with the exchange rate and
    // with what a photo costs, and a margin decided by those is not a margin.
    // The ceiling is a fixed floor that neither can move.
    const plan = planFor("pro");
    const net = netPence(plan.pricePence) * 10_000;
    const allowanceWorstCase = LONGEST_MONTH * plan.dailyEstimates * worstEstimateMicros(plan.model);

    // More than half the revenue can go on the allowance alone.
    expect(allowanceWorstCase / net).toBeGreaterThan(0.5);
    // The ceiling guarantees at least half of it stays, whatever anyone does.
    expect(plan.monthlyCostCapMicros / net).toBeLessThan(0.5);
  });

  it("keeps that floor under Pro even on a much dearer processing fee", () => {
    // The point of the ceiling is that it holds when the numbers around it
    // move. The processing rate is one of those numbers and it belongs to
    // Stripe, not to this file — so the guarantee is checked against a fee
    // well above any of theirs rather than against the one in the header.
    const plan = planFor("pro");
    const net = netPence(plan.pricePence, PESSIMISTIC_FEE) * 10_000;
    expect(plan.monthlyCostCapMicros / net).toBeLessThan(0.5);
  });

  it("still makes money on every paid plan at that fee", () => {
    for (const plan of allPlans()) {
      if (plan.pricePence === 0) continue;
      const net = netPence(plan.pricePence, PESSIMISTIC_FEE) * 10_000;
      expect(plan.monthlyCostCapMicros, `${plan.name} at a 4% fee`).toBeLessThan(net);
    }
  });

  it("makes a year of either plan cheaper to serve than it is to buy", () => {
    // The yearly price is nine months, so a year is twelve monthly ceilings
    // against nine months of revenue. That has to still clear.
    for (const plan of allPlans()) {
      if (plan.yearlyPence === null) continue;
      const yearlyNetMicros = netPence(plan.yearlyPence) * 10_000;
      const worstYear = 12 * plan.monthlyCostCapMicros;
      expect(worstYear, `a year of ${plan.name}`).toBeLessThan(yearlyNetMicros);
    }
  });
});

describe("the ladder", () => {
  it("gives every tier something the one below it hasn't", () => {
    // A ladder made only of quota converts badly: people upgrade for
    // capability, not for a bigger number.
    //
    // Checked structurally rather than by naming features, because which
    // feature sits on which rung is a pricing decision that moves. What must
    // not move is that every step up buys a capability at all — the day one
    // of these steps becomes "the same app, with a bigger number", this is
    // the test that should fail.
    const plans = allPlans();
    const capabilities = (plan: Plan) =>
      (Object.keys(plan) as (keyof Plan)[]).filter((key) => plan[key] === true);

    for (let i = 1; i < plans.length; i += 1) {
      const lower = plans[i - 1]!;
      const higher = plans[i]!;
      const gained = capabilities(higher).filter((key) => lower[key] !== true);
      // `ads` runs the other way — having it is the worse deal — so losing it
      // counts as something gained.
      const adsDropped = lower.ads && !higher.ads;
      expect(
        gained.length > 0 || adsDropped,
        `${higher.name} adds no capability over ${lower.name}`,
      ).toBe(true);
    }
  });

  it("puts the two calls that cost the most at the top", () => {
    // Photo and recipe scanning are the expensive paths — roughly 1.7x and 6x
    // a typed estimate. Wherever else the ladder gets reshuffled, these two
    // belong where the revenue is, or the ceiling ends up funding a headline
    // the plan didn't charge for.
    const [free, plus, pro] = allPlans();
    expect(pro!.photo && pro!.recipeScan).toBe(true);
    expect(free!.photo || free!.recipeScan).toBe(false);
    expect(plus!.recipeScan).toBe(false);
  });

  it("never goes backwards on allowance or price", () => {
    const plans = allPlans();
    for (let i = 1; i < plans.length; i += 1) {
      expect(plans[i]!.pricePence).toBeGreaterThan(plans[i - 1]!.pricePence);
      expect(plans[i]!.dailyEstimates).toBeGreaterThan(plans[i - 1]!.dailyEstimates);
      expect(plans[i]!.monthlyCostCapMicros).toBeGreaterThan(plans[i - 1]!.monthlyCostCapMicros);
    }
  });

  it("makes the yearly price a real saving", () => {
    for (const plan of allPlans()) {
      if (plan.yearlyPence === null) continue;
      expect(plan.yearlyPence).toBeLessThan(plan.pricePence * 12);
    }
  });
});
