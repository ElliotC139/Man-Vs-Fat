import { Router } from "express";
import { prisma } from "../db";
import { config } from "../config";
import { requireAuth } from "../auth";
import { localDayKey } from "../matchWeek";

export const statsRouter = Router();
statsRouter.use(requireAuth);

const AVG_KCAL_WINDOW_DAYS = 7;
const WEIGHT_PACE_WINDOW_DAYS = 28;

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

interface WeightPace {
  kgPerWeek: number;
  goalKgPerWeek: number;
  onTrack: boolean;
}

/**
 * Measured rate of weight change (kg/week, negative = losing) between the
 * oldest and newest weigh-in inside the trailing window, vs. the weekly
 * loss goal set in Settings. Null if there aren't at least two weigh-ins to
 * compare, or no goal has been set. "On track" allows some tolerance
 * (within 10% of goal, or losing faster) rather than requiring an exact
 * match, since a single week's weigh-ins are noisy.
 */
async function weightPaceVsGoal(userId: number): Promise<WeightPace | null> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { weeklyGoalKg: true } });
  if (!user?.weeklyGoalKg) return null;

  const since = new Date(Date.now() - WEIGHT_PACE_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const sinceKey = localDayKey(since, config.TIMEZONE);
  const weighIns = await prisma.weighIn.findMany({
    where: { userId, date: { gte: sinceKey } },
    orderBy: { date: "asc" },
  });
  if (weighIns.length < 2) return null;

  const first = weighIns[0]!;
  const last = weighIns[weighIns.length - 1]!;
  const daysSpan = (Date.parse(last.date) - Date.parse(first.date)) / (24 * 60 * 60 * 1000);
  if (daysSpan < 1) return null;

  const kgPerWeek = ((last.weightKg - first.weightKg) / daysSpan) * 7;
  const onTrack = kgPerWeek <= 0 && Math.abs(kgPerWeek) >= user.weeklyGoalKg * 0.9;

  return { kgPerWeek: Math.round(kgPerWeek * 100) / 100, goalKgPerWeek: user.weeklyGoalKg, onTrack };
}

/** Consecutive days (ending today or yesterday) with at least one food entry logged. */
async function loggingStreak(userId: number): Promise<number> {
  const entries = await prisma.entry.findMany({
    where: { matchWeek: { userId } },
    select: { timestamp: true },
    orderBy: { timestamp: "desc" },
  });
  const loggedDays = new Set(entries.map((e) => localDayKey(e.timestamp, config.TIMEZONE)));

  const today = new Date();
  let cursor = localDayKey(today, config.TIMEZONE);
  if (!loggedDays.has(cursor)) {
    // Today not logged yet — that's fine, check whether the streak is still
    // alive as of yesterday rather than treating it as already broken.
    cursor = localDayKey(new Date(today.getTime() - 24 * 60 * 60 * 1000), config.TIMEZONE);
    if (!loggedDays.has(cursor)) return 0;
  }

  let streak = 0;
  let cursorDate = new Date(`${cursor}T12:00:00Z`);
  while (loggedDays.has(localDayKey(cursorDate, config.TIMEZONE))) {
    streak += 1;
    cursorDate = new Date(cursorDate.getTime() - 24 * 60 * 60 * 1000);
  }
  return streak;
}

statsRouter.get("/summary", async (req, res) => {
  const userId = req.userId!;
  const [avgKcal, weightPace, streak] = await Promise.all([
    avgKcalPerDay(userId),
    weightPaceVsGoal(userId),
    loggingStreak(userId),
  ]);
  res.json({ avgKcalPerDay: avgKcal, weightPace, loggingStreakDays: streak });
});
