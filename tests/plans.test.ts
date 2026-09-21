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

import {
  allPlans,
  basePlanFor,
  planFor,
  PLAN_IDS,
  WHOOP_FREE_UNTIL,
  whoopPromotionActive,
  type Plan,
} from "../src/plans";
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

/**
 * A typed estimate, which is the only kind some plans can make.
 *
 * The figure above is a PHOTO estimate — an image is about 1,600 tokens on its
 * own, so it costs roughly 1.7x a description. Using it for a plan whose
 * `photo` flag is false overstates that plan's cost by most of a factor of
 * two, and the free tier's whole arithmetic turns on the difference.
 */
function textEstimateMicros(model: string): number {
  return costMicros({ model, inputTokens: 1450, outputTokens: 150 });
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

/** The bottom of the 20-40p a month display ads plausibly bring in. */
const PESSIMISTIC_AD_REVENUE_MICROS = 0.2 * 1_000_000;

describe("the free tier costs less than its ads bring in", () => {
  /**
   * Free logs by text only, and that is load-bearing rather than incidental.
   *
   * Every figure below prices a typed estimate. Turning photo on for the free
   * tier would make each call about 1.7x dearer and invalidate the lot, so the
   * assumption is asserted rather than assumed — including at runtime, where
   * the admin tier editor can now flip this flag without a deployment.
   */
  it("logs by text only, which is what the arithmetic below assumes", () => {
    expect(planFor("free").photo).toBe(false);
  });

  it("can't cost more than ads bring in, even used to the limit every day", () => {
    // The real guarantee, and it is the ALLOWANCE that delivers it: three a
    // day for the longest month, at the rate a free account can actually
    // incur, against the pessimistic end of what ads pay.
    const plan = planFor("free");
    const allowanceWorstCase = LONGEST_MONTH * plan.dailyEstimates * textEstimateMicros(plan.model);
    expect(allowanceWorstCase).toBeLessThanOrEqual(PESSIMISTIC_AD_REVENUE_MICROS);
  });

  it("runs out of allowance before it runs out of budget", () => {
    // Deliberately this way round, and it used to be the other.
    //
    // These two limits fail differently. Meeting the allowance is legible —
    // three a day, you have had three. Meeting the ceiling is the app going
    // quiet mid-month for a reason no screen explains. At four a day the
    // ceiling was the tighter of the two, so the heaviest users hit the one
    // nobody had told them about.
    const plan = planFor("free");
    const allowanceWorstCase = LONGEST_MONTH * plan.dailyEstimates * textEstimateMicros(plan.model);
    expect(allowanceWorstCase).toBeLessThan(plan.monthlyCostCapMicros);
  });

  it("still keeps a ceiling tight enough to bound a costing mistake", () => {
    // The ceiling stops being the profitability guarantee and becomes the
    // backstop for the estimate above being wrong — a longer prompt, a dearer
    // model. It only earns that job by staying inside what ads can pay for at
    // all, so it is bounded by the TOP of the range rather than the bottom.
    expect(planFor("free").monthlyCostCapMicros).toBeLessThanOrEqual(0.4 * 1_000_000);
  });
});

describe("the ceiling is what makes the promise, not the allowance", () => {

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

/**
 * WHOOP, free to everybody for a month, then Pro again.
 *
 * The launch post to r/WHOOP promises a specific date. That makes this a
 * commitment made in public rather than a flag, and the failure modes are
 * both bad in the same way: ending early makes a liar of the post, and never
 * ending at all teaches the people who believed it not to next time.
 *
 * So the window is tested at both edges rather than only in the middle, and
 * the plan data itself is checked to be unchanged underneath — when the date
 * passes, Pro has to still be the only tier with a watch on it, with nothing
 * left behind needing a deploy to clean up.
 */
describe("the WHOOP promotion", () => {
  const during = new Date(WHOOP_FREE_UNTIL.getTime() - 1000);
  const after = new Date(WHOOP_FREE_UNTIL.getTime() + 1000);

  it("gives every plan a WHOOP connection while it runs", () => {
    for (const id of PLAN_IDS) {
      expect(planFor(id, during).health, `${id} during the promotion`).toBe(true);
    }
  });

  it("takes it back the moment the window closes", () => {
    expect(planFor("free", after).health).toBe(false);
    expect(planFor("plus", after).health).toBe(false);
    // Pro paid for it and keeps it either way — that is the whole point of
    // the promotion ending rather than the feature moving.
    expect(planFor("pro", after).health).toBe(true);
  });

  it("does not quietly rewrite the plans underneath", () => {
    // basePlanFor is what the admin screen shows as "unchanged", and what the
    // app falls back to. A promotion that edited the data in place would
    // outlive its own end date.
    expect(basePlanFor("free").health).toBe(false);
    expect(basePlanFor("plus").health).toBe(false);
    expect(basePlanFor("pro").health).toBe(true);
  });

  it("leaves Pro's selling points describing Pro", () => {
    // The highlights are read by the pricing page, which will still be there
    // in November. Promoting a feature must not edit the copy that explains
    // why the tier exists.
    const pro = planFor("pro", during);
    expect(pro.highlights.some((line) => /WHOOP/i.test(line))).toBe(true);
    expect(planFor("free", during).highlights.some((line) => /WHOOP/i.test(line))).toBe(false);
  });

  it("agrees with itself about whether it is running", () => {
    expect(whoopPromotionActive(during)).toBe(true);
    expect(whoopPromotionActive(after)).toBe(false);
    expect(whoopPromotionActive(new Date(WHOOP_FREE_UNTIL))).toBe(false);
  });

  it("ends on a date that is actually in the future when shipped", () => {
    // A promotion committed with a date already past would advertise an offer
    // nobody can take, and the post would be wrong the day it went up.
    expect(WHOOP_FREE_UNTIL.getTime()).toBeGreaterThan(new Date("2026-09-21T00:00:00Z").getTime());
  });
});
