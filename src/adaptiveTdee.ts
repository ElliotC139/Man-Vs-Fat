import { prisma } from "./db";
import { config } from "./config";
import { localDayKey } from "./matchWeek";
import { weightRate, type WeighInPoint } from "./weightStats";

/**
 * Adaptive TDEE — what this person's body is *actually* burning, learned from
 * their own data rather than assumed from a formula.
 *
 * Mifflin-St Jeor (used elsewhere as the cold-start fallback) predicts an
 * average human of a given height/weight/age. Real people deviate from it by
 * hundreds of kcal, and worse, the gap moves: metabolic adaptation means the
 * same body burns measurably less after several weeks in a deficit. A static
 * formula silently stops being true, the deficit quietly shrinks, weight loss
 * stalls, and the app keeps confidently reporting a deficit that no longer
 * exists.
 *
 * Rearranging the energy balance equation avoids all of that. Over a window:
 *
 *     intake − TDEE × days = energy stored = Δweight × KCAL_PER_KG
 *     TDEE = (intake − Δweight × KCAL_PER_KG) / days
 *
 * Everything on the right is observed, so the result tracks whatever the
 * metabolism is really doing, adaptation included.
 */

/** Energy density of body mass change. ~7700 kcal/kg is the standard figure for mixed tissue. */
const KCAL_PER_KG = 7700;

const DEFAULT_WINDOW_DAYS = 28;
const MIN_WINDOW_DAYS = 14;
const MAX_WINDOW_DAYS = 90;

/** Below this share of days logged the intake total is too incomplete to invert the equation honestly. */
const MIN_COMPLETENESS = 0.7;
/** Two weigh-ins is the arithmetic minimum; more is what makes the endpoints trustworthy. */
const MIN_WEIGH_INS = 3;

export type TdeeConfidence = "high" | "medium" | "low";

export interface AdaptiveTdee {
  kcalPerDay: number;
  confidence: TdeeConfidence;
  windowDays: number;
  daysLogged: number;
  /** Share of days in the window with at least one food entry, 0-1. */
  completeness: number;
  weighInCount: number;
  /** Weight change across the window, kg, from the fitted line. Negative = lost. */
  weightChangeKg: number;
  /**
   * Mean daily WHOOP-measured burn over the same window, when connected.
   * Present so the two independent estimates can be compared — see
   * `underLoggingKcalPerDay`.
   */
  whoopKcalPerDay: number | null;
  /**
   * How much higher WHOOP's measured burn is than the intake-and-weight
   * maths implies. A persistent positive gap almost always means intake is
   * being under-recorded rather than that the body is defying physics —
   * null when WHOOP isn't connected or the gap is within noise.
   */
  underLoggingKcalPerDay: number | null;
}

export interface AdaptiveTdeeUnavailable {
  kcalPerDay: null;
  /** Why there isn't an estimate yet, so the UI can say what's still needed. */
  reason: "no-weigh-ins" | "too-few-weigh-ins" | "too-short-a-span" | "not-enough-logging" | "no-intake";
  daysLogged: number;
  completeness: number;
  weighInCount: number;
}

export type AdaptiveTdeeResult = AdaptiveTdee | AdaptiveTdeeUnavailable;

export function isAdaptiveTdeeAvailable(result: AdaptiveTdeeResult): result is AdaptiveTdee {
  return result.kcalPerDay !== null;
}

function clampWindow(days: unknown): number {
  const n = typeof days === "string" ? parseInt(days, 10) : typeof days === "number" ? days : NaN;
  if (!Number.isFinite(n)) return DEFAULT_WINDOW_DAYS;
  return Math.min(MAX_WINDOW_DAYS, Math.max(MIN_WINDOW_DAYS, n));
}

function confidenceFor(completeness: number, spanDays: number, weighInCount: number): TdeeConfidence {
  if (completeness >= 0.9 && spanDays >= 21 && weighInCount >= 8) return "high";
  if (completeness >= 0.8 && spanDays >= 14 && weighInCount >= 5) return "medium";
  return "low";
}

export async function estimateAdaptiveTdee(userId: number, windowDaysInput?: unknown): Promise<AdaptiveTdeeResult> {
  const windowDays = clampWindow(windowDaysInput);
  const since = new Date(Date.now() - windowDays * 86_400_000);
  const sinceKey = localDayKey(since, config.TIMEZONE);

  const [entries, weighInRows, cycles] = await Promise.all([
    prisma.entry.findMany({
      where: { matchWeek: { userId }, timestamp: { gte: since }, kcal: { not: null } },
      select: { timestamp: true, kcal: true },
    }),
    prisma.weighIn.findMany({ where: { userId, date: { gte: sinceKey } }, orderBy: { date: "asc" } }),
    prisma.whoopCycle.findMany({
      where: { userId, scoreState: "SCORED", start: { gte: since }, kcalBurned: { not: null } },
      select: { start: true, kcalBurned: true },
    }),
  ]);

  const weighIns: WeighInPoint[] = weighInRows.map((w) => ({ date: w.date, weightKg: w.weightKg }));

  const kcalByDay = new Map<string, number>();
  for (const e of entries) {
    const key = localDayKey(e.timestamp, config.TIMEZONE);
    kcalByDay.set(key, (kcalByDay.get(key) ?? 0) + (e.kcal ?? 0));
  }

  const unavailable = (reason: AdaptiveTdeeUnavailable["reason"]): AdaptiveTdeeUnavailable => ({
    kcalPerDay: null,
    reason,
    daysLogged: kcalByDay.size,
    completeness: 0,
    weighInCount: weighIns.length,
  });

  if (weighIns.length === 0) return unavailable("no-weigh-ins");
  if (weighIns.length < MIN_WEIGH_INS) return unavailable("too-few-weigh-ins");

  // The measurable span runs between the first and last weigh-in, not the
  // whole requested window — energy balance can only be evaluated between two
  // actual weight measurements.
  const sortedWeighIns = [...weighIns].sort((a, b) => (a.date < b.date ? -1 : 1));
  const firstDate = sortedWeighIns[0]!.date;
  const lastDate = sortedWeighIns[sortedWeighIns.length - 1]!.date;
  const spanDays = Math.round((Date.parse(lastDate) - Date.parse(firstDate)) / 86_400_000);
  if (spanDays < MIN_WINDOW_DAYS) return unavailable("too-short-a-span");

  // Δweight comes from the regression fit rather than the raw endpoints: a
  // single water-heavy morning at either end would otherwise shift the
  // implied energy balance by thousands of kcal and wreck the estimate.
  const fit = weightRate(weighIns);
  if (!fit) return unavailable("too-short-a-span");

  // Intake across exactly that span.
  const spanDayKeys: string[] = [];
  for (let i = 0; i <= spanDays; i++) {
    spanDayKeys.push(localDayKey(new Date(Date.parse(`${firstDate}T12:00:00Z`) + i * 86_400_000), config.TIMEZONE));
  }
  const loggedValues = spanDayKeys.map((k) => kcalByDay.get(k)).filter((v): v is number => v !== undefined);
  const daysLogged = loggedValues.length;
  const completeness = daysLogged / spanDayKeys.length;

  if (daysLogged === 0) return { ...unavailable("no-intake"), completeness };
  if (completeness < MIN_COMPLETENESS) return { ...unavailable("not-enough-logging"), completeness };

  // Unlogged days are filled with the mean of the logged ones. Treating them
  // as zero would invent a huge phantom deficit and collapse the estimate;
  // this assumes a skipped day looked like a typical day, which is why
  // completeness is gated above and reported alongside the result.
  const meanLogged = loggedValues.reduce((a, b) => a + b, 0) / daysLogged;
  const totalIntake = loggedValues.reduce((a, b) => a + b, 0) + (spanDayKeys.length - daysLogged) * meanLogged;

  const weightChangeKg = fit.toKg - fit.fromKg;
  const kcalPerDay = Math.round((totalIntake - weightChangeKg * KCAL_PER_KG) / spanDayKeys.length);

  // A nonsensical result (someone logging 400 kcal/day, or a scale in the
  // wrong units) is worse than no result — better to withhold it than to
  // drive a calorie target off it.
  if (!Number.isFinite(kcalPerDay) || kcalPerDay < 800 || kcalPerDay > 8000) {
    return { ...unavailable("not-enough-logging"), completeness };
  }

  const whoopByDay = new Map<string, number>();
  for (const c of cycles) {
    const key = localDayKey(c.start, config.TIMEZONE);
    whoopByDay.set(key, (whoopByDay.get(key) ?? 0) + (c.kcalBurned ?? 0));
  }
  const whoopValues = spanDayKeys.map((k) => whoopByDay.get(k)).filter((v): v is number => v !== undefined);
  const whoopKcalPerDay = whoopValues.length >= 7 ? Math.round(whoopValues.reduce((a, b) => a + b, 0) / whoopValues.length) : null;

  // Only call it under-logging once the gap is bigger than the slop in both
  // estimates — a couple of hundred kcal either way is well within normal
  // error for a wearable and a 7700 kcal/kg constant.
  const gap = whoopKcalPerDay !== null ? whoopKcalPerDay - kcalPerDay : null;
  const underLoggingKcalPerDay = gap !== null && gap >= 250 ? Math.round(gap) : null;

  return {
    kcalPerDay,
    confidence: confidenceFor(completeness, spanDays, weighIns.length),
    windowDays: spanDayKeys.length,
    daysLogged,
    completeness: Math.round(completeness * 100) / 100,
    weighInCount: weighIns.length,
    weightChangeKg: Math.round(weightChangeKg * 100) / 100,
    whoopKcalPerDay,
    underLoggingKcalPerDay,
  };
}

