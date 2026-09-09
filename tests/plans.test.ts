import { describe, expect, it, vi } from "vitest";

vi.mock("../src/config", () => ({
  config: {
    GBP_PER_USD: 0.8,
    ANTHROPIC_MODEL: "claude-sonnet-5",
    ANTHROPIC_MODEL_FREE: "claude-haiku-4-5",
  },
}));

import { allPlans, planFor, PLAN_IDS } from "../src/plans";
import { costMicros } from "../src/modelPricing";

/**
 * The promise: no plan can cost more to serve than it brings in.
 *
 * These are not tests of the code so much as tests of the *prices*. They
 * exist so that changing a price, an allowance or a model breaks a test
 * rather than quietly breaking the business — which is exactly the failure
 * nobody notices until the API bill arrives.
 */

/** Stripe UK: 1.5% + 20p on a domestic card. */
function netPence(pricePence: number): number {
  return pricePence === 0 ? 0 : pricePence - Math.round(pricePence * 0.015) - 20;
}

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

  it("leaves Pro no real margin on its allowance alone", () => {
    // The clearest case for why a count is not a cost. Forty photo estimates
    // a day for a long month comes to within a few percent of everything Pro
    // brings in — which side of break-even it lands on depends on the
    // exchange rate that month, and a business whose margin is decided by
    // the exchange rate has no margin. The ceiling is what creates one.
    const plan = planFor("pro");
    const net = netPence(plan.pricePence) * 10_000;
    const allowanceWorstCase = LONGEST_MONTH * plan.dailyEstimates * worstEstimateMicros(plan.model);
    expect(allowanceWorstCase / net).toBeGreaterThan(0.9);

    // Whereas the ceiling keeps at least 40% of the revenue, whatever anyone
    // does with their allowance.
    expect(plan.monthlyCostCapMicros / net).toBeLessThan(0.6);
  });
});

describe("the ladder", () => {
  it("gives every tier something the one below it hasn't", () => {
    const [free, plus, pro] = allPlans();
    // A ladder made only of quota converts badly: people upgrade for
    // capability, not for a bigger number.
    expect(free!.ads && !plus!.ads).toBe(true);
    expect(!free!.photo && plus!.photo).toBe(true);
    expect(!plus!.recipeScan && pro!.recipeScan).toBe(true);
    expect(!plus!.health && pro!.health).toBe(true);
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
