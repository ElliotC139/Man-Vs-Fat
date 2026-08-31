import { prisma } from "./db";
import { config } from "./config";
import { getMatchWeekBoundaries, type WeekStartConfig } from "./matchWeek";

/**
 * Re-files every entry and exercise into the weeks a new rollover setting
 * implies.
 *
 * Entries belong to a MatchWeek row keyed by its exact start/end instants, so
 * changing the rollover — the weekday, the time, or switching between whole
 * days and a set time — leaves everything filed under boundaries the app no
 * longer looks up. The data is all still there, but the diary shows an empty
 * week, which reads exactly like having lost it.
 *
 * This is deliberately done eagerly on the settings change rather than lazily
 * at read time: a diary that quietly re-interprets its own history on every
 * page load is far harder to reason about than one that reorganises once,
 * when you asked it to.
 */
export interface RefileResult {
  entriesMoved: number;
  exercisesMoved: number;
  weeksRemoved: number;
}

export async function refileMatchWeeks(userId: number, weekStart: WeekStartConfig): Promise<RefileResult> {
  const weeks = await prisma.matchWeek.findMany({
    where: { userId },
    include: { entries: { select: { id: true, timestamp: true } }, exercises: { select: { id: true, timestamp: true } } },
  });

  // Boundary key -> the row that owns it, created on demand. Grouping first
  // means one update per destination week rather than one per entry.
  const weekIdByKey = new Map<string, number>();
  const entryIdsByKey = new Map<string, number[]>();
  const exerciseIdsByKey = new Map<string, number[]>();

  const keyOf = (timestamp: Date) => {
    const { start, end } = getMatchWeekBoundaries(timestamp, config.TIMEZONE, weekStart);
    return `${start.toISOString()}|${end.toISOString()}`;
  };

  for (const week of weeks) {
    weekIdByKey.set(`${week.startsAt.toISOString()}|${week.endsAt.toISOString()}`, week.id);
    for (const entry of week.entries) {
      const key = keyOf(entry.timestamp);
      if (week.id === weekIdByKey.get(key)) continue;
      (entryIdsByKey.get(key) ?? entryIdsByKey.set(key, []).get(key)!).push(entry.id);
    }
    for (const exercise of week.exercises) {
      const key = keyOf(exercise.timestamp);
      if (week.id === weekIdByKey.get(key)) continue;
      (exerciseIdsByKey.get(key) ?? exerciseIdsByKey.set(key, []).get(key)!).push(exercise.id);
    }
  }

  async function weekIdFor(key: string): Promise<number> {
    const existing = weekIdByKey.get(key);
    if (existing !== undefined) return existing;
    const [startsAt, endsAt] = key.split("|") as [string, string];
    const created = await prisma.matchWeek.upsert({
      where: { userId_startsAt_endsAt: { userId, startsAt: new Date(startsAt), endsAt: new Date(endsAt) } },
      update: {},
      create: { userId, startsAt: new Date(startsAt), endsAt: new Date(endsAt) },
    });
    weekIdByKey.set(key, created.id);
    return created.id;
  }

  let entriesMoved = 0;
  for (const [key, ids] of entryIdsByKey) {
    const matchWeekId = await weekIdFor(key);
    const { count } = await prisma.entry.updateMany({ where: { id: { in: ids } }, data: { matchWeekId } });
    entriesMoved += count;
  }

  let exercisesMoved = 0;
  for (const [key, ids] of exerciseIdsByKey) {
    const matchWeekId = await weekIdFor(key);
    const { count } = await prisma.exercise.updateMany({ where: { id: { in: ids } }, data: { matchWeekId } });
    exercisesMoved += count;
  }

  // A cached weekly review describes a week that has just been re-sliced, so
  // it's no longer about the days it claims to be about. Cleared rather than
  // regenerated: regenerating costs a model call per week, and the review is
  // only ever produced on request anyway.
  if (entriesMoved > 0 || exercisesMoved > 0) {
    await prisma.matchWeek.updateMany({
      where: { userId, insightsJson: { not: null } },
      data: { insightsJson: null, insightsAt: null },
    });
  }

  // Weeks left holding nothing are tidied away — but never one that has a
  // generated report attached, since that's a record of something that was
  // actually produced and filed in Drive.
  const emptied = await prisma.matchWeek.findMany({
    where: {
      userId,
      reportDriveFileId: null,
      entries: { none: {} },
      exercises: { none: {} },
    },
    select: { id: true },
  });
  const { count: weeksRemoved } = await prisma.matchWeek.deleteMany({
    where: { id: { in: emptied.map((week) => week.id) } },
  });

  return { entriesMoved, exercisesMoved, weeksRemoved };
}
