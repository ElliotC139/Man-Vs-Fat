import { Router } from "express";
import { prisma } from "../db";
import { config } from "../config";
import { requireAuth } from "../auth";
import {
  getLocalParts,
  getMatchWeekBoundariesForWeeksAgo,
  getUserWeekStart,
  localDayKey,
  zonedTimeToUtc,
} from "../matchWeek";
import { estimateAdaptiveTdee } from "../adaptiveTdee";
import { foodRecoveryFindings } from "../foodRecovery";
import { latestTrendWeight, trendRate } from "../trendWeight";

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
async function avgKcalPerDay(userId: number): Promise<number | null> {
  const since = new Date(Date.now() - AVG_KCAL_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const entries = await prisma.entry.findMany({
    where: { matchWeek: { userId }, timestamp: { gte: since }, kcal: { not: null } },
    select: { kcal: true },
  });
  if (entries.length === 0) return null;
  const total = entries.reduce((sum, e) => sum + (e.kcal ?? 0), 0);
  return Math.round(total / AVG_KCAL_WINDOW_DAYS);
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

function projectGoal(goalWeightKg: number, currentTrendKg: number, kgPerWeek: number): GoalProjection {
  const remainingKg = Math.round((currentTrendKg - goalWeightKg) * 100) / 100;
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

  const [avgKcal, user, windowWeighIns, allWeighIns] = await Promise.all([
    avgKcalPerDay(userId),
    prisma.user.findUnique({ where: { id: userId }, select: { weeklyGoalKg: true, goalWeightKg: true } }),
    prisma.weighIn.findMany({ where: { userId, date: { gte: since } }, orderBy: { date: "asc" } }),
    prisma.weighIn.findMany({ where: { userId }, orderBy: { date: "asc" } }),
  ]);

  // Rate comes from the recent window (what's happening now); the current
  // trend value comes from the full history, so the smoothing has all the
  // readings behind it rather than restarting at the window edge.
  const points = windowWeighIns.map((w) => ({ date: w.date, weightKg: w.weightKg }));
  const rate = trendRate(points);
  const currentTrendKg = latestTrendWeight(allWeighIns.map((w) => ({ date: w.date, weightKg: w.weightKg })));

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
    kgPerWeek !== null && currentTrendKg !== null
      ? {
          kgPerWeek,
          trendWeightKg: Math.round(currentTrendKg * 100) / 100,
          projectedWeightKg4wk: Math.round((currentTrendKg + kgPerWeek * 4) * 100) / 100,
        }
      : null;

  const goalProjection =
    user?.goalWeightKg && currentTrendKg !== null ? projectGoal(user.goalWeightKg, currentTrendKg, kgPerWeek ?? 0) : null;

  res.json({
    avgKcalPerDay: avgKcal,
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

// Mirrors the Mifflin-St Jeor estimate used client-side for the current
// week's budget widget (public/app.js: calculateTdee) — used here as the
// "calories out" fallback for historical days with no scored WHOOP cycle.
function estimateTdee(user: {
  weightKg: number | null;
  heightCm: number | null;
  ageYears: number | null;
  activityLevel: string | null;
}): number | null {
  const { weightKg, heightCm, ageYears, activityLevel } = user;
  if (!weightKg || !heightCm || !ageYears || !activityLevel) return null;
  const bmr = 10 * weightKg + 6.25 * heightCm - 5 * ageYears + 5;
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
  const tdee = estimateTdee(user ?? { weightKg: null, heightCm: null, ageYears: null, activityLevel: null });

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

  const [entries, weighIns, workouts, recoveries] = await Promise.all([
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
    const daysWithEntries = new Set(entriesThisWeek.map((e) => localDayKey(e.timestamp, config.TIMEZONE))).size;

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

    const weightNow = weightAsOf(endKey);
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
    };
  });

  res.json({ weeks: result });
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

  // Food/recovery associations come from a wider 90-day window and their own
  // sample-size gates, so they're computed separately and appended rather
  // than folded into the checks above.
  const bodyFindings = await foodRecoveryFindings(userId).catch((e) => {
    console.error("Food/recovery findings failed:", e);
    return [];
  });

  res.json({ insights: [...insights, ...bodyFindings] });
});
