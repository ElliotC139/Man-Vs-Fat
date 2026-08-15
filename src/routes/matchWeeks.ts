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
import { generateWeekInsights } from "../insights";
import { uploadReportToDrive } from "../drive/uploadToDrive";
import { getWhoopWeekBudget } from "../whoop/sync";

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
function dailyTotals(start: Date, entries: { kcal: number | null; timestamp: Date }[]) {
  const totals = new Map<string, { kcal: number; pending: boolean }>();
  for (const entry of entries) {
    const key = localDayKey(entry.timestamp, config.TIMEZONE);
    const bucket = totals.get(key) ?? { kcal: 0, pending: false };
    if (entry.kcal === null) bucket.pending = true;
    else bucket.kcal += entry.kcal;
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
    const bucket = totals.get(date) ?? { kcal: 0, pending: false };
    const [year, month, day] = date.split("-").map(Number) as [number, number, number];
    return {
      date,
      label: labelFmt.format(new Date(Date.UTC(year, month - 1, day, 12))),
      kcal: bucket.kcal,
      pending: bucket.pending,
      isToday: date === todayKey,
    };
  });
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
    weeksAgo,
    entries,
    exercises,
    dailyTotals: dailyTotals(start, entries),
    whoop,
    ...summarize(start, entries, exercises),
  });
});

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
    entries: [],
  };

  try {
    const { totalKcal, daysLogged, dailyAverage } = summarize(start, weekForPdf.entries, []);
    const insights = await generateWeekInsights({
      entries: weekForPdf.entries,
      totalKcal,
      dailyAverage,
      daysLogged,
      timeZone: config.TIMEZONE,
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
    const insights = await generateWeekInsights({
      entries: week.entries,
      totalKcal,
      dailyAverage,
      daysLogged,
      timeZone: config.TIMEZONE,
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
