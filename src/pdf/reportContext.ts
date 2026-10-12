import { prisma } from "../db";
import { localDayKey } from "../matchWeek";
import { estimateTdee } from "../sexConstant";
import { getWhoopWeekBudget } from "../whoop/sync";
import type { ReportContext } from "./weekSummary";

/**
 * Everything the report's summary needs beyond the week's own entries: what
 * each day is measured against, the exercise, and the weigh-ins.
 *
 * The reference is the same one the app's week strip uses (dailyReference in
 * public/app.js): the user's daily target, or failing that the Mifflin-St
 * Jeor estimate. A tracker's measured burn, where there is one for a day,
 * comes first — as it does on the screen.
 */
export async function loadReportContext(
  userId: number,
  week: { startsAt: Date; endsAt: Date },
  timeZone: string,
): Promise<ReportContext> {
  const startKey = localDayKey(week.startsAt, timeZone);
  const endKey = localDayKey(new Date(week.endsAt.getTime() - 1), timeZone);

  const [user, exercises, weighIns, whoop] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { dailyCalorieTarget: true, weightKg: true, heightCm: true, ageYears: true, activityLevel: true, sex: true },
    }),
    prisma.exercise.findMany({
      where: { matchWeek: { userId }, timestamp: { gte: week.startsAt, lt: week.endsAt } },
      select: { kcalBurned: true },
    }),
    prisma.weighIn.findMany({
      where: { userId, date: { gte: startKey, lte: endKey } },
      orderBy: { date: "asc" },
      select: { date: true, weightKg: true },
    }),
    // A tracker that can't be read costs the report its measured burn and
    // nothing else: the days fall back to the target, as they would on screen.
    getWhoopWeekBudget(userId, week.startsAt, week.endsAt).catch((error) => {
      console.error("Weekly report: couldn't read the WHOOP burn", error);
      return null;
    }),
  ]);

  const target = user?.dailyCalorieTarget ?? null;
  const estimate = user ? estimateTdee(user) : null;
  const reference = target
    ? { kcal: target, kind: "target" as const }
    : estimate
      ? { kcal: Math.round(estimate), kind: "estimate" as const }
      : null;

  const measuredBurn: Record<string, number> = {};
  for (const day of whoop?.dailyBurn ?? []) {
    if (!day.future && day.kcalWeighted != null) measuredBurn[day.date] = Math.round(day.kcalWeighted);
  }

  return {
    reference,
    measuredBurn,
    exercise: {
      count: exercises.length,
      kcal: exercises.reduce((sum, exercise) => sum + (exercise.kcalBurned ?? 0), 0),
    },
    weighIns,
  };
}
