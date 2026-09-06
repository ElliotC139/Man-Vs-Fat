/**
 * Letting the learned burn move the calorie target.
 *
 * `adaptiveTdee.ts` has always worked out what this person is really burning,
 * from their own logged intake and their own weigh-ins rather than from a
 * formula about an average human. It was a number on a card. Nothing read it.
 *
 * That is the gap this closes, and it is the whole reason a static target goes
 * wrong: metabolic adaptation means the same body burns measurably less after
 * several weeks in a deficit, so a target set in week one quietly stops
 * producing the deficit it was chosen for, weight loss stalls, and the app
 * keeps confidently reporting a gap that no longer exists.
 *
 * Three rules keep this a proposal rather than an app that moves the goalposts:
 *
 *   1. **Nothing changes without being asked.** The target is a number the
 *      user owns. This produces a suggestion and a sentence explaining where
 *      it came from; only an explicit accept writes it.
 *   2. **Once a week at most.** Tied to the match week, so it arrives with the
 *      week's review rather than nagging on a Tuesday, and a week that has
 *      been answered stays answered whichever way it was answered.
 *   3. **It stays quiet unless it has something to say.** A low-confidence
 *      estimate is a guess dressed as a measurement, and a change of a few
 *      calories is noise — neither is worth interrupting anyone for.
 */

// A type-only import on purpose: adaptiveTdee.ts pulls in the config and a
// database connection, and this module is pure arithmetic and rules. Importing
// its runtime half would mean a test of those rules couldn't load without an
// environment — the same trap tests/bmrSex.test.ts was stuck in.
import type { AdaptiveTdee, AdaptiveTdeeResult } from "./adaptiveTdee";

/**
 * The energy in a kilogram of body mass. Same figure the rest of the app uses
 * to turn a weekly goal into a daily gap.
 */
const KCAL_PER_KG = 7700;

/**
 * How much the suggestion has to differ from the current target before it is
 * worth showing. Below this it is inside the noise of the estimate itself, and
 * asking someone to re-approve their target for 30 kcal would train them to
 * dismiss the card without reading it.
 */
export const MIN_MEANINGFUL_CHANGE_KCAL = 75;

/**
 * The floor a proposal will not go under, matching the Suggest button on the
 * settings screen. An adaptive estimate that has gone wrong should not be able
 * to propose starving.
 */
const MIN_TARGET_KCAL = 1200;

/** Used when no weekly goal is set, matching the settings screen's default. */
const DEFAULT_WEEKLY_GOAL_KG = 0.5;

export interface TargetReviewUser {
  dailyCalorieTarget?: number | null;
  weeklyGoalKg?: number | null;
  targetReviewedWeek?: Date | null;
}

export type TargetReviewReason =
  | "not-enough-data"
  | "low-confidence"
  | "already-answered"
  | "no-meaningful-change";

export interface TargetProposal {
  available: true;
  /** The target being proposed, in kcal. */
  proposed: number;
  /** What it is now, or null if none has ever been set. */
  current: number | null;
  /** Positive means the proposal is higher than the current target. */
  change: number | null;
  /** The learned burn the proposal is derived from. */
  tdee: number;
  confidence: "high" | "medium";
  windowDays: number;
  /** Weight change over the window, kg. Negative means lost. */
  weightChangeKg: number;
  /** The weekly goal the deficit was worked out from. */
  weeklyGoalKg: number;
}

export interface NoTargetProposal {
  available: false;
  reason: TargetReviewReason;
}

export type TargetReview = TargetProposal | NoTargetProposal;

/**
 * The daily gap that a weekly weight goal implies.
 *
 * The Suggest button on the settings screen does the same arithmetic in the
 * browser, where it can't import this — so if the figures here change, change
 * suggestTargetBtn in public/app.js with them. This file is the source of
 * truth and carries the reasoning.
 */
export function dailyDeficitFor(weeklyGoalKg: number): number {
  return Math.round((weeklyGoalKg * KCAL_PER_KG) / 7);
}

/** Burn, less the deficit the goal implies, rounded to something typeable. */
export function targetFor(tdee: number, weeklyGoalKg: number): number {
  const target = tdee - dailyDeficitFor(weeklyGoalKg);
  return Math.max(MIN_TARGET_KCAL, Math.round(target / 10) * 10);
}

/**
 * Whether this week's proposal has already been answered.
 *
 * Compared by the week's own start rather than by a timestamp, so the question
 * is asked once per match week however many times the screen is opened, and a
 * user whose rollover moves doesn't get asked twice for the same week.
 */
export function answeredThisWeek(user: TargetReviewUser, weekStartsAt: Date): boolean {
  const reviewed = user.targetReviewedWeek;
  if (!reviewed) return false;
  return reviewed.getTime() >= weekStartsAt.getTime();
}

/** The same check isAdaptiveTdeeAvailable makes, without importing it. */
function hasFigure(result: AdaptiveTdeeResult): result is AdaptiveTdee {
  return result.kcalPerDay !== null;
}

/**
 * This week's proposal, or why there isn't one.
 *
 * Deliberately pure: it takes an already-computed adaptive estimate rather
 * than fetching one, so the rules about when to speak up can be read and
 * tested without a database.
 */
export function reviewTarget(
  user: TargetReviewUser,
  adaptive: AdaptiveTdeeResult,
  weekStartsAt: Date,
): TargetReview {
  if (!hasFigure(adaptive)) return { available: false, reason: "not-enough-data" };

  // A low-confidence figure is a guess dressed as a measurement. The card
  // showing this number elsewhere already refuses to print one, and proposing
  // a target off it would be worse — it would stick.
  if (adaptive.confidence === "low") return { available: false, reason: "low-confidence" };

  if (answeredThisWeek(user, weekStartsAt)) return { available: false, reason: "already-answered" };

  const weeklyGoalKg = user.weeklyGoalKg ?? DEFAULT_WEEKLY_GOAL_KG;
  const proposed = targetFor(adaptive.kcalPerDay, weeklyGoalKg);
  const current = user.dailyCalorieTarget ?? null;
  const change = current === null ? null : proposed - current;

  // A change inside the noise isn't worth a card. No target at all is always
  // worth one — there is nothing to compare against, and offering a figure
  // beats leaving the field blank.
  if (change !== null && Math.abs(change) < MIN_MEANINGFUL_CHANGE_KCAL) {
    return { available: false, reason: "no-meaningful-change" };
  }

  return {
    available: true,
    proposed,
    current,
    change,
    tdee: Math.round(adaptive.kcalPerDay),
    confidence: adaptive.confidence,
    windowDays: adaptive.windowDays,
    weightChangeKg: adaptive.weightChangeKg,
    weeklyGoalKg,
  };
}
