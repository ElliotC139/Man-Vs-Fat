import { Router } from "express";
import { prisma } from "../db";
import { config } from "../config";
import { requireAuth } from "../auth";
import {
  getLocalParts,
  getMatchWeekBoundariesForWeeksAgo,
  matchWeekCalendarDays,
  weightedDaysLogged,
  getUserWeekStart,
  localDayKey,
  localDayLabel,
  zonedTimeToUtc,
} from "../matchWeek";
import { estimateAdaptiveTdee } from "../adaptiveTdee";
import { foodRecoveryFindings } from "../foodRecovery";
import { latestWeightKg, weightRate } from "../weightStats";
import { computeDeficitStreak, type DayVerdict } from "../deficitStreak";
import { recordError } from "../errorLog";
import { MACRO_KEYS, resolveMacroTargets, sumMacros, type MacroKey } from "../macros";
import { macroRoom, whatCanIStillEat, type WhatNowFood, type WhatNowMeal } from "../whatNow";
import { normalizeLabel } from "./foods";
import { getRecentSleepRecovery } from "../whoop/sync";

export const statsRouter = Router();
statsRouter.use(requireAuth);

const AVG_KCAL_WINDOW_DAYS = 7;
const WEIGHT_TREND_WINDOW_DAYS = 28;
const BALANCE_MIN_DAYS = 7;
const BALANCE_MAX_DAYS = 90;
const BALANCE_DEFAULT_DAYS = 30;
const BREAKDOWN_MIN_WEEKS = 4;
const BREAKDOWN_MAX_WEEKS = 26;
const BREAKDOWN_DEFAULT_WEEKS = 12;
const INSIGHT_WINDOW_DAYS = 42;
const MIN_SAMPLE_DAYS = 3;

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === "string" ? parseInt(value, 10) : NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/** Average daily calories logged over the trailing window, or null with no entries in it. */
async function avgKcalPerDay(userId: number, days = AVG_KCAL_WINDOW_DAYS): Promise<number | null> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const entries = await prisma.entry.findMany({
    where: { matchWeek: { userId }, timestamp: { gte: since }, kcal: { not: null } },
    select: { kcal: true },
  });
  if (entries.length === 0) return null;
  const total = entries.reduce((sum, e) => sum + (e.kcal ?? 0), 0);
  return Math.round(total / days);
}

const AVG_LONG_WINDOW_DAYS = 28;

/**
 * The averages the Stats screen leads with, over a trailing window.
 *
 * Burn is averaged only over days WHOOP actually scored, not over the whole
 * window — dividing by days with no cycle would quietly drag the figure
 * down every time the watch came off.
 */
async function trailingAverages(userId: number, days: number) {
  const sinceDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const sinceKey = localDayKey(sinceDate, config.TIMEZONE);

  const [cycles, recoveries, sleeps, workouts] = await Promise.all([
    prisma.whoopCycle.findMany({
      where: { userId, start: { gte: sinceDate }, kcalBurned: { not: null } },
      select: { start: true, end: true, kcalBurned: true },
    }),
    prisma.whoopRecovery.findMany({
      where: { userId, date: { gte: sinceKey }, recoveryScore: { not: null } },
      select: { recoveryScore: true },
    }),
    prisma.whoopSleep.findMany({
      where: { userId, start: { gte: sinceDate }, timeAsleepMin: { not: null } },
      select: { timeAsleepMin: true },
    }),
    prisma.exercise.findMany({ where: { matchWeek: { userId }, timestamp: { gte: sinceDate } }, select: { id: true } }),
  ]);

  const burnByDay = new Map<string, number>();
  for (const c of cycles) {
    const split = splitCycleAcrossDays(c.start, c.end ?? new Date(), c.kcalBurned ?? 0, config.TIMEZONE);
    for (const [key, kcal] of split) burnByDay.set(key, (burnByDay.get(key) ?? 0) + kcal);
  }
  // Today is still accruing, so including it would understate the average.
  const todayKey = localDayKey(new Date(), config.TIMEZONE);
  burnByDay.delete(todayKey);

  const burnDays = [...burnByDay.values()];
  const mean = (values: number[]) =>
    values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : null;

  return {
    kcalBurnedPerDay: mean(burnDays),
    recovery: mean(recoveries.map((r) => r.recoveryScore!)),
    sleepMinutes: mean(sleeps.map((sl) => sl.timeAsleepMin!)),
    workoutsPerWeek:
      workouts.length > 0 ? Math.round((workouts.length / days) * 7 * 10) / 10 : null,
  };
}

/** Projected arrival at the goal weight, extrapolating the current trend rate. */
interface GoalProjection {
  goalWeightKg: number;
  remainingKg: number;
  /** Null when the current pace never reaches the goal (flat, or moving away from it). */
  projectedDate: string | null;
  weeksRemaining: number | null;
  /** True when the trend is moving toward the goal at all. */
  movingTowardGoal: boolean;
}

function projectGoal(goalWeightKg: number, currentWeightKg: number, kgPerWeek: number): GoalProjection {
  const remainingKg = Math.round((currentWeightKg - goalWeightKg) * 100) / 100;
  const needToLose = remainingKg > 0;
  const losing = kgPerWeek < 0;
  const movingTowardGoal = Math.abs(remainingKg) > 0.05 && needToLose === losing && Math.abs(kgPerWeek) > 0.01;

  if (!movingTowardGoal) {
    return { goalWeightKg, remainingKg, projectedDate: null, weeksRemaining: null, movingTowardGoal: false };
  }

  const weeksRemaining = Math.abs(remainingKg / kgPerWeek);
  const projected = new Date(Date.now() + weeksRemaining * 7 * 86_400_000);
  return {
    goalWeightKg,
    remainingKg,
    projectedDate: localDayKey(projected, config.TIMEZONE),
    weeksRemaining: Math.round(weeksRemaining * 10) / 10,
    movingTowardGoal: true,
  };
}

statsRouter.get("/summary", async (req, res) => {
  const userId = req.userId!;
  const since = localDayKey(new Date(Date.now() - WEIGHT_TREND_WINDOW_DAYS * 24 * 60 * 60 * 1000), config.TIMEZONE);

  const [avgKcal, avgKcal28, averages, user, windowWeighIns, allWeighIns] = await Promise.all([
    avgKcalPerDay(userId),
    avgKcalPerDay(userId, AVG_LONG_WINDOW_DAYS),
    trailingAverages(userId, AVG_LONG_WINDOW_DAYS),
    prisma.user.findUnique({ where: { id: userId }, select: { weeklyGoalKg: true, goalWeightKg: true } }),
    prisma.weighIn.findMany({ where: { userId, date: { gte: since } }, orderBy: { date: "asc" } }),
    prisma.weighIn.findMany({ where: { userId }, orderBy: { date: "asc" } }),
  ]);

  // Rate is measured across the recent window (what's happening now);
  // current weight is simply the latest reading on the scale.
  const points = windowWeighIns.map((w) => ({ date: w.date, weightKg: w.weightKg }));
  const rate = weightRate(points);
  const currentWeightKg = latestWeightKg(allWeighIns.map((w) => ({ date: w.date, weightKg: w.weightKg })));

  const kgPerWeek = rate ? Math.round(rate.kgPerWeek * 100) / 100 : null;

  const weightPace =
    kgPerWeek !== null && user?.weeklyGoalKg
      ? {
          kgPerWeek,
          goalKgPerWeek: user.weeklyGoalKg,
          onTrack: kgPerWeek <= 0 && Math.abs(kgPerWeek) >= user.weeklyGoalKg * 0.9,
        }
      : null;

  const weightTrend =
    kgPerWeek !== null && currentWeightKg !== null
      ? {
          kgPerWeek,
          currentWeightKg: Math.round(currentWeightKg * 100) / 100,
          projectedWeightKg4wk: Math.round((currentWeightKg + kgPerWeek * 4) * 100) / 100,
        }
      : null;

  const goalProjection =
    user?.goalWeightKg && currentWeightKg !== null ? projectGoal(user.goalWeightKg, currentWeightKg, kgPerWeek ?? 0) : null;

  res.json({
    avgKcalPerDay: avgKcal,
    averages: {
      windowDays: AVG_LONG_WINDOW_DAYS,
      kcalInPerDay7: avgKcal,
      kcalInPerDay28: avgKcal28,
      kcalBurnedPerDay: averages.kcalBurnedPerDay,
      // Net is only meaningful when both halves came from real data.
      netKcalPerDay:
        avgKcal28 !== null && averages.kcalBurnedPerDay !== null ? avgKcal28 - averages.kcalBurnedPerDay : null,
      recovery: averages.recovery,
      sleepMinutes: averages.sleepMinutes,
      workoutsPerWeek: averages.workoutsPerWeek,
      kgPerWeek,
    },
    weightPace,
    weightTrend,
    goalProjection,
  });
});

// ── Adaptive TDEE ──────────────────────────────────────────────────────────

statsRouter.get("/tdee", async (req, res) => {
  res.json(await estimateAdaptiveTdee(req.userId!, req.query.days));
});

// ── Calorie balance trend ───────────────────────────────────────────────────

// Mifflin-St Jeor's final term depends on sex: +5 for men, -161 for women, a
// 166 kcal/day gap. The app hardcoded +5, so every woman's burn came out 166
// too high — a generous target, verdicts that read better than the week
// really went, and slower loss than the projection promised.
//
// An unset value takes the midpoint rather than either constant. It is wrong
// by 83 for everyone instead of wrong by 166 for half of them, and nobody
// should have to answer this to use a food diary.
const SEX_CONSTANTS = { male: 5, female: -161 } as const;
const SEX_CONSTANT_UNKNOWN = (SEX_CONSTANTS.male + SEX_CONSTANTS.female) / 2;

export function sexConstant(sex: string | null | undefined): number {
  if (sex === "male" || sex === "female") return SEX_CONSTANTS[sex];
  return SEX_CONSTANT_UNKNOWN;
}

// Mirrors the estimate used client-side for the current week's budget widget
// (public/app.js: calculateTdee) — used here as the "calories out" fallback
// for historical days with no scored WHOOP cycle.
function estimateTdee(user: {
  weightKg: number | null;
  heightCm: number | null;
  ageYears: number | null;
  activityLevel: string | null;
  sex?: string | null;
}): number | null {
  const { weightKg, heightCm, ageYears, activityLevel } = user;
  if (!weightKg || !heightCm || !ageYears || !activityLevel) return null;
  const bmr = 10 * weightKg + 6.25 * heightCm - 5 * ageYears + sexConstant(user.sex);
  const multipliers: Record<string, number> = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725 };
  return bmr * (multipliers[activityLevel] ?? 1.2);
}

/**
 * Splits a span of kcal burned proportionally across the local calendar
 * days it overlaps, by wall-clock duration in each day. A same-day cycle
 * (the common case) just returns its full kcalBurned under its one day.
 */
function splitCycleAcrossDays(start: Date, end: Date, kcalBurned: number, timeZone: string): Map<string, number> {
  const result = new Map<string, number>();
  const totalMs = end.getTime() - start.getTime();
  if (totalMs <= 0) {
    result.set(localDayKey(start, timeZone), kcalBurned);
    return result;
  }

  let cursor = start;
  while (cursor.getTime() < end.getTime()) {
    const key = localDayKey(cursor, timeZone);
    const { year, month, day } = getLocalParts(cursor, timeZone);
    const nextDayStart = zonedTimeToUtc(year, month, day + 1, 0, 0, timeZone);
    const segmentEnd = nextDayStart.getTime() < end.getTime() ? nextDayStart : end;
    const overlapMs = segmentEnd.getTime() - cursor.getTime();
    result.set(key, (result.get(key) ?? 0) + kcalBurned * (overlapMs / totalMs));
    cursor = segmentEnd;
  }
  return result;
}

statsRouter.get("/balance", async (req, res) => {
  const userId = req.userId!;
  const days = clampInt(req.query.days, BALANCE_MIN_DAYS, BALANCE_MAX_DAYS, BALANCE_DEFAULT_DAYS);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const [user, entries, cycles] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { weightKg: true, heightCm: true, ageYears: true, activityLevel: true },
    }),
    prisma.entry.findMany({
      where: { matchWeek: { userId }, timestamp: { gte: since }, kcal: { not: null } },
      select: { timestamp: true, kcal: true },
    }),
    prisma.whoopCycle.findMany({
      // A 2-day buffer before `since` catches a cycle that started just
      // before the window but overlaps into it — see splitCycleAcrossDays
      // below, which needs the cycle's real start to split it correctly.
      where: {
        userId,
        scoreState: "SCORED",
        start: { gte: new Date(since.getTime() - 2 * 24 * 60 * 60 * 1000) },
        kcalBurned: { not: null },
      },
      select: { start: true, end: true, kcalBurned: true },
    }),
  ]);

  const kcalInByDay = new Map<string, number>();
  for (const e of entries) {
    const key = localDayKey(e.timestamp, config.TIMEZONE);
    kcalInByDay.set(key, (kcalInByDay.get(key) ?? 0) + (e.kcal ?? 0));
  }
  const kcalOutByDay = new Map<string, number>();
  for (const c of cycles) {
    // A cycle spans wake-to-wake and is occasionally much longer than 24h
    // (irregular sleep, a nap that started a new cycle) — crediting all of
    // its kcalBurned to its start day alone can massively overstate that
    // one day while leaving the days it actually ran through empty.
    // Splitting proportionally by how long the cycle actually overlaps
    // each calendar day gives a realistic per-day burn instead.
    const split = splitCycleAcrossDays(c.start, c.end ?? new Date(), c.kcalBurned ?? 0, config.TIMEZONE);
    for (const [key, kcal] of split) kcalOutByDay.set(key, (kcalOutByDay.get(key) ?? 0) + kcal);
  }
  const tdee = estimateTdee(user ?? { weightKg: null, heightCm: null, ageYears: null, activityLevel: null, sex: null });

  const result: {
    date: string;
    kcalIn: number | null;
    kcalOut: number | null;
    kcalOutSource: "whoop" | "estimated" | null;
    balance: number | null;
  }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const key = localDayKey(new Date(Date.now() - i * 24 * 60 * 60 * 1000), config.TIMEZONE);
    const kcalIn = kcalInByDay.get(key) ?? null;
    const whoopOut = kcalOutByDay.get(key);
    const kcalOut = whoopOut ?? tdee ?? null;
    const kcalOutSource: "whoop" | "estimated" | null = whoopOut != null ? "whoop" : tdee != null ? "estimated" : null;
    result.push({
      date: key,
      kcalIn,
      kcalOut: kcalOut != null ? Math.round(kcalOut) : null,
      kcalOutSource,
      balance: kcalIn != null && kcalOut != null ? Math.round(kcalIn - kcalOut) : null,
    });
  }

  res.json({ days: result });
});

// ── Weekly/monthly breakdown ────────────────────────────────────────────────
// Buckets by the user's own configured match week (see matchWeek.ts) rather
// than plain calendar weeks, so this lines up with the week boundaries used
// everywhere else in the app (budget widget, weekly report).

statsRouter.get("/weekly-breakdown", async (req, res) => {
  const userId = req.userId!;
  const weeks = clampInt(req.query.weeks, BREAKDOWN_MIN_WEEKS, BREAKDOWN_MAX_WEEKS, BREAKDOWN_DEFAULT_WEEKS);

  const weekStartConfig = await getUserWeekStart(userId);
  const now = new Date();
  const boundaries = Array.from({ length: weeks }, (_, i) =>
    getMatchWeekBoundariesForWeeksAgo(now, weeks - 1 - i, config.TIMEZONE, weekStartConfig),
  );
  const rangeStart = boundaries[0]!.start;

  const [entries, weighIns, workouts, recoveries, sleeps] = await Promise.all([
    prisma.entry.findMany({
      where: { matchWeek: { userId }, timestamp: { gte: rangeStart }, kcal: { not: null } },
      select: { timestamp: true, kcal: true },
    }),
    prisma.weighIn.findMany({
      where: { userId, date: { gte: localDayKey(rangeStart, config.TIMEZONE) } },
      orderBy: { date: "asc" },
    }),
    prisma.exercise.findMany({
      where: { matchWeek: { userId }, timestamp: { gte: rangeStart } },
      select: { timestamp: true },
    }),
    prisma.whoopRecovery.findMany({
      where: { userId, date: { gte: localDayKey(rangeStart, config.TIMEZONE) }, recoveryScore: { not: null } },
      select: { date: true, recoveryScore: true },
    }),
    prisma.whoopSleep.findMany({
      where: { userId, start: { gte: rangeStart }, timeAsleepMin: { not: null } },
      select: { start: true, timeAsleepMin: true, performancePercent: true },
    }),
  ]);

  // Carry the most recent weigh-in on/before a given boundary forward, so a
  // week with no weigh-in of its own still gets a sensible "weight as of
  // this week" for the week-over-week delta below.
  function weightAsOf(dateKey: string): number | null {
    let latest: number | null = null;
    for (const w of weighIns) {
      if (w.date <= dateKey) latest = w.weightKg;
      else break;
    }
    return latest;
  }

  // No weigh-ins before rangeStart are loaded, so the first week in the
  // range has nothing to diff against — its weightChangeKg comes out null,
  // which is correct: there's no "previous week" in view yet.
  let previousWeekEndWeight: number | null = null;

  const result = boundaries.map(({ start, end }) => {
    const startKey = localDayKey(start, config.TIMEZONE);
    const endMs = Math.min(end.getTime(), now.getTime());
    const daysElapsed = Math.max(1, Math.min(7, Math.round((endMs - start.getTime()) / (24 * 60 * 60 * 1000))));

    const entriesThisWeek = entries.filter(
      (e) => e.timestamp.getTime() >= start.getTime() && e.timestamp.getTime() < end.getTime(),
    );
    const weekKcal = entriesThisWeek.reduce((sum, e) => sum + (e.kcal ?? 0), 0);
    const avgKcalPerDayThisWeek = weekKcal > 0 ? Math.round(weekKcal / daysElapsed) : null;
    // A match week spans 8 calendar days, because it starts and ends
    // mid-Monday — so the two boundary days are half a day each. Counting
    // distinct calendar days would report "8 of 7".
    const daysWithEntries = weightedDaysLogged(
      new Set(entriesThisWeek.map((e) => localDayKey(e.timestamp, config.TIMEZONE))),
      start,
      config.TIMEZONE,
    );

    const workoutCount = workouts.filter(
      (w) => w.timestamp.getTime() >= start.getTime() && w.timestamp.getTime() < end.getTime(),
    ).length;

    const endKey = localDayKey(new Date(Math.min(end.getTime() - 1, now.getTime())), config.TIMEZONE);
    const recoveryScores = recoveries
      .filter((r) => r.date >= startKey && r.date <= endKey)
      .map((r) => r.recoveryScore!);
    const avgRecovery = recoveryScores.length
      ? Math.round(recoveryScores.reduce((a, b) => a + b, 0) / recoveryScores.length)
      : null;

    const sleepsThisWeek = sleeps.filter(
      (sl) => sl.start.getTime() >= start.getTime() && sl.start.getTime() < end.getTime(),
    );
    const avgSleepMinutes = sleepsThisWeek.length
      ? Math.round(sleepsThisWeek.reduce((a, sl) => a + (sl.timeAsleepMin ?? 0), 0) / sleepsThisWeek.length)
      : null;
    const scoredSleeps = sleepsThisWeek.filter((sl) => sl.performancePercent !== null);
    const avgSleepPerformance = scoredSleeps.length
      ? Math.round(scoredSleeps.reduce((a, sl) => a + (sl.performancePercent ?? 0), 0) / scoredSleeps.length)
      : null;

    // Only a week that was actually weighed in gets a change. Carrying the
    // last known weight forward would report a confident 0.0kg for a week
    // nobody stepped on the scales in, which reads as "no progress" rather
    // than "no data".
    const weighedThisWeek = weighIns.some((w) => w.date >= startKey && w.date <= endKey);
    const weightNow = weighedThisWeek ? weightAsOf(endKey) : null;
    const weightChangeKg =
      weightNow !== null && previousWeekEndWeight !== null ? Math.round((weightNow - previousWeekEndWeight) * 100) / 100 : null;
    previousWeekEndWeight = weightNow ?? previousWeekEndWeight;

    return {
      weekStart: startKey,
      weekEnd: endKey,
      avgKcalPerDay: avgKcalPerDayThisWeek,
      daysWithEntries,
      weightChangeKg,
      workoutCount,
      avgRecovery,
      avgSleepMinutes,
      avgSleepPerformance,
    };
  });

  res.json({ weeks: result });
});

/**
 * The individual days behind one row of a weekly table, so a week that looks
 * wrong can be opened up rather than just wondered about.
 *
 * Keyed by the week's start day rather than an index, so a row stays
 * addressable after the range around it changes.
 */
statsRouter.get("/week-days", async (req, res) => {
  const userId = req.userId!;
  const weekStartKey = typeof req.query.weekStart === "string" ? req.query.weekStart : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStartKey)) {
    res.status(400).json({ error: "weekStart must be a YYYY-MM-DD date." });
    return;
  }

  const weekStartConfig = await getUserWeekStart(userId);
  const now = new Date();

  // Find the match week whose start day matches, by walking back from now —
  // cheaper and less error-prone than reconstructing a boundary from a bare
  // date that might not be a real week start at all.
  let found: { start: Date; end: Date } | null = null;
  for (let weeksAgo = 0; weeksAgo <= BREAKDOWN_MAX_WEEKS; weeksAgo++) {
    const boundary = getMatchWeekBoundariesForWeeksAgo(now, weeksAgo, config.TIMEZONE, weekStartConfig);
    if (localDayKey(boundary.start, config.TIMEZONE) === weekStartKey) {
      found = boundary;
      break;
    }
  }
  if (!found) {
    res.status(404).json({ error: "No match week starts on that date." });
    return;
  }
  const { start, end } = found;
  const endKey = localDayKey(new Date(end.getTime() - 1), config.TIMEZONE);

  const [entries, weighIns, workouts, recoveries, sleeps, cycles] = await Promise.all([
    prisma.entry.findMany({
      where: { matchWeek: { userId }, timestamp: { gte: start, lt: end } },
      select: { timestamp: true, kcal: true },
    }),
    prisma.weighIn.findMany({ where: { userId, date: { gte: weekStartKey, lte: endKey } } }),
    prisma.exercise.findMany({
      where: { matchWeek: { userId }, timestamp: { gte: start, lt: end } },
      select: { timestamp: true, kcalBurned: true },
    }),
    prisma.whoopRecovery.findMany({
      where: { userId, date: { gte: weekStartKey, lte: endKey } },
      select: { date: true, recoveryScore: true },
    }),
    prisma.whoopSleep.findMany({
      where: { userId, start: { gte: start, lt: end } },
      select: { start: true, timeAsleepMin: true, performancePercent: true },
    }),
    // Widened, because a cycle that began before the week can still spill
    // calories into its first day — see splitCycleAcrossDays.
    prisma.whoopCycle.findMany({
      where: { userId, start: { gte: new Date(start.getTime() - 2 * 86_400_000), lt: end }, kcalBurned: { not: null } },
      select: { start: true, end: true, kcalBurned: true },
    }),
  ]);

  const kcalInByDay = new Map<string, number>();
  for (const e of entries) {
    const key = localDayKey(e.timestamp, config.TIMEZONE);
    kcalInByDay.set(key, (kcalInByDay.get(key) ?? 0) + (e.kcal ?? 0));
  }
  const loggedDays = new Set(entries.map((e) => localDayKey(e.timestamp, config.TIMEZONE)));

  const kcalOutByDay = new Map<string, number>();
  for (const c of cycles) {
    const split = splitCycleAcrossDays(c.start, c.end ?? now, c.kcalBurned ?? 0, config.TIMEZONE);
    for (const [key, kcal] of split) kcalOutByDay.set(key, (kcalOutByDay.get(key) ?? 0) + kcal);
  }

  const workoutsByDay = new Map<string, number>();
  for (const w of workouts) {
    const key = localDayKey(w.timestamp, config.TIMEZONE);
    workoutsByDay.set(key, (workoutsByDay.get(key) ?? 0) + 1);
  }

  const weightByDay = new Map(weighIns.map((w) => [w.date, w.weightKg]));
  const recoveryByDay = new Map(recoveries.map((r) => [r.date, r.recoveryScore]));
  const sleepByDay = new Map<string, { minutes: number | null; performance: number | null }>();
  for (const sl of sleeps) {
    sleepByDay.set(localDayKey(sl.start, config.TIMEZONE), {
      minutes: sl.timeAsleepMin,
      performance: sl.performancePercent,
    });
  }

  const todayKey = localDayKey(now, config.TIMEZONE);
  const calendarDays = matchWeekCalendarDays(start, config.TIMEZONE);

  const days = calendarDays
    // Days the week hasn't reached yet are simply absent, rather than shown
    // as a row of dashes.
    .filter((key) => key <= todayKey)
    .map((key, index) => {
      const kcalIn = kcalInByDay.get(key) ?? null;
      const kcalOut = kcalOutByDay.get(key);
      const sleep = sleepByDay.get(key) ?? { minutes: null, performance: null };
      return {
        date: key,
        // The two boundary days are half a day of this week each, which is
        // why the week's "days logged" total isn't a whole number.
        partial: index === 0 || index === calendarDays.length - 1,
        kcalIn,
        kcalOut: kcalOut != null ? Math.round(kcalOut) : null,
        logged: loggedDays.has(key),
        weightKg: weightByDay.get(key) ?? null,
        recoveryScore: recoveryByDay.get(key) ?? null,
        sleepMinutes: sleep.minutes,
        sleepPerformance: sleep.performance,
        workoutCount: workoutsByDay.get(key) ?? 0,
      };
    });

  res.json({ weekStart: weekStartKey, weekEnd: endKey, days });
});

/**
 * Consecutive days finishing under your burn — the current run and the best
 * one on record.
 *
 * Built from raw entries grouped by local calendar day, deliberately never
 * from match weeks: a match week's day list carries a Monday at both ends,
 * so walking weeks would judge each half of a Monday separately against a
 * whole day's burn. Grouping by calendar day puts both halves of a Monday
 * in one bucket, judged once, as the single day it is.
 */
statsRouter.get("/deficit-streak", async (req, res) => {
  const userId = req.userId!;

  const [user, firstEntry, entries, cycles] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { weightKg: true, heightCm: true, ageYears: true, activityLevel: true },
    }),
    prisma.entry.findFirst({
      where: { matchWeek: { userId }, kcal: { not: null } },
      orderBy: { timestamp: "asc" },
      select: { timestamp: true },
    }),
    prisma.entry.findMany({
      where: { matchWeek: { userId }, kcal: { not: null } },
      select: { timestamp: true, kcal: true },
    }),
    prisma.whoopCycle.findMany({
      where: { userId, scoreState: "SCORED", kcalBurned: { not: null } },
      select: { start: true, end: true, kcalBurned: true },
    }),
  ]);

  if (!firstEntry) {
    res.json({ current: 0, currentStartDate: null, best: null, judgedDays: 0 });
    return;
  }

  const kcalInByDay = new Map<string, number>();
  for (const e of entries) {
    const key = localDayKey(e.timestamp, config.TIMEZONE);
    kcalInByDay.set(key, (kcalInByDay.get(key) ?? 0) + (e.kcal ?? 0));
  }

  const kcalOutByDay = new Map<string, number>();
  for (const c of cycles) {
    const split = splitCycleAcrossDays(c.start, c.end ?? new Date(), c.kcalBurned ?? 0, config.TIMEZONE);
    for (const [key, kcal] of split) kcalOutByDay.set(key, (kcalOutByDay.get(key) ?? 0) + kcal);
  }

  const estimated = estimateTdee(user ?? { weightKg: null, heightCm: null, ageYears: null, activityLevel: null, sex: null });

  // Today is still running, so it can't be called yet — a day that's in
  // deficit at lunchtime often isn't by bedtime. It joins the streak once
  // it's over.
  const todayKey = localDayKey(new Date(), config.TIMEZONE);

  // Every calendar day from the first entry to yesterday, including the
  // ones with nothing logged: a gap has to appear as an unjudgeable day so
  // the runs either side of it don't weld together.
  const verdicts: DayVerdict[] = [];
  const cursor = new Date(firstEntry.timestamp);
  cursor.setUTCHours(12, 0, 0, 0);
  for (let guard = 0; guard < 4000; guard++) {
    const key = localDayKey(cursor, config.TIMEZONE);
    if (key >= todayKey) break;

    const kcalIn = kcalInByDay.get(key);
    const kcalOut = kcalOutByDay.get(key) ?? estimated;
    verdicts.push({
      date: key,
      // Nothing logged, or no burn figure to judge against, means no
      // verdict — not a free pass.
      deficit: kcalIn == null || kcalOut == null ? null : kcalIn < kcalOut,
    });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  res.json(computeDeficitStreak(verdicts));
});

// ── Today ────────────────────────────────────────────────────────────────
//
// Everything the Today screen shows, in one call. Deliberately one endpoint
// rather than the five it would otherwise take: this is the screen the app
// opens on, and five round trips means five chances to render half a page.
//
// Independent of the week paging on purpose — Today is always today, whatever
// week the diary happens to be looking at.

const TODAY_AVERAGE_WINDOW_DAYS = 7;

statsRouter.get("/today", async (req, res) => {
  const userId = req.userId!;
  const now = new Date();
  const todayKey = localDayKey(now, config.TIMEZONE);

  // ?date lets the screen step back through earlier days. Anything unparseable
  // or in the future falls back to today rather than erroring — a stale link
  // should still show something useful.
  const asked = typeof req.query.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(req.query.date)
    ? req.query.date
    : todayKey;
  const dayKey = asked > todayKey ? todayKey : asked;
  const isToday = dayKey === todayKey;

  // Midday in the local zone, so the instant lands inside the day being asked
  // for whatever the offset and whichever side of a DST change it falls.
  const [y, m, d] = dayKey.split("-").map(Number) as [number, number, number];
  const subject = isToday ? now : zonedTimeToUtc(y, m, d, 12, 0, config.TIMEZONE);

  // The day is read as a span of time, not as a slice of one match week. On a
  // rollover day the two are not the same thing: with a Monday 17:00 start,
  // Monday's food before 17:00 belongs to the week that is ending and the rest
  // to the week beginning, so no single week holds the whole day.
  const [ny, nm, nd] = shiftDayKey(dayKey, 1).split("-").map(Number) as [number, number, number];
  const dayStart = zonedTimeToUtc(y, m, d, 0, 0, config.TIMEZONE);
  const dayEnd = zonedTimeToUtc(ny, nm, nd, 0, 0, config.TIMEZONE);
  const trailingSince = new Date(subject.getTime() - TODAY_AVERAGE_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const [user, entriesToday, exercisesToday, trailingEntries, water, note, whoopRecent, cycles] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId } }),
    prisma.entry.findMany({
      where: { matchWeek: { userId }, timestamp: { gte: dayStart, lt: dayEnd } },
      orderBy: { timestamp: "asc" },
    }),
    prisma.exercise.findMany({
      where: { matchWeek: { userId }, timestamp: { gte: dayStart, lt: dayEnd } },
      orderBy: { timestamp: "asc" },
    }),
    prisma.entry.findMany({
      where: { matchWeek: { userId }, timestamp: { gte: trailingSince }, kcal: { not: null } },
      select: { timestamp: true, kcal: true },
    }),
    prisma.waterLog.findUnique({ where: { userId_date: { userId, date: dayKey } } }),
    prisma.dayNote.findUnique({ where: { userId_date: { userId, date: dayKey } } }),
    // Reaches back far enough to cover the day being shown, not just today.
    getRecentSleepRecovery(userId, daysBetweenKeys(dayKey, todayKey) + 2).catch(() => []),
    prisma.whoopCycle.findMany({
      where: { userId, scoreState: "SCORED", kcalBurned: { not: null }, start: { gte: trailingSince } },
      select: { start: true, end: true, kcalBurned: true },
    }),
  ]);

  const eaten = entriesToday.reduce((sum, entry) => sum + (entry.kcal ?? 0), 0);
  const pending = entriesToday.filter((entry) => entry.kcal === null).length;

  // Measured burn for today, if a tracker has scored any of it. Part-days are
  // normal here — the cycle covering right now is still open.
  const burnByDay = new Map<string, number>();
  for (const cycle of cycles) {
    const split = splitCycleAcrossDays(cycle.start, cycle.end ?? now, cycle.kcalBurned ?? 0, config.TIMEZONE);
    for (const [key, kcal] of split) burnByDay.set(key, (burnByDay.get(key) ?? 0) + kcal);
  }
  const measuredBurn = burnByDay.get(dayKey) ?? null;

  // Same order of authority the diary uses: measured, then the user's own
  // target, then a formula. See dailyReference() in public/app.js.
  const target = user?.dailyCalorieTarget ?? null;
  const estimated = estimateTdee(user ?? { weightKg: null, heightCm: null, ageYears: null, activityLevel: null, sex: null });
  const reference = target !== null
    ? { kcal: target, source: "target" as const }
    : estimated !== null
      ? { kcal: estimated, source: "estimate" as const }
      : null;

  const macroTargets = user ? resolveMacroTargets(user) : null;
  const macrosEaten = sumMacros(entriesToday);

  // What a normal day looks like, for the "ahead of / behind your usual"
  // read. Excludes today itself, which is only part-finished.
  const trailingByDay = new Map<string, number>();
  for (const entry of trailingEntries) {
    const key = localDayKey(entry.timestamp, config.TIMEZONE);
    if (key === dayKey) continue;
    trailingByDay.set(key, (trailingByDay.get(key) ?? 0) + (entry.kcal ?? 0));
  }
  const trailingDays = [...trailingByDay.values()];
  const trailingAverage = trailingDays.length === 0
    ? null
    : Math.round(trailingDays.reduce((a, b) => a + b, 0) / trailingDays.length);

  const today = whoopRecent.find((day) => day.date === dayKey) ?? null;

  res.json({
    date: dayKey,
    isToday,
    // The day before this one always exists; the day after only when the day
    // being shown isn't today, so the screen can't be stepped into the future.
    previousDate: shiftDayKey(dayKey, -1),
    nextDate: isToday ? null : shiftDayKey(dayKey, 1),
    label: localDayLabel(subject, config.TIMEZONE),
    kcal: {
      eaten,
      pendingEntries: pending,
      target,
      remaining: target === null ? null : target - eaten,
      measuredBurn: measuredBurn === null ? null : Math.round(measuredBurn),
      reference: reference?.kcal ?? null,
      referenceSource: reference?.source ?? null,
      exerciseKcal: exercisesToday.reduce((sum, exercise) => sum + (exercise.kcalBurned ?? 0), 0),
      trailingAverage,
    },
    macros: {
      targets: macroTargets,
      eaten: {
        protein: macrosEaten.protein,
        carbs: macrosEaten.carbs,
        fat: macrosEaten.fat,
        unknownEntries: macrosEaten.unknownEntries,
      },
    },
    entries: entriesToday,
    exercises: exercisesToday.map(({ whoopWorkoutId, ...rest }) => ({ ...rest, fromWhoop: whoopWorkoutId !== null })),
    waterMl: water?.ml ?? 0,
    note: note?.note ?? null,
    whoop: {
      connected: whoopRecent.length > 0,
      recoveryScore: today?.recoveryScore ?? null,
      sleepMinutes: today?.sleepMinutes ?? null,
      sleepPerformance: today?.sleepPerformance ?? null,
    },
    insights: todayInsights({
      eaten,
      target,
      trailingAverage,
      macroTargets,
      macrosEaten,
      recoveryScore: today?.recoveryScore ?? null,
      sleepMinutes: today?.sleepMinutes ?? null,
      loggedCount: entriesToday.length,
    }),
  });
});

// ── What can I still eat? ────────────────────────────────────────────────
//
// The arithmetic of "I've got 640 kcal and 48g of protein left, so what
// fits?" done from the user's own library rather than left in their head.
// Always about today: the question doesn't mean anything about a day that's
// already finished, so this takes no ?date and the Today screen hides the
// card when it's paged back.

statsRouter.get("/what-now", async (req, res) => {
  const userId = req.userId!;
  const now = new Date();
  const dayKey = localDayKey(now, config.TIMEZONE);

  const [y, m, d] = dayKey.split("-").map(Number) as [number, number, number];
  const [ny, nm, nd] = shiftDayKey(dayKey, 1).split("-").map(Number) as [number, number, number];
  const dayStart = zonedTimeToUtc(y, m, d, 0, 0, config.TIMEZONE);
  const dayEnd = zonedTimeToUtc(ny, nm, nd, 0, 0, config.TIMEZONE);

  const [user, entriesToday, libraryEntries, overrides, meals] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId } }),
    prisma.entry.findMany({
      where: { matchWeek: { userId }, timestamp: { gte: dayStart, lt: dayEnd } },
      select: { kcal: true, proteinG: true, carbsG: true, fatG: true },
    }),
    prisma.entry.findMany({
      where: { matchWeek: { userId } },
      orderBy: { timestamp: "desc" },
      select: { label: true, kcal: true, proteinG: true, carbsG: true, fatG: true },
    }),
    prisma.foodOverride.findMany({ where: { userId } }),
    prisma.savedMeal.findMany({ where: { userId }, include: { items: true } }),
  ]);

  // Same order of authority as the Today card: the user's own target first,
  // then a formula. Without either there's no "remaining" to report.
  const target = user?.dailyCalorieTarget ?? null;
  const estimated = estimateTdee(user ?? { weightKg: null, heightCm: null, ageYears: null, activityLevel: null, sex: null });
  const reference = target ?? (estimated === null ? null : Math.round(estimated));

  const eatenKcal = entriesToday.reduce((sum, entry) => sum + (entry.kcal ?? 0), 0);
  const remainingKcal = reference === null ? null : reference - eatenKcal;

  const macroTargets = user ? resolveMacroTargets(user) : null;
  const eatenMacros = sumMacros(entriesToday);
  const rooms = macroRoom(macroTargets, {
    protein: eatenMacros.protein,
    carbs: eatenMacros.carbs,
    fat: eatenMacros.fat,
  });

  // The library, aggregated exactly as GET /api/foods does it: one row per
  // distinct food, newest logging of it supplying the figures, then any
  // correction laid over the top.
  const overrideByKey = new Map(overrides.map((o) => [o.labelKey, o]));
  const byKey = new Map<string, WhatNowFood>();
  for (const entry of libraryEntries) {
    const labelKey = normalizeLabel(entry.label);
    if (!labelKey) continue;
    const existing = byKey.get(labelKey);
    if (existing) {
      existing.count += 1;
      continue;
    }
    byKey.set(labelKey, {
      labelKey,
      label: entry.label.trim(),
      kcal: entry.kcal ?? 0,
      proteinG: entry.proteinG,
      carbsG: entry.carbsG,
      fatG: entry.fatG,
      count: 1,
    });
  }
  const foods = [...byKey.values()].map((food) => {
    const fix = overrideByKey.get(food.labelKey);
    if (!fix) return food;
    return {
      ...food,
      label: fix.label,
      kcal: fix.kcal ?? 0,
      proteinG: fix.proteinG,
      carbsG: fix.carbsG,
      fatG: fix.fatG,
    };
  });

  // Meals are costed per serving, which is the unit the "log it" button uses.
  // A meal with any un-costed ingredient reports no total at all rather than
  // one that quietly omits it, so it can't be offered here either.
  const mealCandidates: WhatNowMeal[] = [];
  for (const meal of meals) {
    if (meal.items.length === 0 || meal.items.some((item) => item.kcal === null)) continue;
    const servings = meal.servings > 0 ? meal.servings : 1;
    const totals = sumMacros(meal.items);
    const complete = totals.unknownEntries === 0;
    mealCandidates.push({
      id: meal.id,
      name: meal.name,
      kind: meal.kind,
      kcal: Math.round(meal.items.reduce((sum, item) => sum + (item.kcal ?? 0), 0) / servings),
      proteinG: complete ? Math.round((totals.protein / servings) * 10) / 10 : null,
      carbsG: complete ? Math.round((totals.carbs / servings) * 10) / 10 : null,
      fatG: complete ? Math.round((totals.fat / servings) * 10) / 10 : null,
    });
  }

  const result = whatCanIStillEat({ remainingKcal, rooms, foods, meals: mealCandidates });

  res.json({
    date: dayKey,
    referenceKcal: reference,
    referenceSource: target !== null ? "target" : reference === null ? null : "estimate",
    eatenKcal,
    ...result,
  });
});

/**
 * A short read on the day so far.
 *
 * Observations only — same rule the estimator prompt has always carried: this
 * says what the numbers are, never what to do about them. Each one is gated
 * on having the data behind it, so a day with nothing logged and no tracker
 * produces an empty list rather than filler.
 */
function todayInsights(input: {
  eaten: number;
  target: number | null;
  trailingAverage: number | null;
  macroTargets: ReturnType<typeof resolveMacroTargets>;
  macrosEaten: ReturnType<typeof sumMacros>;
  recoveryScore: number | null;
  sleepMinutes: number | null;
  loggedCount: number;
}): Insight[] {
  const insights: Insight[] = [];

  if (input.loggedCount === 0) return insights;

  if (input.trailingAverage !== null && input.trailingAverage > 0) {
    const diff = input.eaten - input.trailingAverage;
    const pct = Math.round((Math.abs(diff) / input.trailingAverage) * 100);
    if (pct >= 10) {
      insights.push({
        id: "vs-usual",
        text: `You're ${pct}% ${diff > 0 ? "above" : "below"} your usual day at this point — ${input.eaten.toLocaleString()} logged against a ${input.trailingAverage.toLocaleString()} average.`,
      });
    }
  }

  // The macro most likely to need attention: the floor furthest from being
  // met. Only floors, because a ceiling you're under needs nothing said.
  if (input.macroTargets) {
    let worst: { key: MacroKey; short: number } | null = null;
    for (const key of MACRO_KEYS) {
      const target = input.macroTargets.targets[key];
      if (!target || target.op !== "min") continue;
      const short = target.grams - input.macrosEaten[key];
      if (short > 0 && (worst === null || short > worst.short)) worst = { key, short };
    }
    if (worst) {
      insights.push({
        id: "macro-floor",
        text: `${Math.round(worst.short)}g of ${worst.key} still to go today.`,
      });
    }
  }

  if (input.recoveryScore !== null) {
    insights.push({
      id: "recovery",
      text: `WHOOP has you at ${input.recoveryScore}% recovered today${
        input.sleepMinutes ? `, on ${(input.sleepMinutes / 60).toFixed(1)}h of sleep` : ""
      }.`,
    });
  }

  return insights;
}

// ── Macros ───────────────────────────────────────────────────────────────
//
// Trailing averages per day, plus how well the days actually match the
// targets. Averaged over days *with macro data*, not all logged days:
// including the pre-macro back catalogue as zeroes would put the average on
// the floor and keep it there for weeks.

const MACRO_DEFAULT_DAYS = 7;
const MACRO_MIN_DAYS = 3;
const MACRO_MAX_DAYS = 90;

statsRouter.get("/macros", async (req, res) => {
  const userId = req.userId!;
  const days = clampInt(req.query.days, MACRO_MIN_DAYS, MACRO_MAX_DAYS, MACRO_DEFAULT_DAYS);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const [user, entries] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId } }),
    prisma.entry.findMany({
      where: { matchWeek: { userId }, timestamp: { gte: since } },
      select: { timestamp: true, kcal: true, proteinG: true, carbsG: true, fatG: true },
    }),
  ]);

  const targets = user ? resolveMacroTargets(user) : null;

  const byDay = new Map<string, typeof entries>();
  for (const entry of entries) {
    const key = localDayKey(entry.timestamp, config.TIMEZONE);
    const list = byDay.get(key) ?? [];
    list.push(entry);
    byDay.set(key, list);
  }

  const dayRows = [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, dayEntries]) => {
      const totals = sumMacros(dayEntries);
      return {
        date,
        kcal: dayEntries.reduce((sum, e) => sum + (e.kcal ?? 0), 0),
        protein: totals.protein,
        carbs: totals.carbs,
        fat: totals.fat,
        // A day is only comparable against a target once every entry on it
        // has macros; a half-covered day would read as a miss it isn't.
        complete: totals.unknownEntries === 0 && totals.knownEntries > 0,
      };
    });

  const complete = dayRows.filter((row) => row.complete);
  const average = (pick: (row: (typeof complete)[number]) => number) =>
    complete.length === 0 ? null : Math.round((complete.reduce((sum, row) => sum + pick(row), 0) / complete.length) * 10) / 10;

  res.json({
    targets,
    days: dayRows,
    daysComplete: complete.length,
    daysLogged: dayRows.length,
    averages: {
      protein: average((row) => row.protein),
      carbs: average((row) => row.carbs),
      fat: average((row) => row.fat),
      kcal: average((row) => row.kcal),
    },
  });
});

// ── Eating window ────────────────────────────────────────────────────────
//
// First meal to last meal, per day. Every entry already carries a timestamp,
// so this needs no new logging from the user at all — it's the one stat here
// that is purely a different reading of data the diary already has.
//
// A day with a single entry has no window (you can't span from one meal to
// itself), so those are reported as null rather than as a zero-hour window,
// which would drag every average down.

const WINDOW_DEFAULT_DAYS = 30;
const WINDOW_MIN_DAYS = 7;
const WINDOW_MAX_DAYS = 90;

statsRouter.get("/eating-window", async (req, res) => {
  const userId = req.userId!;
  const days = clampInt(req.query.days, WINDOW_MIN_DAYS, WINDOW_MAX_DAYS, WINDOW_DEFAULT_DAYS);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const entries = await prisma.entry.findMany({
    where: { matchWeek: { userId }, timestamp: { gte: since } },
    select: { timestamp: true },
    orderBy: { timestamp: "asc" },
  });

  // Minutes past local midnight, so a 22:30 last meal sorts after an 08:00
  // first meal rather than being compared as raw UTC instants.
  const byDay = new Map<string, number[]>();
  for (const entry of entries) {
    const key = localDayKey(entry.timestamp, config.TIMEZONE);
    const local = getLocalParts(entry.timestamp, config.TIMEZONE);
    const list = byDay.get(key) ?? [];
    list.push(local.hour * 60 + local.minute);
    byDay.set(key, list);
  }

  const rows = [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, minutes]) => {
      const first = Math.min(...minutes);
      const last = Math.max(...minutes);
      // Distinct times, not entry count: logging a saved meal writes several
      // entries at one instant, and counting that as a measured zero-hour
      // window would drag every average towards nothing.
      const spansTwoMeals = new Set(minutes).size > 1;
      return {
        date,
        firstMealMin: first,
        lastMealMin: last,
        windowMin: spansTwoMeals ? last - first : null,
        entries: minutes.length,
      };
    });

  const windows = rows.map((row) => row.windowMin).filter((value): value is number => value !== null);
  const average = (values: number[]) =>
    values.length === 0 ? null : Math.round(values.reduce((a, b) => a + b, 0) / values.length);

  res.json({
    days: rows,
    avgWindowMin: average(windows),
    avgFirstMealMin: average(rows.filter((row) => row.windowMin !== null).map((row) => row.firstMealMin)),
    avgLastMealMin: average(rows.filter((row) => row.windowMin !== null).map((row) => row.lastMealMin)),
    daysMeasured: windows.length,
  });
});

// ── Insights ─────────────────────────────────────────────────────────────
// Deliberately simple, sample-size-gated observations — plain grouped
// averages over the user's own data, not statistical inference. Each one
// only appears once there's enough data behind it to say something useful.

interface Insight {
  id: string;
  text: string;
}

statsRouter.get("/insights", async (req, res) => {
  const userId = req.userId!;
  const since = new Date(Date.now() - INSIGHT_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const sinceKey = localDayKey(since, config.TIMEZONE);

  const [entries, recoveries] = await Promise.all([
    prisma.entry.findMany({
      where: { matchWeek: { userId }, timestamp: { gte: since }, kcal: { not: null } },
      select: { timestamp: true, kcal: true },
    }),
    prisma.whoopRecovery.findMany({
      where: { userId, date: { gte: sinceKey }, recoveryScore: { not: null } },
      select: { date: true, recoveryScore: true },
    }),
  ]);

  const kcalByDay = new Map<string, number>();
  for (const e of entries) {
    const key = localDayKey(e.timestamp, config.TIMEZONE);
    kcalByDay.set(key, (kcalByDay.get(key) ?? 0) + (e.kcal ?? 0));
  }

  const insights: Insight[] = [];

  // 1. Weekday vs weekend average.
  const weekdayTotals: number[] = [];
  const weekendTotals: number[] = [];
  for (const [key, total] of kcalByDay) {
    const weekday = getLocalParts(new Date(`${key}T12:00:00Z`), config.TIMEZONE).weekday;
    (weekday === "Sat" || weekday === "Sun" ? weekendTotals : weekdayTotals).push(total);
  }
  if (weekdayTotals.length >= MIN_SAMPLE_DAYS && weekendTotals.length >= MIN_SAMPLE_DAYS) {
    const avgWeekday = weekdayTotals.reduce((a, b) => a + b, 0) / weekdayTotals.length;
    const avgWeekend = weekendTotals.reduce((a, b) => a + b, 0) / weekendTotals.length;
    const diffPct = Math.round((Math.abs(avgWeekend - avgWeekday) / avgWeekday) * 100);
    if (diffPct >= 5) {
      const direction = avgWeekend > avgWeekday ? "more" : "less";
      insights.push({
        id: "weekday-vs-weekend",
        text: `You log about ${diffPct}% ${direction} on weekends than on weekdays, on average.`,
      });
    }
  }

  // 2. Recovery vs the following day's intake.
  const lowRecoveryNextDay: number[] = [];
  const highRecoveryNextDay: number[] = [];
  for (const r of recoveries) {
    const nextDayKey = localDayKey(new Date(Date.parse(`${r.date}T12:00:00Z`) + 24 * 60 * 60 * 1000), config.TIMEZONE);
    const nextDayKcal = kcalByDay.get(nextDayKey);
    if (nextDayKcal === undefined) continue;
    (r.recoveryScore! < 50 ? lowRecoveryNextDay : highRecoveryNextDay).push(nextDayKcal);
  }
  if (lowRecoveryNextDay.length >= MIN_SAMPLE_DAYS && highRecoveryNextDay.length >= MIN_SAMPLE_DAYS) {
    const avgLow = lowRecoveryNextDay.reduce((a, b) => a + b, 0) / lowRecoveryNextDay.length;
    const avgHigh = highRecoveryNextDay.reduce((a, b) => a + b, 0) / highRecoveryNextDay.length;
    const diffPct = Math.round((Math.abs(avgLow - avgHigh) / avgHigh) * 100);
    if (diffPct >= 5) {
      const direction = avgLow > avgHigh ? "more" : "less";
      insights.push({
        id: "recovery-vs-next-day-kcal",
        text: `After a low WHOOP recovery (under 50%), you tend to log about ${diffPct}% ${direction} the next day than after a high recovery.`,
      });
    }
  }

  // 3. This week vs last week's average intake.
  const thisWeekStart = localDayKey(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), config.TIMEZONE);
  const lastWeekStart = localDayKey(new Date(Date.now() - 14 * 24 * 60 * 60 * 1000), config.TIMEZONE);
  const thisWeekDays = [...kcalByDay.entries()].filter(([key]) => key >= thisWeekStart);
  const lastWeekDays = [...kcalByDay.entries()].filter(([key]) => key >= lastWeekStart && key < thisWeekStart);
  if (thisWeekDays.length >= MIN_SAMPLE_DAYS && lastWeekDays.length >= MIN_SAMPLE_DAYS) {
    const avgThis = thisWeekDays.reduce((sum, [, v]) => sum + v, 0) / thisWeekDays.length;
    const avgLast = lastWeekDays.reduce((sum, [, v]) => sum + v, 0) / lastWeekDays.length;
    const diffPct = Math.round((Math.abs(avgThis - avgLast) / avgLast) * 100);
    if (diffPct >= 5) {
      const direction = avgThis > avgLast ? "up" : "down";
      insights.push({
        id: "week-over-week-kcal",
        text: `Your average daily calories are ${direction} about ${diffPct}% this week compared to last week.`,
      });
    }
  }

  // 4. Sleep against weight change, week by week.
  //
  // Deliberately weekly rather than daily: a single night's sleep can't move
  // the scale, and day-to-day weight is mostly water. Grouping both into
  // seven-day blocks is the coarsest comparison that could show anything
  // real, and it's still an association rather than a cause — which is why
  // the wording says "weeks when", not "sleeping less makes you".
  const [sleeps, weighInsForSleep] = await Promise.all([
    prisma.whoopSleep.findMany({
      where: { userId, start: { gte: since }, timeAsleepMin: { not: null } },
      select: { start: true, timeAsleepMin: true },
    }),
    prisma.weighIn.findMany({ where: { userId, date: { gte: sinceKey } }, orderBy: { date: "asc" } }),
  ]);

  if (sleeps.length >= MIN_SAMPLE_DAYS * 2 && weighInsForSleep.length >= 4) {
    // Bucket both series into the same 7-day blocks, counted back from today
    // so the most recent full week is block 0.
    const blockOf = (key: string): number => {
      const days = Math.floor((Date.now() - Date.parse(`${key}T12:00:00Z`)) / (24 * 60 * 60 * 1000));
      return Math.floor(days / 7);
    };

    const sleepByBlock = new Map<number, number[]>();
    for (const sleep of sleeps) {
      const block = blockOf(localDayKey(sleep.start, config.TIMEZONE));
      const list = sleepByBlock.get(block) ?? [];
      list.push(sleep.timeAsleepMin!);
      sleepByBlock.set(block, list);
    }

    const weightByBlock = new Map<number, { first: number; last: number }>();
    for (const weighIn of weighInsForSleep) {
      const block = blockOf(weighIn.date);
      const seen = weightByBlock.get(block);
      // weighInsForSleep is ordered by date ascending, so the first row seen
      // for a block is its earliest and every later one is its latest.
      weightByBlock.set(block, { first: seen?.first ?? weighIn.weightKg, last: weighIn.weightKg });
    }

    const paired: { sleepMin: number; changeKg: number }[] = [];
    for (const [block, sleepMinutes] of sleepByBlock) {
      const weights = weightByBlock.get(block);
      if (!weights || sleepMinutes.length < 3) continue;
      paired.push({
        sleepMin: sleepMinutes.reduce((a, b) => a + b, 0) / sleepMinutes.length,
        changeKg: weights.last - weights.first,
      });
    }

    if (paired.length >= 4) {
      const medianSleep = [...paired].sort((a, b) => a.sleepMin - b.sleepMin)[Math.floor(paired.length / 2)]!.sleepMin;
      const shorter = paired.filter((p) => p.sleepMin < medianSleep);
      const longer = paired.filter((p) => p.sleepMin >= medianSleep);
      if (shorter.length >= 2 && longer.length >= 2) {
        const avg = (rows: typeof paired) => rows.reduce((sum, row) => sum + row.changeKg, 0) / rows.length;
        const shortAvg = avg(shorter);
        const longAvg = avg(longer);
        const gap = Math.abs(longAvg - shortAvg);
        if (gap >= 0.15) {
          const better = longAvg < shortAvg ? "more" : "less";
          const hours = (medianSleep / 60).toFixed(1);
          insights.push({
            id: "sleep-vs-weight",
            text: `Weeks when you averaged ${better} than ${hours}h asleep went about ${gap.toFixed(1)}kg better on the scale than the weeks either side of that mark.`,
          });
        }
      }
    }
  }

  // Food/recovery associations come from a wider 90-day window and their own
  // sample-size gates, so they're computed separately and appended rather
  // than folded into the checks above.
  const bodyFindings = await foodRecoveryFindings(userId).catch((e) => {
    void recordError("insights.foodRecovery", e, userId);
    return [];
  });

  res.json({ insights: [...insights, ...bodyFindings] });
});

/** Moves a YYYY-MM-DD key by whole days, in UTC so no offset can shift it. */
function shiftDayKey(key: string, days: number): string {
  const [y, m, d] = key.split("-").map(Number) as [number, number, number];
  const moved = new Date(Date.UTC(y, m - 1, d) + days * 24 * 60 * 60 * 1000);
  return moved.toISOString().slice(0, 10);
}

/** Whole days from one YYYY-MM-DD key to another, never negative. */
function daysBetweenKeys(from: string, to: string): number {
  const parse = (key: string) => {
    const [y, m, d] = key.split("-").map(Number) as [number, number, number];
    return Date.UTC(y, m - 1, d);
  };
  return Math.max(0, Math.round((parse(to) - parse(from)) / (24 * 60 * 60 * 1000)));
}
