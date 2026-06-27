import { prisma } from "./db";

const WEEKDAYS_MON_FIRST = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

interface LocalParts {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekday: string; // "Mon" .. "Sun"
}

export function getLocalParts(date: Date, timeZone: string): LocalParts {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts: Record<string, string> = {};
  for (const part of dtf.formatToParts(date)) {
    parts[part.type] = part.value;
  }
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
    weekday: parts.weekday ?? "Mon",
  };
}

/**
 * Resolves the UTC instant for a given wall-clock date/time *as observed in*
 * `timeZone`. Standard fixed-point trick: guess the offset by formatting the
 * UTC-naive guess in the target zone, then correct for it. Two passes is
 * enough to settle even across a DST transition.
 */
export function zonedTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
): Date {
  let guess = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  for (let i = 0; i < 2; i++) {
    const observed = getLocalParts(new Date(guess), timeZone);
    const observedAsUtc = Date.UTC(
      observed.year,
      observed.month - 1,
      observed.day,
      observed.hour,
      observed.minute,
      observed.second,
    );
    const driftMs = observedAsUtc - guess;
    guess = Date.UTC(year, month - 1, day, hour, minute, 0, 0) - driftMs;
  }
  return new Date(guess);
}

function addDaysToCalendarDate(year: number, month: number, day: number, deltaDays: number) {
  // Noon UTC avoids any DST edge weirdness in pure calendar-date arithmetic.
  const d = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  d.setUTCDate(d.getUTCDate() + deltaDays);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

export interface MatchWeekBoundary {
  start: Date;
  end: Date;
}

/**
 * Match week runs Monday 17:00 -> following Monday 17:00 in `timeZone`.
 * Anything logged before 17:00 on a Monday belongs to the closing week.
 */
export function getMatchWeekBoundaries(date: Date, timeZone: string): MatchWeekBoundary {
  const local = getLocalParts(date, timeZone);
  const weekdayIndex = WEEKDAYS_MON_FIRST.indexOf(local.weekday);
  const mondayOfThisCalendarWeek = addDaysToCalendarDate(
    local.year,
    local.month,
    local.day,
    -weekdayIndex,
  );

  let start = zonedTimeToUtc(
    mondayOfThisCalendarWeek.year,
    mondayOfThisCalendarWeek.month,
    mondayOfThisCalendarWeek.day,
    17,
    0,
    timeZone,
  );

  if (date.getTime() < start.getTime()) {
    const priorMonday = addDaysToCalendarDate(
      mondayOfThisCalendarWeek.year,
      mondayOfThisCalendarWeek.month,
      mondayOfThisCalendarWeek.day,
      -7,
    );
    start = zonedTimeToUtc(priorMonday.year, priorMonday.month, priorMonday.day, 17, 0, timeZone);
  }

  const startLocal = getLocalParts(start, timeZone);
  const nextMonday = addDaysToCalendarDate(startLocal.year, startLocal.month, startLocal.day, 7);
  const end = zonedTimeToUtc(nextMonday.year, nextMonday.month, nextMonday.day, 17, 0, timeZone);

  return { start, end };
}

/**
 * Boundaries for the match week `weeksAgo` weeks before the one containing
 * `referenceDate` (0 = that week itself). Shifts by whole weeks on the
 * calendar-date arithmetic already used above, so it's immune to the same
 * DST edge cases as `getMatchWeekBoundaries`.
 */
export function getMatchWeekBoundariesForWeeksAgo(
  referenceDate: Date,
  weeksAgo: number,
  timeZone: string,
): MatchWeekBoundary {
  const current = getMatchWeekBoundaries(referenceDate, timeZone);
  if (weeksAgo <= 0) return current;

  const startLocal = getLocalParts(current.start, timeZone);
  const shiftedStart = addDaysToCalendarDate(startLocal.year, startLocal.month, startLocal.day, -weeksAgo * 7);
  const start = zonedTimeToUtc(shiftedStart.year, shiftedStart.month, shiftedStart.day, 17, 0, timeZone);
  const shiftedEnd = addDaysToCalendarDate(shiftedStart.year, shiftedStart.month, shiftedStart.day, 7);
  const end = zonedTimeToUtc(shiftedEnd.year, shiftedEnd.month, shiftedEnd.day, 17, 0, timeZone);
  return { start, end };
}

/**
 * The (up to 8) local calendar dates a match week touches, in order: the
 * Monday it opens on (from 17:00), the six full days after, and the
 * following Monday (up to 17:00).
 */
export function matchWeekCalendarDays(start: Date, timeZone: string): string[] {
  const startLocal = getLocalParts(start, timeZone);
  const days: string[] = [];
  for (let i = 0; i < 8; i++) {
    const { year, month, day } = addDaysToCalendarDate(startLocal.year, startLocal.month, startLocal.day, i);
    days.push(`${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`);
  }
  return days;
}

/** Finds the MatchWeek row covering `date`, creating it if this is the first entry in it. */
export async function findOrCreateMatchWeek(date: Date, timeZone: string) {
  const { start, end } = getMatchWeekBoundaries(date, timeZone);
  return prisma.matchWeek.upsert({
    where: { startsAt_endsAt: { startsAt: start, endsAt: end } },
    update: {},
    create: { startsAt: start, endsAt: end },
  });
}

/**
 * Number of days represented by a set of locally-logged calendar-day keys
 * within a match week. The week's two edge dates — the opening Monday
 * (from 17:00) and the closing Monday (until 17:00) — together span only
 * one real day, so each counts as half a day rather than a full one; a
 * fully-logged week then sums to 7 days, not 8.
 */
export function weightedDaysLogged(loggedDayKeys: Iterable<string>, weekStart: Date, timeZone: string): number {
  const calendarDays = matchWeekCalendarDays(weekStart, timeZone);
  const halfDayKeys = new Set([calendarDays[0], calendarDays[calendarDays.length - 1]]);
  let total = 0;
  for (const key of loggedDayKeys) {
    total += halfDayKeys.has(key) ? 0.5 : 1;
  }
  return total;
}

/** Local calendar-day key (YYYY-MM-DD) for grouping entries in a timezone-correct way. */
export function localDayKey(date: Date, timeZone: string): string {
  const { year, month, day } = getLocalParts(date, timeZone);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function localDayLabel(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(date);
}

export function localTimeLabel(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}
