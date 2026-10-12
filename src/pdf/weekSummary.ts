import { localDayKey, matchWeekCalendarDays, weightedDaysLogged } from "../matchWeek";

/**
 * The figures for the top of the weekly report: the week in a few numbers and
 * a day-by-day chart, worked out the same way the My week screen works them
 * out, so the PDF and the app never tell the same week two different ways.
 *
 * Pure: everything that needs the database arrives in a ReportContext (see
 * reportContext.ts), so this can be tested without one.
 */

/** The user's own daily target, or failing that the Mifflin-St Jeor estimate. */
export interface DailyReference {
  kcal: number;
  kind: "target" | "estimate";
}

export interface ReportContext {
  /** What a day is measured against when there is no measured burn for it. */
  reference: DailyReference | null;
  /**
   * Measured burn per local day (YYYY-MM-DD), from a connected tracker. Only
   * days whose burn is actually known: a day that hasn't finished happening
   * is left out rather than given a guess.
   */
  measuredBurn: Record<string, number>;
  exercise: { count: number; kcal: number };
  /** In date order. */
  weighIns: { date: string; weightKg: number }[];
}

export type DayVerdict = "under" | "over" | "open" | "logged" | "none" | "future";

export interface SummaryDay {
  date: string;
  /** "Mon" */
  weekday: string;
  /** 12 */
  dayOfMonth: number;
  kcal: number;
  /** What the day was measured against, if anything. */
  against: number | null;
  againstKind: "measured" | "target" | "estimate" | null;
  verdict: DayVerdict;
}

export interface WeekSummary {
  days: SummaryDay[];
  totalKcal: number;
  /** Weighted the way the app weights them: the boundary Mondays count as half. */
  daysLogged: number;
  dailyAverage: number;
  under: number;
  over: number;
  /** Eaten less what it was measured against, as the app's balance card has it. Negative is under. */
  balance: number | null;
  /** True when at least one day is measured against a tracker's burn. */
  usesMeasured: boolean;
  reference: DailyReference | null;
  macros: { protein: number; carbs: number; fat: number };
  exercise: { count: number; kcal: number };
  weightChangeKg: number | null;
  weighInCount: number;
  /** Entries with no kcal yet — left out of every total above. */
  unestimated: number;
}

interface SummaryEntry {
  timestamp: Date;
  kcal: number | null;
  proteinG?: number | null;
  carbsG?: number | null;
  fatG?: number | null;
}

const weekdayFmt = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "short" });

export function buildWeekSummary(
  week: { startsAt: Date; endsAt: Date },
  entries: SummaryEntry[],
  context: ReportContext,
  timeZone: string,
  now: Date = new Date(),
): WeekSummary {
  const kcalByDay = new Map<string, number>();
  const macros = { protein: 0, carbs: 0, fat: 0 };
  let unestimated = 0;

  for (const entry of entries) {
    const key = localDayKey(entry.timestamp, timeZone);
    if (entry.kcal === null) unestimated += 1;
    kcalByDay.set(key, (kcalByDay.get(key) ?? 0) + (entry.kcal ?? 0));
    macros.protein += entry.proteinG ?? 0;
    macros.carbs += entry.carbsG ?? 0;
    macros.fat += entry.fatG ?? 0;
  }

  const weekStart = week.startsAt;
  const todayKey = localDayKey(now, timeZone);
  // Once the week has closed, its last day is done too — the report that
  // goes out at the boundary is written on that day, and shouldn't call it
  // still going.
  const weekOver = now.getTime() >= week.endsAt.getTime();
  let under = 0;
  let over = 0;

  const days = matchWeekCalendarDays(weekStart, timeZone).map((date): SummaryDay => {
    const [year, month, dayOfMonth] = date.split("-").map(Number) as [number, number, number];
    const weekday = weekdayFmt.format(new Date(Date.UTC(year, month - 1, dayOfMonth, 12)));
    const kcal = kcalByDay.get(date) ?? 0;

    const measured = context.measuredBurn[date] ?? null;
    const against = measured ?? context.reference?.kcal ?? null;
    const againstKind = measured != null ? "measured" : (context.reference?.kind ?? null);

    let verdict: DayVerdict;
    if (date > todayKey && !weekOver) {
      verdict = "future";
    } else if (kcal > 0 && against != null) {
      // The app's rule (renderFormGuide): today counts the moment it goes
      // over, but never as under until it is done — being under at four in
      // the afternoon is just the day not being finished.
      const net = kcal - against;
      const settled = weekOver || date !== todayKey || net > 0;
      if (!settled) {
        verdict = "open";
      } else {
        verdict = net <= 0 ? "under" : "over";
        if (verdict === "under") under += 1;
        else over += 1;
      }
    } else {
      verdict = kcal > 0 ? "logged" : "none";
    }

    return { date, weekday, dayOfMonth, kcal, against, againstKind, verdict };
  });

  const usesMeasured = days.some((day) => day.againstKind === "measured");
  const totalKcal = [...kcalByDay.values()].reduce((sum, kcal) => sum + kcal, 0);
  const loggedKeys = [...kcalByDay.keys()];
  const daysLogged = weightedDaysLogged(loggedKeys, weekStart, timeZone);

  // The same sum the My week screen's balance card does (renderBudgetWidget):
  // everything eaten against everything a tracker measured, or against the
  // reference for the days logged — a boundary Monday counting as half, so a
  // week isn't credited a whole day's target for an evening.
  let balance: number | null = null;
  if (usesMeasured) {
    const burned = days.reduce((sum, day) => sum + (day.againstKind === "measured" ? day.against! : 0), 0);
    balance = totalKcal - burned;
  } else if (context.reference && daysLogged > 0) {
    balance = totalKcal - Math.round(context.reference.kcal * daysLogged);
  }

  // Two weigh-ins is the least that says anything; one is a reading, not a change.
  const { weighIns } = context;
  const weightChangeKg =
    weighIns.length >= 2
      ? Math.round((weighIns[weighIns.length - 1]!.weightKg - weighIns[0]!.weightKg) * 10) / 10
      : null;

  return {
    days,
    totalKcal,
    daysLogged,
    dailyAverage: daysLogged > 0 ? Math.round(totalKcal / daysLogged) : 0,
    under,
    over,
    balance: balance === null ? null : Math.round(balance),
    usesMeasured,
    reference: context.reference,
    macros,
    exercise: context.exercise,
    weightChangeKg,
    weighInCount: weighIns.length,
    unestimated,
  };
}
