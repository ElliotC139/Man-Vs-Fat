import { prisma } from "../db";
import { config } from "../config";
import { findOrCreateMatchWeek, getUserWeekStart, localDayKey, matchWeekCalendarDays } from "../matchWeek";
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
  // Full physiological-day value, unweighted.
  kcal: number | null;
  // This calendar day's contribution to *this* match week. Equal to `kcal`
  // for interior days; for the two boundary Mondays, WHOOP's cycle for that
  // day is split at the actual 17:00 rollover instant using the cycle's real
  // start/end times (not just a flat half), with any logged activity on that
  // day added back in exactly (workouts are already attributed to the
  // correct side of 17:00 by their own timestamp when synced — see
  // syncUserWorkouts) rather than proportionally.
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

/**
 * Sums this match week's WHOOP calorie burn. Interior days use their cycle's
 * full total; the two boundary Mondays are split at the real 17:00 rollover
 * instant (see WhoopDailyBurn above). Days with no scored cycle yet fall
 * back to the trailing average of the last week's scored days so the widget
 * never just goes blank for missing data — including future days, whose
 * contribution is a projection rather than a measurement (dailyBurn flags
 * them via `future` so callers can hide the per-day figure).
 */
export async function getWhoopWeekBudget(userId: number, start: Date, end: Date): Promise<WhoopWeekBudget | null> {
  const conn = await prisma.whoopConnection.findUnique({ where: { userId } });
  if (!conn) return null;

  const now = new Date();

  const [weekCycles, trailing, nearbyWorkouts] = await Promise.all([
    prisma.whoopCycle.findMany({ where: { userId, start: { gte: start, lt: end } }, orderBy: { start: "asc" } }),
    prisma.whoopCycle.findMany({
      where: { userId, kcalBurned: { not: null }, start: { lt: start } },
      orderBy: { start: "desc" },
      take: TRAILING_AVERAGE_SAMPLE,
    }),
    // A day either side of the match week, wide enough to cover any workout
    // whose cycle straddles the 17:00 boundary. Activity doesn't need
    // proportional splitting like the non-activity burn does — each workout
    // is already pinned to the correct week by its own exact timestamp.
    prisma.exercise.findMany({
      where: {
        whoopWorkoutId: { not: null },
        matchWeek: { userId },
        timestamp: { gte: new Date(start.getTime() - 86_400_000), lt: new Date(end.getTime() + 86_400_000) },
      },
      select: { timestamp: true, kcalBurned: true },
    }),
  ]);

  const trailingAvg = trailing.length
    ? Math.round(trailing.reduce((sum, c) => sum + (c.kcalBurned ?? 0), 0) / trailing.length)
    : null;

  const byDay = new Map<string, (typeof weekCycles)[number]>();
  for (const cycle of weekCycles) {
    byDay.set(localDayKey(cycle.start, config.TIMEZONE), cycle);
  }

  const calendarDays = matchWeekCalendarDays(start, config.TIMEZONE);
  const openingDay = calendarDays[0];
  const closingDay = calendarDays[calendarDays.length - 1];
  const todayKey = localDayKey(now, config.TIMEZONE);

  function boundaryKcalWeighted(cycle: (typeof weekCycles)[number], date: string): number {
    const dayWorkouts = nearbyWorkouts.filter((w) => localDayKey(w.timestamp, config.TIMEZONE) === date);
    const activityAll = dayWorkouts.reduce((sum, w) => sum + (w.kcalBurned ?? 0), 0);
    const activityInWeek = dayWorkouts
      .filter((w) => w.timestamp >= start && w.timestamp < end)
      .reduce((sum, w) => sum + (w.kcalBurned ?? 0), 0);
    // Whatever's left after subtracting logged activity is the resting/BMR-ish
    // burn, which we assume is roughly steady across the cycle's real
    // duration — so its share of "this week" is just the actual time overlap.
    const nonActivity = Math.max((cycle.kcalBurned ?? 0) - activityAll, 0);

    const cycleStartMs = cycle.start.getTime();
    const cycleEndMs = (cycle.end ?? now).getTime();
    const overlapMs = Math.max(0, Math.min(cycleEndMs, end.getTime()) - Math.max(cycleStartMs, start.getTime()));
    const fraction = Math.min(overlapMs / Math.max(cycleEndMs - cycleStartMs, 1), 1);

    return Math.round(nonActivity * fraction) + activityInWeek;
  }

  let weeklyBudget = 0;
  let hasAnyData = false;
  const dailyBurn: WhoopDailyBurn[] = calendarDays.map((date) => {
    const isBoundary = date === openingDay || date === closingDay;
    const cycle = byDay.get(date);
    const future = date > todayKey;

    let kcal: number | null = null;
    let kcalWeighted: number | null = null;
    let estimated = false;

    if (cycle?.kcalBurned != null) {
      kcal = cycle.kcalBurned;
      kcalWeighted = isBoundary ? boundaryKcalWeighted(cycle, date) : cycle.kcalBurned;
    } else if (trailingAvg !== null) {
      kcal = trailingAvg;
      kcalWeighted = isBoundary ? Math.round(trailingAvg * 0.5) : trailingAvg;
      estimated = true;
    }

    if (kcalWeighted !== null) {
      weeklyBudget += kcalWeighted;
      hasAnyData = true;
    }

    return { date, kcal, kcalWeighted, estimated, scoreState: cycle?.scoreState ?? null, future };
  });

  return {
    connected: true,
    lastSyncedAt: conn.lastSyncedAt,
    weeklyBudget: hasAnyData ? Math.round(weeklyBudget) : null,
    dailyBurn,
  };
}
