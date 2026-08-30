import { prisma } from "../db";
import { config, driveConfigured } from "../config";
import { generateMatchWeekReport } from "../pdf/generateReport";
import { uploadReportToDrive } from "../drive/uploadToDrive";
import { localDayKey } from "../matchWeek";
import { recordError } from "../errorLog";

/**
 * Closes any match week whose boundary has passed but hasn't had a report
 * generated yet. Processes more than one if the server was offline across a
 * boundary, so a missed run never silently loses a week's report.
 */
export async function closeMatchWeeksNeedingReport(): Promise<void> {
  const dueWeeks = await prisma.matchWeek.findMany({
    where: { endsAt: { lte: new Date() }, reportGeneratedAt: null },
    orderBy: { startsAt: "asc" },
    include: { entries: true },
  });

  for (const week of dueWeeks) {
    try {
      const pdfBuffer = await generateMatchWeekReport(week, config.TIMEZONE);
      const fileName = `${localDayKey(week.startsAt, config.TIMEZONE)}.pdf`;

      let driveFileId: string | undefined;
      let driveUrl: string | undefined;

      if (driveConfigured) {
        const uploaded = await uploadReportToDrive(fileName, pdfBuffer);
        driveFileId = uploaded.fileId;
        driveUrl = uploaded.webViewLink;
      } else {
        console.warn(`Drive isn't configured; report for week ${fileName} was generated but not uploaded.`);
      }

      await prisma.matchWeek.update({
        where: { id: week.id },
        data: { reportGeneratedAt: new Date(), reportDriveFileId: driveFileId, reportDriveUrl: driveUrl },
      });

      console.log(`Match week report ready: ${fileName}${driveUrl ? ` -> ${driveUrl}` : ""}`);
    } catch (error) {
      // Leave reportGeneratedAt null so the next tick retries; one bad week
      // shouldn't block the rest of the queue.
      void recordError(`weeklyReport.week.${week.id}`, error);
    }
  }
}
