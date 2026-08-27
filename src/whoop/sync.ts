import { prisma } from "../db";
import { config } from "../config";
import { findOrCreateMatchWeek, getUserWeekStart, localDayKey, matchWeekCalendarDays, zonedTimeToUtc } from "../matchWeek";
import { fetchRecentCycles, fetchRecentRecovery, fetchRecentSleep, fetchRecentWorkouts, refreshAccessToken } from "./client";

const BACKFILL_DAYS = 10;
// The first sync after a connection is created (or after this field was
// added — deepBackfilledAt is null either way) reaches back this far
// instead of the normal short trailing window, so cycles/workouts/sleep/
// recovery WHOOP already has recorded get pulled in rather than leaving
// everything older than BACKFILL_DAYS to fall back to an estimate. Matches
// the calorie balance chart's own max range (see BALANCE_MAX_DAYS in
// src/routes/stats.ts) — no point fetching further back than we ever plot.
const DEEP_BACKFILL_DAYS = 90;
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

async function syncUserWorkouts(userId: number, accessToken: string, since: Date): Promise<void> {
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

async function syncUserSleep(userId: number, accessToken: string, since: Date): Promise<void> {
  let sleeps;
  try {
    sleeps = await fetchRecentSleep(accessToken, since);
  } catch (e) {
    // Most likely a connection made before read:sleep was requested — don't
    // let a missing scope take down the rest of sync.
    console.error("WHOOP sleep fetch failed (may need to reconnect for the read:sleep scope):", e);
    return;
  }

  for (const sleep of sleeps) {
    await prisma.whoopSleep.upsert({
      where: { whoopSleepId: sleep.whoopSleepId },
      update: {
        start: sleep.start,
        end: sleep.end,
        scoreState: sleep.scoreState,
        performancePercent: sleep.performancePercent,
        timeAsleepMin: sleep.timeAsleepMin,
      },
      create: {
        userId,
        whoopSleepId: sleep.whoopSleepId,
        start: sleep.start,
        end: sleep.end,
        scoreState: sleep.scoreState,
        performancePercent: sleep.performancePercent,
        timeAsleepMin: sleep.timeAsleepMin,
      },
    });
  }
}

async function syncUserRecovery(userId: number, accessToken: string, since: Date): Promise<void> {
  let recoveries;
  try {
    recoveries = await fetchRecentRecovery(accessToken, since);
  } catch (e) {
    // Most likely a connection made before read:recovery was requested —
    // don't let a missing scope take down the rest of sync.
    console.error("WHOOP recovery fetch failed (may need to reconnect for the read:recovery scope):", e);
    return;
  }

  for (const recovery of recoveries) {
    // Recovery carries no start/end of its own — assign it to the calendar
    // day of the cycle it belongs to (cycles are synced before recovery in
    // syncUserUnguarded, so the row should already exist). A recovery whose
    // cycle hasn't synced yet is skipped rather than guessed at; it'll be
    // picked up on the next sync once the cycle exists.
    const cycle = await prisma.whoopCycle.findUnique({ where: { whoopCycleId: recovery.whoopCycleId } });
    if (!cycle) continue;
    const date = localDayKey(cycle.start, config.TIMEZONE);

    await prisma.whoopRecovery.upsert({
      where: { whoopCycleId: recovery.whoopCycleId },
      update: {
        date,
        scoreState: recovery.scoreState,
        recoveryScore: recovery.recoveryScore,
        restingHeartRate: recovery.restingHeartRate,
        hrvMilli: recovery.hrvMilli,
      },
      create: {
        userId,
        whoopCycleId: recovery.whoopCycleId,
        date,
        scoreState: recovery.scoreState,
        recoveryScore: recovery.recoveryScore,
        restingHeartRate: recovery.restingHeartRate,
        hrvMilli: recovery.hrvMilli,
      },
    });
  }
}

// WHOOP rotates refresh tokens on use — two syncs for the same user
// overlapping (periodic cron, webhook, manual button, startup catch-up all
// call this) could both read the same stored refresh token and race to
// redeem it, leaving one of them holding an already-invalidated token. This
// serializes syncs per user so that can't happen; a sync already in flight
// is simply reused instead of started twice.
const inFlightSyncs = new Map<number, Promise<void>>();

export function syncUser(userId: number): Promise<void> {
  const existing = inFlightSyncs.get(userId);
  if (existing) return existing;

  const promise = syncUserUnguarded(userId).finally(() => inFlightSyncs.delete(userId));
  inFlightSyncs.set(userId, promise);
  return promise;
}

/** Pulls recent cycles and workouts from WHOOP; called after connect and on webhook pings. */
async function syncUserUnguarded(userId: number): Promise<void> {
  const accessToken = await getValidAccessToken(userId);
  if (!accessToken) return;

  const conn = await prisma.whoopConnection.findUnique({ where: { userId } });
  const isDeepBackfill = conn?.deepBackfilledAt == null;
  const since = new Date(Date.now() - (isDeepBackfill ? DEEP_BACKFILL_DAYS : BACKFILL_DAYS) * 24 * 60 * 60 * 1000);

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

  await prisma.whoopConnection.update({
    where: { userId },
    data: {
      lastSyncedAt: new Date(),
      // Captured once from cycle data (no read:profile scope requested) so the
      // webhook — keyed by WHOOP user id — can resolve pings back to this user.
      ...(conn?.whoopUserId == null && cycles[0] ? { whoopUserId: cycles[0].whoopUserId } : {}),
      ...(isDeepBackfill ? { deepBackfilledAt: new Date() } : {}),
    },
  });

  await syncUserWorkouts(userId, accessToken, since);
  await syncUserSleep(userId, accessToken, since);
  // Recovery is synced last since it looks up already-upserted WhoopCycle
  // rows above to assign itself a calendar date.
  await syncUserRecovery(userId, accessToken, since);
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
  // True for any day whose burn isn't known yet — every day after today, plus
  // today itself until WHOOP has an actual cycle for it. No estimate is used
  // for these; kcal/kcalWeighted stay null and nothing is added to
  // weeklyBudget until real data exists.
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
 * Past days with no cycle assigned fall back to the trailing average of the
 * last week's scored days (a genuine sync gap). Today and later days never
 * get that fallback — a day that hasn't finished (or started) happening
 * isn't a "gap", it's just unknown — so they're flagged via `future` and
 * excluded from the total until WHOOP actually has real data for them.
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
  const nowMs = now.getTime();
  const isBoundary = (date: string) => date === calendarDays[0] || date === calendarDays[calendarDays.length - 1];

  // A cycle's resting/BMR-ish portion — its total minus whatever logged
  // activity happened during its actual span. Activity isn't split
  // proportionally like this is; it's added back exactly wherever it
  // happened, since each workout carries its own real timestamp.
  function nonActivityFor(cycle: Cycle): number {
    const cycleStartMs = cycle.start.getTime();
    const cycleEndMs = (cycle.end ?? now).getTime();
    const activityDuringCycle = nearbyWorkouts
      .filter((w) => w.timestamp.getTime() >= cycleStartMs && w.timestamp.getTime() < cycleEndMs)
      .reduce((sum, w) => sum + (w.kcalBurned ?? 0), 0);
    return Math.max((cycle.kcalBurned ?? 0) - activityDuringCycle, 0);
  }

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
      const overlapWeekMs = Math.max(0, Math.min(cycleEndMs, endMs) - Math.max(cycleStartMs, startMs));
      const fraction = overlapWeekMs / cycleDurationMs;

      const activityInWeek = nearbyWorkouts
        .filter((w) => w.timestamp.getTime() >= cycleStartMs && w.timestamp.getTime() < cycleEndMs)
        .filter((w) => w.timestamp.getTime() >= startMs && w.timestamp.getTime() < endMs)
        .reduce((s, w) => s + (w.kcalBurned ?? 0), 0);

      return sum + Math.round(nonActivityFor(cycle) * fraction) + activityInWeek;
    }, 0);

    return { kcal, kcalWeighted, scoreState: scored[0]?.scoreState ?? null };
  }

  // Today doesn't wait for "majority overlap" (which can't even be decided
  // until whatever cycle is covering it eventually ends) — it's a live,
  // continuously-growing figure: real overlap between every nearby cycle and
  // [midnight today, now], no averaging or guessing. This is usually the
  // still-open cycle from last night, so even a few minutes past midnight
  // gets a small, honest, non-zero number rather than either a full-day
  // estimate or nothing at all.
  function contributionForToday(): { kcal: number | null; kcalWeighted: number | null; scoreState: string | null } {
    const [todayStart] = dayBounds(todayKey);
    const todayStartMs = todayStart.getTime();

    const overlapping = nearbyCycles.filter((c) => c.start.getTime() < nowMs && (c.end ?? now).getTime() > todayStartMs);
    const scored = overlapping.filter((c) => c.kcalBurned !== null);
    if (scored.length === 0) return { kcal: null, kcalWeighted: null, scoreState: overlapping[0]?.scoreState ?? null };

    function burn(windowStartMs: number, windowEndMs: number): number {
      let total = 0;
      for (const cycle of scored) {
        const cycleStartMs = cycle.start.getTime();
        const cycleEndMs = (cycle.end ?? now).getTime();
        const cycleDurationMs = Math.max(cycleEndMs - cycleStartMs, 1);
        const overlapMs = Math.max(0, Math.min(cycleEndMs, windowEndMs) - Math.max(cycleStartMs, windowStartMs));
        if (overlapMs <= 0) continue;
        total += nonActivityFor(cycle) * (overlapMs / cycleDurationMs);
      }
      total += nearbyWorkouts
        .filter((w) => w.timestamp.getTime() >= windowStartMs && w.timestamp.getTime() < windowEndMs)
        .reduce((sum, w) => sum + (w.kcalBurned ?? 0), 0);
      return total;
    }

    const kcal = Math.round(burn(todayStartMs, nowMs));
    const weightedStartMs = Math.max(todayStartMs, startMs);
    const weightedEndMs = Math.min(nowMs, endMs);
    const kcalWeighted = weightedEndMs > weightedStartMs ? Math.round(burn(weightedStartMs, weightedEndMs)) : 0;

    return { kcal, kcalWeighted, scoreState: scored[scored.length - 1]?.scoreState ?? null };
  }

  let weeklyBudget = 0;
  let hasAnyData = false;
  const dailyBurn: WhoopDailyBurn[] = calendarDays.map((date) => {
    const isToday = date === todayKey;
    const result = isToday ? contributionForToday() : contributionForDay(date);
    // Today counts as "not yet known" only if there's genuinely no cycle
    // covering any part of it yet (rare — usually last night's cycle is
    // still open). Later days are always unknown until they arrive.
    const future = date > todayKey || (isToday && result.kcal === null);

    let kcal = result.kcal;
    let kcalWeighted = result.kcalWeighted;
    let estimated = false;

    // Only backfill past days with genuinely missing data (a real sync gap)
    // — never today (handled live above) or later, where the burn simply
    // hasn't happened yet.
    if (!isToday && kcal === null && trailingAvg !== null && !future) {
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

export interface WhoopRecentDay {
  date: string;
  recoveryScore: number | null;
  sleepPerformance: number | null;
  sleepMinutes: number | null;
}

/**
 * Last `days` days of recovery + sleep, one row per calendar day with either
 * kind of data, oldest first. A sleep is attributed to the day you woke up
 * (its `end`), matching how WHOOP's own app pairs a night's sleep with that
 * morning's recovery — the two line up on the same row here for that reason.
 */
export async function getRecentSleepRecovery(userId: number, days: number): Promise<WhoopRecentDay[]> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const [recoveries, sleeps] = await Promise.all([
    prisma.whoopRecovery.findMany({ where: { userId, date: { gte: localDayKey(since, config.TIMEZONE) } } }),
    prisma.whoopSleep.findMany({ where: { userId, end: { gte: since } } }),
  ]);

  const byDate = new Map<string, WhoopRecentDay>();
  function forDate(date: string): WhoopRecentDay {
    let row = byDate.get(date);
    if (!row) {
      row = { date, recoveryScore: null, sleepPerformance: null, sleepMinutes: null };
      byDate.set(date, row);
    }
    return row;
  }

  for (const r of recoveries) {
    forDate(r.date).recoveryScore = r.recoveryScore;
  }
  for (const s of sleeps) {
    const row = forDate(localDayKey(s.end, config.TIMEZONE));
    row.sleepPerformance = s.performancePercent;
    row.sleepMinutes = s.timeAsleepMin;
  }

  return Array.from(byDate.values()).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}
