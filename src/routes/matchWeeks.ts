import { Router } from "express";
import { prisma } from "../db";
import { config, driveConfigured } from "../config";
import { requireAuth } from "../auth";
import {
  getMatchWeekBoundariesForWeeksAgo,
  getUserWeekStart,
  localDayKey,
  matchWeekCalendarDays,
  weightedDaysLogged,
} from "../matchWeek";
import { generateMatchWeekReport } from "../pdf/generateReport";
import { getWeekInsights, previousWeekNumbers } from "../weekReview";
import { sumMacros } from "../macros";
import { dayNotesForWeek } from "../dayNotes";
import { uploadReportToDrive } from "../drive/uploadToDrive";
import { getWhoopWeekBudget } from "../whoop/sync";
import { normalizeLabel } from "./foods";

export const matchWeeksRouter = Router();
matchWeeksRouter.use(requireAuth);

function summarize(
  start: Date,
  entries: { kcal: number | null; timestamp: Date }[],
  exercises: { kcalBurned: number | null }[],
) {
  const totalKcal = entries.reduce((sum, e) => sum + (e.kcal ?? 0), 0);
  const exerciseTotalKcal = exercises.reduce((sum, ex) => sum + (ex.kcalBurned ?? 0), 0);
  const loggedDayKeys = new Set(entries.map((e) => localDayKey(e.timestamp, config.TIMEZONE)));
  const daysLogged = weightedDaysLogged(loggedDayKeys, start, config.TIMEZONE);
  const dailyAverage = daysLogged > 0 ? Math.round(totalKcal / daysLogged) : 0;
  const pendingEstimates = entries.filter((e) => e.kcal === null).length;
  return { totalKcal, exerciseTotalKcal, daysLogged, dailyAverage, pendingEstimates };
}

// Every calendar day the week touches, not just the ones with entries, so the
// UI can show a full Mon-Mon shape rather than only days something was logged.
function dailyTotals(
  start: Date,
  entries: {
    kcal: number | null;
    timestamp: Date;
    proteinG?: number | null;
    carbsG?: number | null;
    fatG?: number | null;
  }[],
) {
  const totals = new Map<string, { kcal: number; pending: boolean; entries: typeof entries }>();
  for (const entry of entries) {
    const key = localDayKey(entry.timestamp, config.TIMEZONE);
    const bucket = totals.get(key) ?? { kcal: 0, pending: false, entries: [] };
    if (entry.kcal === null) bucket.pending = true;
    else bucket.kcal += entry.kcal;
    bucket.entries.push(entry);
    totals.set(key, bucket);
  }

  const labelFmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: config.TIMEZONE,
    weekday: "short",
    day: "numeric",
    month: "short",
  });

  const todayKey = localDayKey(new Date(), config.TIMEZONE);

  return matchWeekCalendarDays(start, config.TIMEZONE).map((date) => {
    const bucket = totals.get(date) ?? { kcal: 0, pending: false, entries: [] };
    const [year, month, day] = date.split("-").map(Number) as [number, number, number];
    // Sent per day rather than only for today, so the diary can show a
    // macro line against any day in the week without another request.
    const macros = sumMacros(bucket.entries);
    return {
      date,
      label: labelFmt.format(new Date(Date.UTC(year, month - 1, day, 12))),
      kcal: bucket.kcal,
      pending: bucket.pending,
      isToday: date === todayKey,
      macros: {
        protein: macros.protein,
        carbs: macros.carbs,
        fat: macros.fat,
        // How many of the day's entries had no macro figures — every row
        // logged before macros existed has none, so a day mixing the two
        // has to say its total is partial rather than look complete.
        unknownEntries: macros.unknownEntries,
      },
    };
  });
}

/**
 * "31 Aug – 6 Sept", in the app's timezone. The end instant is exclusive —
 * the week ends the moment the next one begins — so the label steps back one
 * second to name the last day actually inside it.
 */
function weekRangeLabel(start: Date, end: Date): string {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: config.TIMEZONE,
    day: "numeric",
    month: "short",
  });
  return `${fmt.format(start)} – ${fmt.format(new Date(end.getTime() - 1000))}`;
}

function parseWeeksAgo(value: unknown): number {
  const n = Number.parseInt(String(value ?? "0"), 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

matchWeeksRouter.get("/current", async (req, res) => {
  const weeksAgo = parseWeeksAgo(req.query.weeksAgo);
  const weekStart = await getUserWeekStart(req.userId!);
  const { start, end } = getMatchWeekBoundariesForWeeksAgo(new Date(), weeksAgo, config.TIMEZONE, weekStart);

  const week = await prisma.matchWeek.findUnique({
    where: { userId_startsAt_endsAt: { userId: req.userId!, startsAt: start, endsAt: end } },
    include: {
      entries: { orderBy: { timestamp: "asc" } },
      exercises: { orderBy: { timestamp: "asc" } },
    },
  });

  const entries = week?.entries ?? [];
  const exercises = week?.exercises ?? [];
  const whoop = await getWhoopWeekBudget(req.userId!, start, end);
  res.json({
    id: week?.id ?? null,
    startsAt: start,
    endsAt: end,
    // Formatted here rather than in the browser. The client used to render
    // this from the boundary instants in *its* timezone, which agrees with
    // the app's only by luck: a 17:00 rollover is 16:00 UTC, the same date
    // either way, but a whole-day week starts at local midnight and lands on
    // the previous date for any viewer behind the app's timezone.
    rangeLabel: weekRangeLabel(start, end),
    weeksAgo,
    entries,
    // whoopWorkoutId is a BigInt (unserializable) and only exists to key
    // resyncs — swap it for a plain boolean the client can use to badge
    // auto-imported entries.
    exercises: exercises.map(({ whoopWorkoutId, ...rest }) => ({ ...rest, fromWhoop: whoopWorkoutId !== null })),
    dailyTotals: dailyTotals(start, entries),
    whoop,
    ...summarize(start, entries, exercises),
  });
});

/**
 * The same end-of-week review the PDF carries, as JSON, so it can be read in
 * the app without downloading a file. `refresh=1` forces a regeneration of a
 * week still in progress; without it a cached review is served as-is.
 */
matchWeeksRouter.get("/current/review", async (req, res) => {
  const weeksAgo = parseWeeksAgo(req.query.weeksAgo);
  const weekStart = await getUserWeekStart(req.userId!);
  const { start, end } = getMatchWeekBoundariesForWeeksAgo(new Date(), weeksAgo, config.TIMEZONE, weekStart);

  const week = await prisma.matchWeek.findUnique({
    where: { userId_startsAt_endsAt: { userId: req.userId!, startsAt: start, endsAt: end } },
    include: { entries: { orderBy: { timestamp: "asc" } }, exercises: true },
  });

  if (!week || week.entries.length === 0) {
    res.json({
      startsAt: start.toISOString(),
      endsAt: end.toISOString(),
      totalKcal: 0,
      dailyAverage: 0,
      daysLogged: 0,
      exerciseTotalKcal: 0,
      topFoods: [],
      busiestDay: null,
      insights: null,
      previousWeek: null,
      weekIsOver: end.getTime() <= Date.now(),
    });
    return;
  }

  const { totalKcal, exerciseTotalKcal, daysLogged, dailyAverage } = summarize(
    start,
    week.entries,
    week.exercises ?? [],
  );

  // The model call is skipped unless asked for, so opening the review is
  // instant and the user decides when to spend one.
  const insights = await getWeekInsights(week, {
    entries: week.entries,
    totalKcal,
    dailyAverage,
    daysLogged,
    dayNotes: await dayNotesForWeek(req.userId!, start),
    cachedOnly: req.query.refresh !== "1",
  });

  res.json({
    startsAt: start.toISOString(),
    endsAt: end.toISOString(),
    totalKcal,
    dailyAverage,
    daysLogged,
    exerciseTotalKcal,
    topFoods: topFoodsOf(week.entries),
    busiestDay: busiestDayOf(week.entries),
    insights,
    previousWeek: await previousWeekNumbers(req.userId!, start),
    weekIsOver: end.getTime() <= Date.now(),
  });
});

/** The three foods logged most often, with what they cost across the week. */
function topFoodsOf(entries: { label: string; kcal: number | null }[]) {
  const byKey = new Map<string, { label: string; count: number; totalKcal: number }>();
  for (const entry of entries) {
    const key = normalizeLabel(entry.label);
    if (!key) continue;
    const existing = byKey.get(key);
    if (existing) {
      existing.count += 1;
      existing.totalKcal += entry.kcal ?? 0;
    } else {
      byKey.set(key, { label: entry.label.trim(), count: 1, totalKcal: entry.kcal ?? 0 });
    }
  }
  return Array.from(byKey.values())
    .sort((a, b) => b.count - a.count || b.totalKcal - a.totalKcal)
    .slice(0, 3);
}

/** The heaviest day of the week, which is usually the one worth talking about. */
function busiestDayOf(entries: { kcal: number | null; timestamp: Date }[]) {
  const byDay = new Map<string, number>();
  for (const entry of entries) {
    const key = localDayKey(entry.timestamp, config.TIMEZONE);
    byDay.set(key, (byDay.get(key) ?? 0) + (entry.kcal ?? 0));
  }
  let best: { date: string; kcal: number } | null = null;
  for (const [date, kcal] of byDay) {
    if (!best || kcal > best.kcal) best = { date, kcal };
  }
  return best;
}

matchWeeksRouter.get("/current/report.pdf", async (req, res) => {
  const weeksAgo = parseWeeksAgo(req.query.weeksAgo);
  const weekStart = await getUserWeekStart(req.userId!);
  const { start, end } = getMatchWeekBoundariesForWeeksAgo(new Date(), weeksAgo, config.TIMEZONE, weekStart);

  const week = await prisma.matchWeek.findUnique({
    where: { userId_startsAt_endsAt: { userId: req.userId!, startsAt: start, endsAt: end } },
    include: { entries: { orderBy: { timestamp: "asc" } } },
  });

  // No MatchWeek row exists yet until the first entry is logged; the PDF
  // generator only reads startsAt/endsAt/entries, so an empty stub renders
  // a valid "nothing logged this week" report instead of erroring.
  const weekForPdf = week ?? {
    id: 0,
    userId: req.userId!,
    startsAt: start,
    endsAt: end,
    reportGeneratedAt: null,
    reportDriveFileId: null,
    reportDriveUrl: null,
    insightsJson: null,
    insightsAt: null,
    entries: [],
  };

  try {
    const { totalKcal, daysLogged, dailyAverage } = summarize(start, weekForPdf.entries, []);
    const insights = await getWeekInsights(weekForPdf, {
      entries: weekForPdf.entries,
      totalKcal,
      dailyAverage,
      daysLogged,
      dayNotes: await dayNotesForWeek(req.userId!, start),
    });
    const pdfBuffer = await generateMatchWeekReport(weekForPdf, config.TIMEZONE, insights);
    const fileName = `${localDayKey(start, config.TIMEZONE)}.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error("On-demand report export failed:", error);
    res.status(500).json({ error: "Report generation failed" });
  }
});

matchWeeksRouter.post("/:id/generate-report", async (req, res) => {
  const id = Number(req.params.id);
  const week = await prisma.matchWeek.findUnique({ where: { id }, include: { entries: true, exercises: true } });
  if (!week || week.userId !== req.userId) {
    res.status(404).json({ error: "Match week not found" });
    return;
  }

  try {
    const { totalKcal, daysLogged, dailyAverage } = summarize(week.startsAt, week.entries, week.exercises ?? []);
    const insights = await getWeekInsights(week, {
      entries: week.entries,
      totalKcal,
      dailyAverage,
      daysLogged,
      dayNotes: await dayNotesForWeek(req.userId!, week.startsAt),
    });
    const pdfBuffer = await generateMatchWeekReport(week, config.TIMEZONE, insights);
    const fileName = `${localDayKey(week.startsAt, config.TIMEZONE)}.pdf`;

    let driveFileId: string | undefined;
    let driveUrl: string | undefined;
    if (driveConfigured) {
      const uploaded = await uploadReportToDrive(fileName, pdfBuffer);
      driveFileId = uploaded.fileId;
      driveUrl = uploaded.webViewLink;
    }

    const updated = await prisma.matchWeek.update({
      where: { id: week.id },
      data: { reportGeneratedAt: new Date(), reportDriveFileId: driveFileId, reportDriveUrl: driveUrl },
    });

    res.json({ ...updated, driveConfigured });
  } catch (error) {
    console.error("Manual report generation failed:", error);
    res.status(500).json({ error: "Report generation failed" });
  }
});
