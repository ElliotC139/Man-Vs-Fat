/**
 * Consecutive days finishing under your burn.
 *
 * The whole thing is computed over **calendar days**, never over match
 * weeks, and that distinction is the point. A match week runs Monday
 * evening to Monday evening, so its day list has eight entries with a
 * Monday at each end. Walking match weeks would see every Monday twice and
 * judge each half against a full day's burn — a Monday would break the
 * streak on the half where you'd only eaten breakfast. Grouping raw entries
 * by their local calendar day instead means both halves of a Monday land in
 * the same bucket and are judged once, as one day.
 */

export interface DayVerdict {
  /** Local calendar day, YYYY-MM-DD. */
  date: string;
  /** True = finished under burn, false = over, null = no way to judge. */
  deficit: boolean | null;
}

export interface StreakRun {
  days: number;
  startDate: string;
  endDate: string;
}

export interface DeficitStreak {
  /** Consecutive days up to and including the most recent judged day. */
  current: number;
  currentStartDate: string | null;
  best: StreakRun | null;
  /** How many days had enough data to judge at all. */
  judgedDays: number;
}

/**
 * `days` must be sorted oldest-first and contain one entry per calendar day
 * in the range, including days with nothing logged — a gap has to be
 * present as a null verdict, otherwise two runs either side of an unlogged
 * week would silently join into one long streak.
 *
 * A day that can't be judged breaks the run rather than being skipped: a
 * deficit you didn't record isn't a deficit you can claim.
 */
export function computeDeficitStreak(days: DayVerdict[]): DeficitStreak {
  let best: StreakRun | null = null;
  let runLength = 0;
  let runStart: string | null = null;
  let judgedDays = 0;

  // Tracks the run that is still alive at the end of the array, which is
  // the only one that can be "current".
  let current = 0;
  let currentStartDate: string | null = null;

  for (const day of days) {
    if (day.deficit === null) {
      runLength = 0;
      runStart = null;
      continue;
    }
    judgedDays += 1;

    if (!day.deficit) {
      runLength = 0;
      runStart = null;
      continue;
    }

    if (runLength === 0) runStart = day.date;
    runLength += 1;

    if (!best || runLength > best.days) {
      best = { days: runLength, startDate: runStart!, endDate: day.date };
    } else if (runLength === best.days && runStart === best.startDate) {
      // The run that set the record is still growing — extend it rather
      // than leaving the end date behind.
      best = { days: runLength, startDate: runStart!, endDate: day.date };
    }
  }

  // Whatever run survived to the last element is the current one.
  const last = days[days.length - 1];
  if (last && last.deficit === true) {
    current = runLength;
    currentStartDate = runStart;
  }

  return { current, currentStartDate, best, judgedDays };
}
