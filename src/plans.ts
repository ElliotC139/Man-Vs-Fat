/**
 * What each plan costs, what it includes, and why those two numbers are safe
 * together.
 *
 * The rule this file exists to enforce: **no plan can cost more to serve than
 * it brings in.** Every AI call is metered against what the API actually
 * charged (src/modelPricing.ts), and each plan carries a hard monthly ceiling
 * on that spend. The daily allowance below is the number a person sees; the
 * ceiling is the number that makes the promise true, and it holds even if the
 * allowance is wrong, the prompt grows, or someone finds an expensive way to
 * use the app.
 *
 * ── The arithmetic ────────────────────────────────────────────────────────
 *
 * A text estimate sends roughly 1,450 input tokens (a ~1,150-token system
 * prompt, up to five database reference rows, and the description) and gets
 * back about 150. A photo estimate replaces the description with an image
 * capped at 1568px, which is about 1,600 tokens, so roughly 2,800 in and 200
 * out. At the rates in modelPricing.ts, one estimate costs about:
 *
 *              text      photo
 *   Haiku 4.5  0.18p     0.31p
 *   Sonnet 5   0.36p     0.62p
 *   Opus 5     0.90p     1.55p
 *
 * Those are the figures the allowances below are sized against, at a
 * pessimistic 100% photo mix. They are estimates and the ceilings are not:
 * the ceiling is checked against measured spend, so if these figures are
 * wrong the ceiling still holds.
 *
 * ── Why the free tier can exist at all ────────────────────────────────────
 *
 * Because the app now answers from its own databases before it calls the
 * model (src/estimateShortcut.ts), a free account gets unlimited barcode
 * scans, food search, saved meals, and re-logs of anything already in its
 * diary. None of that costs anything to serve. The AI is the part that costs
 * money, so the AI is the part that is rationed.
 */

import { config } from "./config";

export const PLAN_IDS = ["free", "plus", "pro"] as const;
export type PlanId = (typeof PLAN_IDS)[number];

export interface Plan {
  id: PlanId;
  name: string;
  /** Monthly price in pence. Zero for the free tier. */
  pricePence: number;
  /** Yearly price in pence, where one is offered. */
  yearlyPence: number | null;
  /** How many AI estimates a day the plan includes. */
  dailyEstimates: number;
  /**
   * The hard ceiling on what this account's AI calls may cost in a calendar
   * month, in millionths of a pound. Reaching it stops the estimates for the
   * rest of the month; it is not a soft warning.
   */
  monthlyCostCapMicros: number;
  /** Which model the plan's estimates run on. */
  model: string;
  /** Whether the free tier's ad slots are shown. */
  ads: boolean;
  /** Photo logging, which costs roughly twice what a typed one does. */
  photo: boolean;
  /** One line for the plan picker. */
  tagline: string;
  /** What the plan adds over the one below it. */
  highlights: string[];
}

/** £1 in micros, so the figures below read as money. */
const POUND = 1_000_000;

/**
 * Free — funded by ads, so it has to cost less than ads bring in.
 *
 * Display advertising on an app like this brings in roughly 20–40p per active
 * user per month, and that is the number the ceiling has to sit under. Three
 * estimates a day on Haiku is at most 31 × 3 × 0.31p ≈ 29p, and the ceiling is
 * set at 20p — below the allowance's own worst case on purpose, because the
 * ceiling is the promise and the allowance is only the headline.
 *
 * Photo logging is off here: it is the expensive path, and it is the clearest
 * thing to hold back.
 */
const FREE: Plan = {
  id: "free",
  name: "Free",
  pricePence: 0,
  yearlyPence: null,
  dailyEstimates: 3,
  monthlyCostCapMicros: 0.2 * POUND,
  model: config.ANTHROPIC_MODEL_FREE,
  ads: true,
  photo: false,
  tagline: "The whole diary, with the AI rationed.",
  highlights: [
    "Unlimited barcode scans and food search",
    "Unlimited saved meals, recipes and re-logs",
    "3 AI estimates a day",
    "Shows ads",
  ],
};

/**
 * Plus — the ordinary paid plan.
 *
 * £3.99 less Stripe's 1.5% + 20p is about £3.73 net. Ten estimates a day on
 * the full model is at most 31 × 10 × 0.62p ≈ £1.92, and the ceiling is £2.00.
 * Worst case margin is therefore about £1.73 a month, and the realistic margin
 * is far better than that, because most days are nowhere near ten and most
 * entries never reach the model at all.
 */
const PLUS: Plan = {
  id: "plus",
  name: "Plus",
  pricePence: 399,
  yearlyPence: 3499,
  dailyEstimates: 10,
  monthlyCostCapMicros: 2 * POUND,
  model: config.ANTHROPIC_MODEL,
  ads: false,
  photo: true,
  tagline: "No ads, photo logging, ten estimates a day.",
  highlights: [
    "Everything in Free, with no ads",
    "Log by photo",
    "10 AI estimates a day",
  ],
};

/**
 * Pro — for someone logging everything, every day.
 *
 * £7.99 less Stripe's fee is about £7.67 net. Forty estimates a day is at most
 * 31 × 40 × 0.62p ≈ £7.69, which is more than the plan brings in — so the
 * ceiling, not the allowance, is what makes this plan safe. It sits at £4.50,
 * leaving about £3.17 of margin in the worst case that can actually happen.
 *
 * The allowance is deliberately generous relative to the ceiling: forty a day
 * is "effectively unlimited" for a real person, and the ceiling only bites for
 * someone using the app in a way no diary-keeper does.
 */
const PRO: Plan = {
  id: "pro",
  name: "Pro",
  pricePence: 799,
  yearlyPence: 6999,
  dailyEstimates: 40,
  monthlyCostCapMicros: 4.5 * POUND,
  model: config.ANTHROPIC_MODEL,
  ads: false,
  photo: true,
  tagline: "Log everything, every day, without counting.",
  highlights: [
    "Everything in Plus",
    "40 AI estimates a day",
    "Priority on new features",
  ],
};

const PLANS: Record<PlanId, Plan> = { free: FREE, plus: PLUS, pro: PRO };

export function isPlanId(value: unknown): value is PlanId {
  return typeof value === "string" && (PLAN_IDS as readonly string[]).includes(value);
}

/**
 * The plan for a stored value.
 *
 * Anything unrecognised reads as free, which is the safe direction: a bad
 * value should ration someone, never hand them an unlimited account.
 */
export function planFor(stored: string | null | undefined): Plan {
  return isPlanId(stored) ? PLANS[stored] : FREE;
}

export function allPlans(): Plan[] {
  return PLAN_IDS.map((id) => PLANS[id]);
}
