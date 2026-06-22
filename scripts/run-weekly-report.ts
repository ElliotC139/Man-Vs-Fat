import "dotenv/config";
import fs from "node:fs";
import { prisma } from "../src/db";
import { config, driveConfigured } from "../src/config";
import { getMatchWeekBoundaries, localDayKey } from "../src/matchWeek";
import { generateMatchWeekReport } from "../src/pdf/generateReport";
import { uploadReportToDrive } from "../src/drive/uploadToDrive";
import { closeMatchWeeksNeedingReport } from "../src/jobs/weeklyReport";

/**
 * Manual escape hatch so the report pipeline can be exercised without
 * waiting for Monday 17:00. `--current` previews the still-open week to a
 * local file (and uploads it) without marking it as closed.
 */
async function main() {
  const forceCurrent = process.argv.includes("--current");

  if (!forceCurrent) {
    await closeMatchWeeksNeedingReport();
    return;
  }

  const { start, end } = getMatchWeekBoundaries(new Date(), config.TIMEZONE);
  const week = await prisma.matchWeek.findUnique({
    where: { startsAt_endsAt: { startsAt: start, endsAt: end } },
    include: { entries: true },
  });

  if (!week) {
    console.log("No entries logged yet this match week — nothing to preview.");
    return;
  }

  const pdfBuffer = await generateMatchWeekReport(week, config.TIMEZONE);
  const fileName = `${localDayKey(week.startsAt, config.TIMEZONE)}-preview.pdf`;
  fs.writeFileSync(fileName, pdfBuffer);
  console.log(`Wrote preview PDF to ./${fileName}`);

  if (driveConfigured) {
    const uploaded = await uploadReportToDrive(fileName, pdfBuffer);
    console.log(`Also uploaded to Drive: ${uploaded.webViewLink}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
