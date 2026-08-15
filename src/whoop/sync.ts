import { prisma } from "../db";
import { config } from "../config";
import { findOrCreateMatchWeek, getUserWeekStart, localDayKey, matchWeekCalendarDays, zonedTimeToUtc } from "../matchWeek";
import { fetchRecentCycles, fetchRecentWorkouts, refreshAccessToken } from "./client";

const BACKFILL_DAYS = 10;
const TRAILING_AVERAGE_SAMPLE = 7;

/** Returns a usable access token, refreshing and persisting it first if it's near expiry. */
async function getValidAccessToken(userId: number): Promise<string | null> {
  const conn = await prisma.whoopConnection.findUnique({ where: { userId } });
  if (!conn) return null;

  if (conn.expiresAt.getTime() > Date.now() + 60_000) {
    return conn.accessToken;
  }

  const tokens = await refreshAccessToken(conn.refreshToken);
  await prisma.whoopConnection.update({
    where: { userId },
    data: { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, expiresAt: tokens.expiresAt },
  });
  return tokens.accessToken;
}

function formatDurationLabel(startMs: number, endMs: number): string {
  const totalMin = Math.max(Math.round((endMs - startMs) / 60_000), 1);
  const hrs = Math.floor(totalMin / 60);
  const mins = totalMin % 60;
  if (hrs > 0 && mins > 0) return `${hrs} hr ${mins} min`;
  if (hrs > 0) return `${hrs} hr`;
  return `${mins} min`;
}

async function syncUserWorkouts(userId: number, accessToken: string): Promise<void> {
  const since = new Date(Date.now() - BACKFILL_DAYS * 24 * 60 * 60 * 1000);

  let workouts;
  try {
    workouts = await fetchRecentWorkouts(accessToken, since);
  } catch (e) {
    // Most likely an older connection made before read:workout was requested
    // — don't let a missing scope take down the cycle sync too.
    console.error("WHOOP workout fetch failed (may need to reconnect for the read:workout scope):", e);
    return;
  }

  const weekStart = await getUserWeekStart(userId);
  for (const workout of workouts) {
    const matchWeek = await findOrCreateMatchWeek(workout.start, config.TIMEZONE, userId, weekStart);
    const duration = formatDurationLabel(workout.start.getTime(), workout.end.getTime());
    const description = workout.sportName ? `${duration} ${workout.sportName}` : `${duration} WHOOP workout`;

    await prisma.exercise.upsert({
      where: { whoopWorkoutId: workout.whoopWorkoutId },
      update: { description, kcalBurned: workout.kcalBurned, timestamp: workout.start, matchWeekId: matchWeek.id },
      create: {
        whoopWorkoutId: workout.whoopWorkoutId,
        description,
        kcalBurned: workout.kcalBurned,
        timestamp: workout.start,
        matchWeekId: matchWeek.id,
      },
    });
  }
}

/** Pulls recent cycles and workouts from WHOOP; called after connect and on webhook pings. */
export async function syncUser(userId: number): Promise<void> {
  const accessToken = await getValidAccessToken(userId);
  if (!accessToken) return;

  const since = new Date(Date.now() - BACKFILL_DAYS * 24 * 60 * 60 * 1000);
  const cycles = await fetchRecentCycles(accessToken, since);

  for (const cycle of cycles) {
    await prisma.whoopCycle.upsert({
      where: { whoopCycleId: cycle.whoopCycleId },
      update: { start: cycle.start, end: cycle.end, kcalBurned: cycle.kcalBurned, scoreState: cycle.scoreState },
      create: {
        userId,
        whoopCycleId: cycle.whoopCycleId,
        start: cycle.start,
        end: cycle.end,
        kcalBurned: cycle.kcalBurned,
        scoreState: cycle.scoreState,
      },
    });
  }

  const conn = await prisma.whoopConnection.findUnique({ where: { userId } });
  await prisma.whoopConnection.update({
    where: { userId },
    data: {
      lastSyncedAt: new Date(),
      // Captured once from cycle data (no read:profile scope requested) so the
      // webhook — keyed by WHOOP user id — can resolve pings back to this user.
      ...(conn?.whoopUserId == null && cycles[0] ? { whoopUserId: cycles[0].whoopUserId } : {}),
    },
  });

  await syncUserWorkouts(userId, accessToken);
}

/** Resyncs every connected user — used by the periodic scheduler as a backstop for missed webhooks. */
export async function syncAllConnectedUsers(): Promise<void> {
  const connections = await prisma.whoopConnection.findMany({ select: { userId: true } });
  for (const { userId } of connections) {
    try {
      await syncUser(userId);
    } catch (e) {
      console.error(`Scheduled WHOOP sync failed for user ${userId}:`, e);
    }
  }
}

export interface WhoopDailyBurn {
  date: string;
  // This calendar day's WHOOP burn — the sum of whichever cycle(s) are
  // *wholesale* assigned to it. WHOOP itself doesn't split a cycle's kcal
  // proportionally across the days it happens to span (confirmed against
  // WHOOP's own trend view): a cycle that runs long — e.g. 26h because a
  // night's sleep wasn't detected cleanly — is credited entirely to
  // whichever single calendar day it overlaps the most, so that's the rule
  // used here too (see assignedDayKey).
  kcal: number | null;
  // Same value, except on the two boundary Mondays, where the day's
  // assigned cycle(s) are split at the real 17:00 rollover instant (using
  // the cycle's actual start/end, not an assumed midnight alignment) so
  // only the portion that actually falls in this match week counts.
  kcalWeighted: number | null;
  estimated: boolean;
  scoreState: string | null;
  // True for days after today — no cycle exists for them yet, so callers
  // should not display a per-day figure even though the trailing-average
  // fallback still folds into weeklyBudget for projection purposes.
  future: boolean;
}

export interface WhoopWeekBudget {
  connected: true;
  lastSyncedAt: Date | null;
  weeklyBudget: number | null;
  dailyBurn: WhoopDailyBurn[];
}

/** Local midnight-to-midnight bounds for a YYYY-MM-DD key. */
function dayBounds(dateKey: string): [Date, Date] {
  const [year, month, day] = dateKey.split("-").map(Number) as [number, number, number];
  const dayStart = zonedTimeToUtc(year, month, day, 0, 0, config.TIMEZONE);
  // Date.UTC (used inside zonedTimeToUtc) normalizes day+1 past a month's end
  // on its own, so this works fine across month boundaries too.
  const dayEnd = zonedTimeToUtc(year, month, day + 1, 0, 0, config.TIMEZONE);
  return [dayStart, dayEnd];
}

type Cycle = { id: number; start: Date; end: Date | null; kcalBurned: number | null; scoreState: string };

/** Whichever calendar day (by real time overlap) a cycle mostly falls on — matches WHOOP's own per-day attribution. */
function assignedDayKey(cycle: Cycle, now: Date): string {
  const cycleStartMs = cycle.start.getTime();
  const cycleEndMs = (cycle.end ?? now).getTime();
  const startDay = localDayKey(cycle.start, config.TIMEZONE);

  let bestDay = startDay;
  let bestOverlapMs = -1;
  // Cycles are rarely much over 24h; checking the start day plus the next
  // two covers even a very long one with room to spare.
  for (let i = 0; i <= 2; i++) {
    const dateKey = candidateFrom(startDay, i);
    const [dayStart, dayEnd] = dayBounds(dateKey);
    const overlapMs = Math.max(0, Math.min(cycleEndMs, dayEnd.getTime()) - Math.max(cycleStartMs, dayStart.getTime()));
    if (overlapMs > bestOverlapMs) {
      bestOverlapMs = overlapMs;
      bestDay = dateKey;
    }
  }
  return bestDay;
}

/** dateKey shifted forward by `deltaDays` calendar days in local time. */
function candidateFrom(dateKey: string, deltaDays: number): string {
  const [year, month, day] = dateKey.split("-").map(Number) as [number, number, number];
  // Noon avoids landing on a DST-transition instant when reading the date back out.
  return localDayKey(zonedTimeToUtc(year, month, day + deltaDays, 12, 0, config.TIMEZONE), config.TIMEZONE);
}

/**
 * Sums this match week's WHOOP calorie burn, one cycle assigned wholesale to
 * its majority-overlap calendar day at a time (see WhoopDailyBurn above for
 * why that matches WHOOP's own reporting). Only the two boundary Mondays
 * need splitting further, at the real 17:00 rollover instant — logged
 * activity within that split isn't apportioned proportionally like the rest
 * of the cycle, since each workout is already pinned to the correct side of
 * 17:00 by its own exact timestamp (set at sync time in syncUserWorkouts).
 * Days with no cycle assigned at all fall back to the trailing average of
 * the last week's scored days — including future days, whose contribution
 * is a projection rather than a measurement (dailyBurn flags them via
 * `future` so callers can hide the per-day figure while still counting them
 * toward the total).
 */
export async function getWhoopWeekBudget(userId: number, start: Date, end: Date): Promise<WhoopWeekBudget | null> {
  const conn = await prisma.whoopConnection.findUnique({ where: { userId } });
  if (!conn) return null;

  const now = new Date();
  const bufferMs = 2 * 86_400_000; // wide enough to catch cycles/workouts straddling a day or the week boundary

  const [nearbyCycles, trailing, nearbyWorkouts] = await Promise.all([
    prisma.whoopCycle.findMany({
      where: {
        userId,
        start: { lt: new Date(end.getTime() + bufferMs) },
        OR: [{ end: null }, { end: { gt: new Date(start.getTime() - bufferMs) } }],
      },
      orderBy: { start: "asc" },
    }),
    prisma.whoopCycle.findMany({
      where: { userId, kcalBurned: { not: null }, start: { lt: start } },
      orderBy: { start: "desc" },
      take: TRAILING_AVERAGE_SAMPLE,
    }),
    prisma.exercise.findMany({
      where: {
        whoopWorkoutId: { not: null },
        matchWeek: { userId },
        timestamp: { gte: new Date(start.getTime() - bufferMs), lt: new Date(end.getTime() + bufferMs) },
      },
      select: { timestamp: true, kcalBurned: true },
    }),
  ]);

  const trailingAvg = trailing.length
    ? Math.round(trailing.reduce((sum, c) => sum + (c.kcalBurned ?? 0), 0) / trailing.length)
    : null;

  const cyclesByDay = new Map<string, Cycle[]>();
  for (const cycle of nearbyCycles) {
    const day = assignedDayKey(cycle, now);
    const bucket = cyclesByDay.get(day) ?? [];
    bucket.push(cycle);
    cyclesByDay.set(day, bucket);
  }

  const calendarDays = matchWeekCalendarDays(start, config.TIMEZONE);
  const todayKey = localDayKey(now, config.TIMEZONE);
  const startMs = start.getTime();
  const endMs = end.getTime();
  const isBoundary = (date: string) => date === calendarDays[0] || date === calendarDays[calendarDays.length - 1];

  function contributionForDay(dateKey: string): { kcal: number | null; kcalWeighted: number | null; scoreState: string | null } {
    const cycles = cyclesByDay.get(dateKey) ?? [];
    const scored = cycles.filter((c) => c.kcalBurned !== null);
    if (scored.length === 0) return { kcal: null, kcalWeighted: null, scoreState: cycles[0]?.scoreState ?? null };

    const kcal = scored.reduce((sum, c) => sum + (c.kcalBurned ?? 0), 0);

    if (!isBoundary(dateKey)) {
      return { kcal, kcalWeighted: kcal, scoreState: scored[0]?.scoreState ?? null };
    }

    const kcalWeighted = scored.reduce((sum, cycle) => {
      const cycleStartMs = cycle.start.getTime();
      const cycleEndMs = (cycle.end ?? now).getTime();
      const cycleDurationMs = Math.max(cycleEndMs - cycleStartMs, 1);

      const workoutsInCycle = nearbyWorkouts.filter(
        (w) => w.timestamp.getTime() >= cycleStartMs && w.timestamp.getTime() < cycleEndMs,
      );
      const activityAll = workoutsInCycle.reduce((s, w) => s + (w.kcalBurned ?? 0), 0);
      const activityInWeek = workoutsInCycle
        .filter((w) => w.timestamp.getTime() >= startMs && w.timestamp.getTime() < endMs)
        .reduce((s, w) => s + (w.kcalBurned ?? 0), 0);
      const nonActivity = Math.max((cycle.kcalBurned ?? 0) - activityAll, 0);

      const overlapWeekMs = Math.max(0, Math.min(cycleEndMs, endMs) - Math.max(cycleStartMs, startMs));
      const fraction = overlapWeekMs / cycleDurationMs;

      return sum + Math.round(nonActivity * fraction) + activityInWeek;
    }, 0);

    return { kcal, kcalWeighted, scoreState: scored[0]?.scoreState ?? null };
  }

  let weeklyBudget = 0;
  let hasAnyData = false;
  const dailyBurn: WhoopDailyBurn[] = calendarDays.map((date) => {
    const future = date > todayKey;
    const result = contributionForDay(date);

    let kcal = result.kcal;
    let kcalWeighted = result.kcalWeighted;
    let estimated = false;

    if (kcal === null && trailingAvg !== null) {
      kcal = trailingAvg;
      kcalWeighted = isBoundary(date) ? Math.round(trailingAvg * 0.5) : trailingAvg;
      estimated = true;
    }

    if (kcalWeighted !== null) {
      weeklyBudget += kcalWeighted;
      hasAnyData = true;
    }

    return { date, kcal, kcalWeighted, estimated, scoreState: result.scoreState, future };
  });

  return {
    connected: true,
    lastSyncedAt: conn.lastSyncedAt,
    weeklyBudget: hasAnyData ? Math.round(weeklyBudget) : null,
    dailyBurn,
  };
}
