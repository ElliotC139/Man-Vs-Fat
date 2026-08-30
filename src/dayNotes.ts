import { prisma } from "./db";
import { config } from "./config";
import { matchWeekCalendarDays } from "./matchWeek";

/**
 * The notes covering one match week, for the weekly review.
 *
 * A match week spans eight calendar days (both boundary Mondays), and
 * matchWeekCalendarDays already knows that — deriving the range here from the
 * start and end instants instead would silently drop one of them.
 */
export async function dayNotesForWeek(
  userId: number,
  weekStart: Date,
): Promise<{ date: string; note: string }[]> {
  const days = matchWeekCalendarDays(weekStart, config.TIMEZONE);
  const notes = await prisma.dayNote.findMany({
    where: { userId, date: { in: days } },
    orderBy: { date: "asc" },
  });
  return notes.map((note) => ({ date: note.date, note: note.note }));
}
