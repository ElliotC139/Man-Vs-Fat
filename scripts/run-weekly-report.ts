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
 * waiting for a user's own week boundary. `--current` previews each user's
 * still-open week to a local file (and uploads it) without marking it as
 * closed.
 */
async function main() {
  const forceCurrent = process.argv.includes("--current");

  if (!forceCurrent) {
    await closeMatchWeeksNeedingReport();
    return;
  }

  const users = await prisma.user.findMany();
  if (users.length === 0) {
    console.log("No users yet — nothing to preview.");
    return;
  }

  for (const user of users) {
    const weekStart = { weekday: user.weekStartWeekday, hour: user.weekStartHour, minute: user.weekStartMinute };
    const { start, end } = getMatchWeekBoundaries(new Date(), config.TIMEZONE, weekStart);
    const week = await prisma.matchWeek.findUnique({
      where: { userId_startsAt_endsAt: { userId: user.id, startsAt: start, endsAt: end } },
      include: { entries: true },
    });

    if (!week) {
      console.log(`${user.username}: no entries logged yet this match week — nothing to preview.`);
      continue;
    }

    const pdfBuffer = await generateMatchWeekReport(week, config.TIMEZONE);
    const fileName = `${user.username}-${localDayKey(week.startsAt, config.TIMEZONE)}-preview.pdf`;
    fs.writeFileSync(fileName, pdfBuffer);
    console.log(`${user.username}: wrote preview PDF to ./${fileName}`);

    if (driveConfigured) {
      const uploaded = await uploadReportToDrive(fileName, pdfBuffer);
      console.log(`${user.username}: also uploaded to Drive: ${uploaded.webViewLink}`);
    }
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
