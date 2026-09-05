import { prisma } from "./db";
import { config } from "./config";
import { generateWeekInsights, type WeekInsights } from "./insights";
import { localDayKey } from "./matchWeek";

/**
 * The end-of-week review, shared by the in-app card and the PDF.
 *
 * The AI half of it costs a model call, so it's cached on the MatchWeek row
 * (see insightsJson in the schema) and only regenerated when the week has
 * actually moved on — otherwise opening the review twice would bill twice for
 * the same four paragraphs.
 */

// A week still being logged shouldn't be stuck with the review written after
// its first two entries, so a cached review this old is refreshed.
const STALE_AFTER_MS = 6 * 60 * 60 * 1000;

export interface ReviewEntry {
  label: string;
  kcal: number | null;
  timestamp: Date;
  // Null for an entry the user deliberately left untagged.
  mealType: string | null;
}

export function parseCachedInsights(json: string | null): WeekInsights | null {
  if (!json) return null;
  try {
    return JSON.parse(json) as WeekInsights;
  } catch {
    // A row written by an older shape shouldn't poison the review — it's
    // simply regenerated.
    return null;
  }
}

export async function getWeekInsights(week: {
  id: number;
  startsAt: Date;
  endsAt: Date;
  insightsJson: string | null;
  insightsAt: Date | null;
}, params: {
  entries: ReviewEntry[];
  totalKcal: number;
  dailyAverage: number;
  daysLogged: number;
  dayNotes?: { date: string; note: string }[];
  /** Skips the model call and returns only what's already cached. */
  cachedOnly?: boolean;
}): Promise<WeekInsights | null> {
  const cached = parseCachedInsights(week.insightsJson);

  // A finished week can never change, so its review is cached forever.
  const weekIsOver = week.endsAt.getTime() <= Date.now();
  const age = week.insightsAt ? Date.now() - week.insightsAt.getTime() : Infinity;
  if (cached && (weekIsOver || age < STALE_AFTER_MS)) return cached;
  if (params.cachedOnly) return cached;

  const insights = await generateWeekInsights({
    entries: params.entries,
    totalKcal: params.totalKcal,
    dailyAverage: params.dailyAverage,
    daysLogged: params.daysLogged,
    dayNotes: params.dayNotes,
    timeZone: config.TIMEZONE,
  });
  // A failed generation keeps whatever was cached rather than blanking it.
  if (!insights) return cached;

  // id 0 is the stub used for a week with no entries yet (see the PDF route),
  // which has no row to write to.
  if (week.id !== 0) {
    await prisma.matchWeek.update({
      where: { id: week.id },
      data: { insightsJson: JSON.stringify(insights), insightsAt: new Date() },
    });
  }
  return insights;
}

export interface WeekComparison {
  totalKcal: number | null;
  dailyAverage: number | null;
  daysLogged: number | null;
}

/**
 * Last week's headline numbers, for the "vs last week" line. Null throughout
 * when there's no previous week — an unlogged week compared against would
 * read as a dramatic improvement rather than as no data.
 */
export async function previousWeekNumbers(
  userId: number,
  startsAt: Date,
): Promise<WeekComparison | null> {
  const previous = await prisma.matchWeek.findFirst({
    where: { userId, endsAt: { lte: startsAt } },
    orderBy: { startsAt: "desc" },
    include: { entries: { select: { kcal: true, timestamp: true } } },
  });
  if (!previous || previous.entries.length === 0) return null;

  const totalKcal = previous.entries.reduce((sum, e) => sum + (e.kcal ?? 0), 0);
  const daysLogged = new Set(previous.entries.map((e) => localDayKey(e.timestamp, config.TIMEZONE))).size;
  return {
    totalKcal,
    daysLogged,
    dailyAverage: daysLogged > 0 ? Math.round(totalKcal / daysLogged) : null,
  };
}
