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

function getLocalParts(date: Date, timeZone: string): LocalParts {
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
function zonedTimeToUtc(
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

/** Finds the MatchWeek row covering `date`, creating it if this is the first entry in it. */
export async function findOrCreateMatchWeek(date: Date, timeZone: string) {
  const { start, end } = getMatchWeekBoundaries(date, timeZone);
  return prisma.matchWeek.upsert({
    where: { startsAt_endsAt: { startsAt: start, endsAt: end } },
    update: {},
    create: { startsAt: start, endsAt: end },
  });
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
