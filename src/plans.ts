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
 * ── What actually arrives, after VAT and Stripe ───────────────────────────
 *
 * The prices below are **VAT-inclusive**: £4.99 is what a customer pays, and
 * the VAT is carved out of it rather than added on top. That is the right way
 * round for a consumer app — the price on the page is the price — but it means
 * a sixth of the headline is never ours.
 *
 * This account runs on Stripe's Managed Payments, so Stripe is the merchant of
 * record: it works the VAT out, collects it, and remits it. That is settled
 * rather than pending — the VAT comes out of every payment from the first one,
 * not from whenever a registration threshold gets crossed. Take it off, take
 * the processing fee off, and what's left is:
 *
 *                    price    VAT     fee    kept
 *   Plus monthly     £4.99   £0.83   £0.27   £3.89
 *   Pro monthly      £9.99   £1.66   £0.35   £7.98
 *   Plus yearly     £44.91   £7.48   £0.87  £36.56
 *   Pro yearly      £89.91  £14.98   £1.55  £73.38
 *
 * Every margin figure below is against the *kept* column, not the headline.
 *
 * The fee column assumes 1.5% + 20p, a domestic card on standard pricing.
 * Managed Payments may charge more than that for taking on the tax work, and
 * the figure isn't pinned down here. It doesn't need to be: the promise this
 * file exists to keep survives a much dearer fee. At 4% + 20p — well above any
 * plausible premium — Pro still keeps £7.73 against a £3.50 ceiling, which is
 * still under half. There is a test for exactly that, so the claim is checked
 * rather than asserted.
 *
 * ── Why the free tier can exist at all ────────────────────────────────────
 *
 * Because the app now answers from its own databases before it calls the
 * model (src/estimateShortcut.ts), a free account gets unlimited barcode
 * scans, food search, saved meals, and re-logs of anything already in its
 * diary. None of that costs anything to serve. The AI is the part that costs
 * money, so the AI is the part that is rationed.
 *
 * ── Why photo logging is on Plus rather than Pro ──────────────────────────
 *
 * Because a photo costs 1.7x a typed estimate, not ten times it. At Plus's
 * ten a day, an account that photographed every single meal would cost about
 * £1.88 a month against £3.89 kept — comfortably profitable, and the ceiling
 * catches it even if that arithmetic is wrong. There is no cost argument for
 * holding it back.
 *
 * There is a *ladder* argument, and it is the right instinct pointed at the
 * wrong feature. Photographing your dinner is the single most persuasive
 * reason a free user pays anything at all; putting it at £7.99 doesn't move
 * those people up to Pro, it leaves most of them on free. So Pro earns its
 * price on capability that genuinely belongs at the top instead:
 *
 *   - Recipe and label scanning, which is the one call that really is
 *     expensive — an image in and up to 2,000 tokens back, about six typed
 *     estimates.
 *   - WHOOP and Apple Health, which turn a formula's guess at what you burned
 *     into a measurement. Costs nothing to serve; it is a power-user feature
 *     and reads as one.
 *   - The weekly PDF report and its Drive filing, same again.
 *
 * The charts, trends, targets and adaptive TDEE stay free. They are what the
 * diary is *for*, and a calorie app that won't show you your own trend is not
 * a cheaper product, it is a broken one.
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
  /** Photo logging, which costs about 1.7x what a typed estimate does. */
  photo: boolean;
  /**
   * Scanning a recipe or a nutrition label into a full breakdown.
   *
   * The most expensive single call the app makes by a wide margin — an image
   * in, and up to 2,000 tokens of ingredient list back, which is roughly six
   * typed estimates. It earns its place at the top tier on cost alone.
   */
  recipeScan: boolean;
  /** WHOOP and Apple Health sync — measured burn instead of a formula. */
  health: boolean;
  /** The weekly PDF report, and filing it to Google Drive. */
  weeklyReport: boolean;

  /* ── The six that cost nothing to serve ──────────────────────────────
     None of these spend anything at Anthropic: they are settings, a
     computed card, and two kinds of record-keeping. They are tier levers
     purely because they are worth paying for, which means the rule about
     them has to be different from the rule about the metered ones:

       Having the feature is what needs the plan. Reading what you already
       recorded with it never does.

     So a free account that logged measurements for six months keeps seeing
     and exporting all of them; what needs Plus is adding the next one. A
     paywall in front of somebody's own history is not a plan boundary, it
     is a hostage. Every gate below is written that way. */

  /** The in-app end-of-week review. */
  weeklyReview: boolean;
  /** The eating-window card on Stats. */
  eatingWindow: boolean;
  /** The fasting timer, and setting an eating window to drive it. */
  fasting: boolean;
  /** Keto mode: net carbs, and Today leading with them. */
  keto: boolean;
  /** Recording body measurements. */
  measurements: boolean;
  /** Recording progress photos. */
  progressPhotos: boolean;

  /** One line for the plan picker. */
  tagline: string;
  /** What the plan adds over the one below it. */
  highlights: string[];
}

/** £1 in micros, so the figures below read as money. */
const POUND = 1_000_000;

/**
 * A year costs nine months. Three free, which is a discount somebody can hold
 * in their head — unlike "17% off", which is the same number and says nothing.
 *
 * Safe on the arithmetic above because the ceilings are monthly: twelve months
 * of Plus can cost at most £24 to serve against £36.56 kept, and twelve of Pro
 * at most £42 against £73.38.
 */
const MONTHS_PAID_ON_A_YEAR = 9;

function yearlyFor(monthlyPence: number): number {
  return monthlyPence * MONTHS_PAID_ON_A_YEAR;
}

/**
 * Free — funded by ads, so it has to cost less than ads bring in.
 *
 * Display advertising on an app like this brings in roughly 20–40p per active
 * user per month, and that is the number the ceiling has to sit under. Four
 * estimates a day on Haiku is at most 31 × 4 × 0.31p ≈ 38p, and the ceiling
 * stays at 20p — well below the allowance's own worst case, on purpose,
 * because the ceiling is the promise and the allowance is only the headline.
 *
 * Worth stating plainly, because the gap widened when the allowance went from
 * three a day to four: 20p buys about 2.1 estimates a day averaged over a
 * month, so somebody who really does use four every day runs out of budget
 * before the month does. That costs nothing — the ceiling is what makes this
 * tier safe — but the headline promises more than the ceiling funds, and the
 * fix for that is raising the ceiling rather than trimming the headline.
 *
 * What the free tier keeps is the diary itself, all of it: every chart, the
 * adaptive burn engine, unlimited barcode scanning, meals and recipes. What
 * it doesn't get is the AI at volume, and the extras that are worth paying
 * for.
 */
const FREE: Plan = {
  id: "free",
  name: "Free",
  pricePence: 0,
  yearlyPence: null,
  dailyEstimates: 4,
  monthlyCostCapMicros: 0.2 * POUND,
  model: config.ANTHROPIC_MODEL_FREE,
  ads: true,
  photo: false,
  recipeScan: false,
  health: false,
  weeklyReport: false,
  weeklyReview: false,
  eatingWindow: false,
  fasting: false,
  keto: false,
  measurements: false,
  progressPhotos: false,
  tagline: "The whole diary, with the AI rationed.",
  highlights: [
    "Unlimited barcode scans and food search",
    "Unlimited saved meals, recipes and re-logs",
    "Every chart, trend and target",
    "Weigh-ins, goal weight and the burn engine",
    "4 AI estimates a day",
    "Shows ads",
  ],
};

/**
 * Plus — the ordinary paid plan.
 *
 * £4.99 less VAT and Stripe's fee keeps £3.89. Photo logging moved up to Pro,
 * so the worst case here is ten *typed* estimates a day on the full model:
 * 31 × 10 × 0.36p ≈ £1.11, against a £2.00 ceiling. Worst case margin is
 * £1.89 and the realistic margin is far better, because most days are nowhere
 * near ten and most entries never reach the model at all.
 *
 * Losing photo actually put this plan the right way round. The allowance now
 * costs less than the ceiling, so it is the allowance that runs out first and
 * the ceiling is a genuine safety net rather than a smaller plan wearing a
 * bigger plan's headline. £2.00 buys about eighteen typed estimates a day,
 * comfortably past the ten anyone is sold.
 *
 * What Plus is *for* is no longer "no ads and photos". It is the set of
 * things that cost nothing to run and are worth paying for anyway: the
 * fasting timer, keto mode, measurements, progress photos, the eating-window
 * card and the weekly review — plus a quiet app and more of the AI.
 *
 * Undercuts MyFitnessPal Premium (about £15.99 a month) by a wide margin,
 * which is the point: the diary is the product, not the subscription.
 */
const PLUS: Plan = {
  id: "plus",
  name: "Plus",
  pricePence: 499,
  yearlyPence: yearlyFor(499),
  dailyEstimates: 10,
  monthlyCostCapMicros: 2 * POUND,
  model: config.ANTHROPIC_MODEL,
  ads: false,
  photo: false,
  recipeScan: false,
  health: false,
  weeklyReport: false,
  weeklyReview: true,
  eatingWindow: true,
  fasting: true,
  keto: true,
  measurements: true,
  progressPhotos: true,
  tagline: "No ads, ten estimates a day, and the tools that keep you honest.",
  highlights: [
    "Everything in Free, with no ads",
    "10 AI estimates a day",
    "Fasting timer and keto mode",
    "Body measurements and progress photos",
    "Your eating window, and the weekly review",
  ],
};

/**
 * Pro — for someone logging everything, every day.
 *
 * £9.99 less VAT and Stripe's fee keeps £7.98. Forty photo estimates a day for
 * a long month comes to about £7.54 — nearly all of it — so here the allowance
 * genuinely doesn't clear on its own, and the ceiling is doing the real work.
 *
 * At £3.50 it keeps at least £4.48 whatever anyone does: comfortably more than
 * half, which is the line the tests hold it to.
 *
 * That ceiling used to be £4.50, which was fine when the whole £9.99 arrived.
 * VAT takes a sixth of it, so the ceiling comes down with the revenue rather
 * than the margin quietly halving. Nothing a real person does changes: £3.50
 * is about 575 photo estimates in a month, roughly eighteen a day, and a diary
 * doesn't have eighteen meals in it. The allowance stays at forty because
 * "effectively unlimited" is what the plan is for.
 *
 * Photo logging lives here now rather than on Plus. It is the second most
 * expensive call the app makes, and it belongs with the first one: the ceiling
 * that funds forty typed estimates funds about eighteen photographed ones, so
 * putting photo anywhere cheaper would mean either a thinner margin or a
 * headline the ceiling can't pay for.
 */
const PRO: Plan = {
  id: "pro",
  name: "Pro",
  pricePence: 999,
  yearlyPence: yearlyFor(999),
  dailyEstimates: 40,
  monthlyCostCapMicros: 3.5 * POUND,
  model: config.ANTHROPIC_MODEL,
  ads: false,
  photo: true,
  recipeScan: true,
  health: true,
  weeklyReport: true,
  weeklyReview: true,
  eatingWindow: true,
  fasting: true,
  keto: true,
  measurements: true,
  progressPhotos: true,
  tagline: "Everything the app can do, connected to what you wear.",
  highlights: [
    "Everything in Plus",
    "40 AI estimates a day",
    "Log by photo",
    "Scan a recipe or a label into a full breakdown",
    "WHOOP and Apple Health — burn measured, not guessed",
    "The weekly report, filed to your Drive",
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
  return lens(basePlanFor(stored));
}

/**
 * The plan exactly as written in this file, with nothing laid over it.
 *
 * The admin screen needs both: what a plan currently does, and what it would
 * do if every edit were undone. Without the second there is no way to show
 * which settings someone has changed, and no way to change one back.
 */
export function basePlanFor(stored: string | null | undefined): Plan {
  return isPlanId(stored) ? PLANS[stored] : FREE;
}

export function allPlans(): Plan[] {
  return PLAN_IDS.map((id) => planFor(id));
}

/**
 * How a stored plan becomes the plan the app actually serves.
 *
 * This file is deliberately a pure data module: no database, no environment
 * beyond the config it already reads, nothing to mock in a test. But the
 * operator can now change what a tier includes without a deployment, and that
 * lives in a table.
 *
 * So rather than this file learning to read a database — which would drag
 * Prisma into every test that wants to know what Plus costs — the override
 * layer installs itself here at boot (see src/planOverrides.ts, called from
 * src/server.ts). Nothing installs it in a test, so a test sees these plans as
 * written, which is the right default: a test about pricing should be testing
 * the pricing that was reviewed, not whatever a fixture happened to leave in a
 * table.
 */
type PlanLens = (plan: Plan) => Plan;

let lens: PlanLens = (plan) => plan;

export function setPlanLens(next: PlanLens): void {
  lens = next;
}

/** Puts it back to "the plans as written". Tests use it; the app doesn't. */
export function clearPlanLens(): void {
  lens = (plan) => plan;
}
