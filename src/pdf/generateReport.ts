import PDFDocument from "pdfkit";
import type { Entry, MatchWeek } from "@prisma/client";
import { localDayKey, localDayLabel, localTimeLabel } from "../matchWeek";

const PITCH_GREEN = "#1f7a3f";
const INK = "#1a1a1a";
const MUTED = "#6b7280";
const HAIRLINE = "#d8e3dc";

const MARGIN = 56;

function formatDateRange(week: MatchWeek, timeZone: string): string {
  const fmt = new Intl.DateTimeFormat("en-GB", { timeZone, day: "numeric", month: "long", year: "numeric" });
  const endDisplay = new Date(week.endsAt.getTime() - 1000); // last instant actually inside the week
  return `${fmt.format(week.startsAt)} – ${fmt.format(endDisplay)}`;
}

function drawHeader(doc: PDFKit.PDFDocument, week: MatchWeek, timeZone: string) {
  const pageWidth = doc.page.width;
  const bandHeight = 100;

  doc.rect(0, 0, pageWidth, bandHeight).fill(PITCH_GREEN);

  // A small halfway-line + centre-circle pitch motif, subtle and not in the way of legibility.
  const lineX = pageWidth - 150;
  doc
    .save()
    .strokeColor("#ffffff")
    .opacity(0.35)
    .lineWidth(1.5)
    .moveTo(lineX, 18)
    .lineTo(lineX, bandHeight - 18)
    .stroke()
    .circle(lineX, bandHeight / 2, 16)
    .stroke()
    .opacity(1)
    .restore();

  doc
    .fillColor("#ffffff")
    .font("Helvetica-Bold")
    .fontSize(22)
    .text("Match Week Food Diary", MARGIN, 30);

  doc
    .font("Helvetica")
    .fontSize(12)
    .fillColor("#e7f3ec")
    .text(formatDateRange(week, timeZone), MARGIN, 60);

  doc.y = bandHeight + 30;
  doc.x = MARGIN;
  doc.fillColor(INK);
}

function ensureSpace(doc: PDFKit.PDFDocument, needed: number) {
  const bottom = doc.page.height - doc.page.margins.bottom;
  if (doc.y + needed > bottom) {
    doc.addPage();
    doc.y = MARGIN;
    doc.x = MARGIN;
  }
}

function kcalText(kcal: number | null): string {
  return kcal === null ? "—" : `${kcal} kcal`;
}

interface DayGroup {
  dayKey: string;
  label: string;
  entries: Entry[];
}

function groupByLocalDay(entries: Entry[], timeZone: string): DayGroup[] {
  const groups = new Map<string, DayGroup>();
  for (const entry of entries) {
    const dayKey = localDayKey(entry.timestamp, timeZone);
    let group = groups.get(dayKey);
    if (!group) {
      group = { dayKey, label: localDayLabel(entry.timestamp, timeZone), entries: [] };
      groups.set(dayKey, group);
    }
    group.entries.push(entry);
  }
  return [...groups.values()].sort((a, b) => a.dayKey.localeCompare(b.dayKey));
}

export async function generateMatchWeekReport(
  week: MatchWeek & { entries: Entry[] },
  timeZone: string,
): Promise<Buffer> {
  const doc = new PDFDocument({ size: "A4", margins: { top: 0, bottom: 56, left: MARGIN, right: MARGIN } });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const finished = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));

  drawHeader(doc, week, timeZone);

  const sortedEntries = [...week.entries].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  const days = groupByLocalDay(sortedEntries, timeZone);

  if (days.length === 0) {
    doc.font("Helvetica-Oblique").fontSize(12).fillColor(MUTED).text("Nothing logged this week.");
  }

  let weekTotal = 0;
  let unestimatedCount = 0;

  for (const day of days) {
    ensureSpace(doc, 50);

    doc.font("Helvetica-Bold").fontSize(13).fillColor(INK).text(day.label, MARGIN);
    doc.moveTo(MARGIN, doc.y + 2).lineTo(doc.page.width - MARGIN, doc.y + 2).strokeColor(HAIRLINE).lineWidth(1).stroke();
    doc.moveDown(0.6);

    let daySubtotal = 0;
    for (const entry of day.entries) {
      ensureSpace(doc, 22);
      const time = localTimeLabel(entry.timestamp, timeZone);
      const rowY = doc.y;

      doc.font("Helvetica").fontSize(10.5).fillColor(MUTED).text(time, MARGIN, rowY, { width: 50 });
      doc.font("Helvetica").fontSize(11).fillColor(INK).text(entry.label, MARGIN + 55, rowY, {
        width: doc.page.width - MARGIN * 2 - 55 - 80,
      });
      doc
        .font("Helvetica-Bold")
        .fontSize(11)
        .fillColor(INK)
        .text(kcalText(entry.kcal), doc.page.width - MARGIN - 80, rowY, { width: 80, align: "right" });

      doc.y = Math.max(doc.y, rowY + 16);

      if (entry.kcal !== null) {
        daySubtotal += entry.kcal;
        weekTotal += entry.kcal;
      } else {
        unestimatedCount += 1;
      }
    }

    ensureSpace(doc, 20);
    doc.moveDown(0.2);
    doc
      .font("Helvetica-Bold")
      .fontSize(10.5)
      .fillColor(PITCH_GREEN)
      .text(`Day subtotal: ${daySubtotal} kcal`, MARGIN, doc.y, {
        width: doc.page.width - MARGIN * 2,
        align: "right",
      });
    doc.moveDown(1.1);
  }

  const daysLogged = days.length;
  const dailyAverage = daysLogged > 0 ? Math.round(weekTotal / daysLogged) : 0;

  ensureSpace(doc, 110);
  doc.moveDown(0.4);
  doc.moveTo(MARGIN, doc.y).lineTo(doc.page.width - MARGIN, doc.y).strokeColor(PITCH_GREEN).lineWidth(2).stroke();
  doc.moveDown(0.8);

  doc.font("Helvetica-Bold").fontSize(16).fillColor(INK).text(`Week total: ${weekTotal} kcal`, MARGIN);
  doc.moveDown(0.3);
  doc
    .font("Helvetica")
    .fontSize(12)
    .fillColor(MUTED)
    .text(`Daily average: ${dailyAverage} kcal (over ${daysLogged} day${daysLogged === 1 ? "" : "s"} logged)`, MARGIN);

  if (unestimatedCount > 0) {
    doc.moveDown(0.4);
    doc
      .font("Helvetica-Oblique")
      .fontSize(9.5)
      .fillColor(MUTED)
      .text(
        `${unestimatedCount} entr${unestimatedCount === 1 ? "y" : "ies"} couldn't be estimated and ${
          unestimatedCount === 1 ? "isn't" : "aren't"
        } included in the totals above.`,
        MARGIN,
      );
  }

  doc.end();
  return finished;
}
