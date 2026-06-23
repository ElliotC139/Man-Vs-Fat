import { Router } from "express";
import { prisma } from "../db";
import { config, driveConfigured } from "../config";
import { getMatchWeekBoundaries, localDayKey } from "../matchWeek";
import { generateMatchWeekReport } from "../pdf/generateReport";
import { uploadReportToDrive } from "../drive/uploadToDrive";

export const matchWeeksRouter = Router();

function summarize(entries: { kcal: number | null; timestamp: Date }[]) {
  const totalKcal = entries.reduce((sum, e) => sum + (e.kcal ?? 0), 0);
  const daysLogged = new Set(entries.map((e) => localDayKey(e.timestamp, config.TIMEZONE))).size;
  const dailyAverage = daysLogged > 0 ? Math.round(totalKcal / daysLogged) : 0;
  // Entries can land with kcal: null when the estimator couldn't get a guess
  // (e.g. a transient upstream error) — surfaced so the total doesn't read as
  // a silent, misleading zero.
  const pendingEstimates = entries.filter((e) => e.kcal === null).length;
  return { totalKcal, daysLogged, dailyAverage, pendingEstimates };
}

matchWeeksRouter.get("/current", async (_req, res) => {
  const { start, end } = getMatchWeekBoundaries(new Date(), config.TIMEZONE);

  const week = await prisma.matchWeek.findUnique({
    where: { startsAt_endsAt: { startsAt: start, endsAt: end } },
    include: { entries: { orderBy: { timestamp: "asc" } } },
  });

  const entries = week?.entries ?? [];
  res.json({
    id: week?.id ?? null,
    startsAt: start,
    endsAt: end,
    entries,
    ...summarize(entries),
  });
});

matchWeeksRouter.get("/current/report.pdf", async (_req, res) => {
  const { start, end } = getMatchWeekBoundaries(new Date(), config.TIMEZONE);

  const week = await prisma.matchWeek.findUnique({
    where: { startsAt_endsAt: { startsAt: start, endsAt: end } },
    include: { entries: { orderBy: { timestamp: "asc" } } },
  });

  // No MatchWeek row exists yet until the first entry is logged; the PDF
  // generator only reads startsAt/endsAt/entries, so an empty stub renders
  // a valid "nothing logged this week" report instead of erroring.
  const weekForPdf = week ?? {
    id: 0,
    startsAt: start,
    endsAt: end,
    reportGeneratedAt: null,
    reportDriveFileId: null,
    reportDriveUrl: null,
    entries: [],
  };

  try {
    const pdfBuffer = await generateMatchWeekReport(weekForPdf, config.TIMEZONE);
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
  const week = await prisma.matchWeek.findUnique({ where: { id }, include: { entries: true } });
  if (!week) {
    res.status(404).json({ error: "Match week not found" });
    return;
  }

  try {
    const pdfBuffer = await generateMatchWeekReport(week, config.TIMEZONE);
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
