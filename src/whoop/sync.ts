import { prisma } from "../db";
import { config } from "../config";
import { localDayKey, matchWeekCalendarDays } from "../matchWeek";
import { fetchRecentCycles, refreshAccessToken } from "./client";

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

/** Pulls recent cycles from WHOOP and upserts them; called after connect and on webhook pings. */
export async function syncUserCycles(userId: number): Promise<void> {
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
}

export interface WhoopDailyBurn {
  date: string;
  kcal: number | null;
  estimated: boolean;
  scoreState: string | null;
}

export interface WhoopWeekBudget {
  connected: true;
  lastSyncedAt: Date | null;
  weeklyBudget: number | null;
  dailyBurn: WhoopDailyBurn[];
}

/**
 * Sums this match week's WHOOP calorie burn, calendar-day weighted the same
 * way as the food side (boundary Mondays count as half a day). Days with no
 * scored cycle yet (most often "today", which WHOOP hasn't finalized) fall
 * back to the trailing average of the last week's scored days so the widget
 * never just goes blank for missing data.
 */
export async function getWhoopWeekBudget(userId: number, start: Date, end: Date): Promise<WhoopWeekBudget | null> {
  const conn = await prisma.whoopConnection.findUnique({ where: { userId } });
  if (!conn) return null;

  const [weekCycles, trailing] = await Promise.all([
    prisma.whoopCycle.findMany({ where: { userId, start: { gte: start, lt: end } }, orderBy: { start: "asc" } }),
    prisma.whoopCycle.findMany({
      where: { userId, kcalBurned: { not: null }, start: { lt: start } },
      orderBy: { start: "desc" },
      take: TRAILING_AVERAGE_SAMPLE,
    }),
  ]);

  const trailingAvg = trailing.length
    ? Math.round(trailing.reduce((sum, c) => sum + (c.kcalBurned ?? 0), 0) / trailing.length)
    : null;

  const byDay = new Map<string, { kcal: number | null; scoreState: string }>();
  for (const cycle of weekCycles) {
    byDay.set(localDayKey(cycle.start, config.TIMEZONE), { kcal: cycle.kcalBurned, scoreState: cycle.scoreState });
  }

  const calendarDays = matchWeekCalendarDays(start, config.TIMEZONE);
  const halfDayKeys = new Set([calendarDays[0], calendarDays[calendarDays.length - 1]]);

  let weeklyBudget = 0;
  let hasAnyData = false;
  const dailyBurn: WhoopDailyBurn[] = calendarDays.map((date) => {
    const weight = halfDayKeys.has(date) ? 0.5 : 1;
    const entry = byDay.get(date);
    let kcal = entry?.kcal ?? null;
    let estimated = false;
    if (kcal === null && trailingAvg !== null) {
      kcal = trailingAvg;
      estimated = true;
    }
    if (kcal !== null) {
      weeklyBudget += kcal * weight;
      hasAnyData = true;
    }
    return { date, kcal, estimated, scoreState: entry?.scoreState ?? null };
  });

  return {
    connected: true,
    lastSyncedAt: conn.lastSyncedAt,
    weeklyBudget: hasAnyData ? Math.round(weeklyBudget) : null,
    dailyBurn,
  };
}
