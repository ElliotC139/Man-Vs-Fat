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
  // This calendar day's full WHOOP burn, built from every cycle that
  // overlaps it in real time — not just whichever cycle happens to *start*
  // that day. WHOOP cycles don't reliably align to calendar days (a cycle
  // can run well over 24h if a night's sleep wasn't detected, silently
  // swallowing the day after it), so each cycle's resting/BMR-ish portion is
  // split across every day it actually touches, proportional to real time
  // overlap.
  kcal: number | null;
  // Same idea but intersected with this match week's boundaries too, so the
  // two boundary Mondays split correctly at the real 17:00 rollover instant.
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

/**
 * Sums this match week's WHOOP calorie burn. Each cycle is logged burn split
 * by real time overlap across whichever calendar day(s) and week it actually
 * touches — see WhoopDailyBurn above for why that matters. Logged activity
 * isn't split proportionally like the rest of a cycle: each workout is
 * already pinned to the correct day/week by its own exact timestamp (set at
 * sync time in syncUserWorkouts), so it's subtracted from its cycle's
 * non-activity total and re-added exactly where it happened. Days with no
 * scored cycle at all fall back to the trailing average of the last week's
 * scored days — including future days, whose contribution is a projection
 * rather than a measurement (dailyBurn flags them via `future` so callers
 * can hide the per-day figure while still counting them toward the total).
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

  // Each cycle's resting/BMR-ish portion, isolated once per cycle by
  // subtracting whatever logged activity happened during its actual span —
  // reused below for every day that cycle overlaps.
  const nonActivityByCycleId = new Map<number, number>();
  for (const cycle of nearbyCycles) {
    if (cycle.kcalBurned == null) continue;
    const cycleStartMs = cycle.start.getTime();
    const cycleEndMs = (cycle.end ?? now).getTime();
    const activityDuringCycle = nearbyWorkouts
      .filter((w) => w.timestamp.getTime() >= cycleStartMs && w.timestamp.getTime() < cycleEndMs)
      .reduce((sum, w) => sum + (w.kcalBurned ?? 0), 0);
    nonActivityByCycleId.set(cycle.id, Math.max(cycle.kcalBurned - activityDuringCycle, 0));
  }

  const calendarDays = matchWeekCalendarDays(start, config.TIMEZONE);
  const todayKey = localDayKey(now, config.TIMEZONE);
  const startMs = start.getTime();
  const endMs = end.getTime();

  function contributionForDay(dateKey: string): { kcal: number | null; kcalWeighted: number | null; scoreState: string | null } {
    const [dayStart, dayEnd] = dayBounds(dateKey);
    const dayStartMs = dayStart.getTime();
    const dayEndMs = dayEnd.getTime();

    const overlapping = nearbyCycles.filter((c) => c.start.getTime() < dayEndMs && (c.end ?? now).getTime() > dayStartMs);
    if (overlapping.length === 0) return { kcal: null, kcalWeighted: null, scoreState: null };

    let dayNonActivity = 0;
    let weekNonActivity = 0;
    let hasScored = false;
    let scoreState: string | null = null;

    for (const cycle of overlapping) {
      scoreState = cycle.scoreState;
      const nonActivity = nonActivityByCycleId.get(cycle.id);
      if (nonActivity === undefined) continue; // not yet scored
      hasScored = true;

      const cycleStartMs = cycle.start.getTime();
      const cycleEndMs = (cycle.end ?? now).getTime();
      const cycleDurationMs = Math.max(cycleEndMs - cycleStartMs, 1);

      const overlapDayMs = Math.max(0, Math.min(cycleEndMs, dayEndMs) - Math.max(cycleStartMs, dayStartMs));
      dayNonActivity += nonActivity * (overlapDayMs / cycleDurationMs);

      const overlapDayWeekMs = Math.max(0, Math.min(cycleEndMs, dayEndMs, endMs) - Math.max(cycleStartMs, dayStartMs, startMs));
      weekNonActivity += nonActivity * (overlapDayWeekMs / cycleDurationMs);
    }

    if (!hasScored) return { kcal: null, kcalWeighted: null, scoreState };

    const dayWorkouts = nearbyWorkouts.filter((w) => localDayKey(w.timestamp, config.TIMEZONE) === dateKey);
    const dayWorkoutKcal = dayWorkouts.reduce((sum, w) => sum + (w.kcalBurned ?? 0), 0);
    const weekWorkoutKcal = dayWorkouts
      .filter((w) => w.timestamp.getTime() >= startMs && w.timestamp.getTime() < endMs)
      .reduce((sum, w) => sum + (w.kcalBurned ?? 0), 0);

    return {
      kcal: Math.round(dayNonActivity + dayWorkoutKcal),
      kcalWeighted: Math.round(weekNonActivity + weekWorkoutKcal),
      scoreState,
    };
  }

  let weeklyBudget = 0;
  let hasAnyData = false;
  const isBoundary = (date: string) => date === calendarDays[0] || date === calendarDays[calendarDays.length - 1];
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
