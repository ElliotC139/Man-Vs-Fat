import path from "node:path";
import fs from "node:fs";
import PDFDocument from "pdfkit";
import type { Entry, MatchWeek } from "@prisma/client";
import { localDayKey, localDayLabel, localTimeLabel, weightedDaysLogged } from "../matchWeek";
import type { WeekInsights } from "../insights";

/**
 * The weekly report, in the app's own colours.
 *
 * These are lifted from public/style.css rather than approximated, because a
 * report that arrives in a slightly different green than the app it came from
 * reads as a document somebody else made. BRAND is the header band and the
 * mark; PITCH is the lighter accent used for totals and the K in the wordmark.
 *
 * The one thing not carried across is the typeface. The app is set in Barlow
 * Condensed and Inter; PDFKit can only use the fourteen standard PDF fonts
 * unless the .ttf files are committed to this repo, which is a real cost for
 * a document nobody reads for its lettering. Helvetica is the neutral choice
 * and stays until there is a reason to pay for the alternative.
 */
const BRAND = "#176b3a";
const PITCH = "#1f9d52";
const INK = "#0f1417";
const MUTED = "#6e7b74";
const HAIRLINE = "#e6ece8";
const BAND_INK = "#e7f3ec";

const MARGIN = 56;

/** The app icon, drawn into the header band. */
const MARK_PATH = path.join(process.cwd(), "public", "icons", "icon-192.png");

function formatDateRange(week: MatchWeek, timeZone: string): string {
  const fmt = new Intl.DateTimeFormat("en-GB", { timeZone, day: "numeric", month: "long", year: "numeric" });
  const endDisplay = new Date(week.endsAt.getTime() - 1000); // last instant actually inside the week
  return `${fmt.format(week.startsAt)} – ${fmt.format(endDisplay)}`;
}

function drawHeader(doc: PDFKit.PDFDocument, week: MatchWeek, timeZone: string) {
  const pageWidth = doc.page.width;
  const bandHeight = 104;

  doc.rect(0, 0, pageWidth, bandHeight).fill(BRAND);

  // The mark itself, not an approximation of it. If the file is missing — a
  // trimmed image, a build that didn't copy public/ — the report still has to
  // arrive, so the failure costs a logo and nothing else.
  let textX = MARGIN;
  try {
    if (fs.existsSync(MARK_PATH)) {
      doc.image(MARK_PATH, MARGIN, 26, { width: 34, height: 34 });
      textX = MARGIN + 46;
    }
  } catch {
    // Header without a mark. Still a report.
  }

  // "QuicKcals" the same way the app draws its wordmark: "Quic" carries the
  // weight, and the K and "cals" step back out of it — bolding the whole
  // word makes the join the loudest thing in the name. The K keeps the
  // colour, because it is still the K the app's mark is built from.
  //
  // Three runs on one line: PDFKit continues where the last text ended when
  // `continued` is set, so the spacing is the font's own.
  doc
    .font("Helvetica-Bold")
    .fontSize(23)
    .fillColor("#ffffff")
    .text("Quic", textX, 28, { continued: true })
    .font("Helvetica")
    .fillColor(PITCH)
    .text("K", { continued: true })
    .fillColor("#ffffff")
    .text("cals");

  doc
    .font("Helvetica")
    .fontSize(11)
    .fillColor(BAND_INK)
    .text("Your week", textX, 60);

  // The dates sit right-aligned against the band's other edge, so the header
  // reads as one line of masthead rather than a stack in the top-left corner.
  doc
    .font("Helvetica-Bold")
    .fontSize(12)
    .fillColor("#ffffff")
    .text(formatDateRange(week, timeZone), pageWidth / 2, 62, {
      width: pageWidth / 2 - MARGIN,
      align: "right",
    });

  doc.y = bandHeight + 30;
  doc.x = MARGIN;
  doc.fillColor(INK);
}

/**
 * The same line on the foot of every page: where it came from, and where you
 * are in it. Drawn at the end over buffered pages, because the page count is
 * not knowable until the last entry has been laid out.
 */
function drawFooters(doc: PDFKit.PDFDocument) {
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i += 1) {
    doc.switchToPage(i);

    // The footer sits below the bottom margin, and PDFKit reacts to text
    // placed past the margin by starting a new page — which then gets its own
    // footer, and so on. A four-page report came out as six with four blank.
    // Dropping the margin for the duration is the documented way to write
    // into that band on purpose.
    doc.page.margins.bottom = 0;

    const y = doc.page.height - 38;

    doc
      .moveTo(MARGIN, y - 10)
      .lineTo(doc.page.width - MARGIN, y - 10)
      .strokeColor(HAIRLINE)
      .lineWidth(1)
      .stroke();

    doc
      .font("Helvetica")
      .fontSize(8.5)
      .fillColor(MUTED)
      .text("quickcals.com", MARGIN, y, { width: 200, lineBreak: false });

    doc
      .font("Helvetica")
      .fontSize(8.5)
      .fillColor(MUTED)
      .text(`Page ${i - range.start + 1} of ${range.count}`, doc.page.width - MARGIN - 200, y, {
        width: 200,
        align: "right",
        lineBreak: false,
      });
  }
}

function ensureSpace(doc: PDFKit.PDFDocument, needed: number) {
  const bottom = doc.page.height - doc.page.margins.bottom;
  if (doc.y + needed > bottom) {
    doc.addPage();
    doc.y = MARGIN;
    doc.x = MARGIN;
  }
}

interface Macros {
  protein: number;
  carbs: number;
  fat: number;
}

/** Whether there is enough here to be worth a line. */
function hasMacros(m: Macros): boolean {
  return m.protein + m.carbs + m.fat >= 1;
}

function macroText(m: Macros): string {
  return `P ${Math.round(m.protein)}g   ·   C ${Math.round(m.carbs)}g   ·   F ${Math.round(m.fat)}g`;
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

const INSIGHT_SECTIONS: { key: keyof WeekInsights; title: string }[] = [
  { key: "wentWell", title: "What went well" },
  { key: "couldImprove", title: "What could improve" },
  { key: "noticed", title: "Worth noticing" },
  { key: "easyWins", title: "Easy wins for next time" },
];

function drawInsights(doc: PDFKit.PDFDocument, insights: WeekInsights) {
  doc.addPage();
  doc.y = MARGIN;
  doc.x = MARGIN;

  doc.font("Helvetica-Bold").fontSize(18).fillColor(PITCH).text("Weekly Summary", MARGIN);
  doc.moveDown(0.7);

  for (const section of INSIGHT_SECTIONS) {
    const items = insights[section.key];
    if (items.length === 0) continue;

    ensureSpace(doc, 36);
    doc.font("Helvetica-Bold").fontSize(12).fillColor(INK).text(section.title, MARGIN);
    doc.moveDown(0.35);

    for (const item of items) {
      ensureSpace(doc, 36);
      const rowY = doc.y;
      doc.font("Helvetica").fontSize(10.5).fillColor(PITCH).text("•", MARGIN, rowY, { width: 14 });
      doc
        .font("Helvetica")
        .fontSize(10.5)
        .fillColor(INK)
        .text(item, MARGIN + 14, rowY, { width: doc.page.width - MARGIN * 2 - 14 });
      doc.moveDown(0.4);
    }

    doc.moveDown(0.5);
  }
}

export async function generateMatchWeekReport(
  week: MatchWeek & { entries: Entry[] },
  timeZone: string,
  insights: WeekInsights | null = null,
): Promise<Buffer> {
  // bufferPages so the footer can say "page 2 of 5" — a count that isn't
  // known until the last entry has been laid out.
  const doc = new PDFDocument({
    size: "A4",
    bufferPages: true,
    margins: { top: 0, bottom: 64, left: MARGIN, right: MARGIN },
  });
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
  const weekMacros = { protein: 0, carbs: 0, fat: 0 };

  for (const day of days) {
    ensureSpace(doc, 50);

    doc.font("Helvetica-Bold").fontSize(13).fillColor(INK).text(day.label, MARGIN);
    doc.moveTo(MARGIN, doc.y + 2).lineTo(doc.page.width - MARGIN, doc.y + 2).strokeColor(HAIRLINE).lineWidth(1).stroke();
    doc.moveDown(0.6);

    let daySubtotal = 0;
    const dayMacros = { protein: 0, carbs: 0, fat: 0 };
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

      // Macros are optional per row — an older entry, or one logged before a
      // database had figures for it — so they accumulate independently of
      // kcal rather than being skipped alongside it.
      dayMacros.protein += entry.proteinG ?? 0;
      dayMacros.carbs += entry.carbsG ?? 0;
      dayMacros.fat += entry.fatG ?? 0;
      weekMacros.protein += entry.proteinG ?? 0;
      weekMacros.carbs += entry.carbsG ?? 0;
      weekMacros.fat += entry.fatG ?? 0;
    }

    ensureSpace(doc, 20);
    doc.moveDown(0.2);
    const subtotalY = doc.y;
    if (hasMacros(dayMacros)) {
      doc
        .font("Helvetica")
        .fontSize(9.5)
        .fillColor(MUTED)
        .text(macroText(dayMacros), MARGIN, subtotalY, { width: 300, lineBreak: false });
    }
    doc
      .font("Helvetica-Bold")
      .fontSize(10.5)
      .fillColor(PITCH)
      .text(`Day subtotal: ${daySubtotal} kcal`, MARGIN, subtotalY, {
        width: doc.page.width - MARGIN * 2,
        align: "right",
      });
    doc.moveDown(1.1);
  }

  const daysLogged = weightedDaysLogged(days.map((d) => d.dayKey), week.startsAt, timeZone);
  const dailyAverage = daysLogged > 0 ? Math.round(weekTotal / daysLogged) : 0;

  ensureSpace(doc, 110);
  doc.moveDown(0.4);
  doc.moveTo(MARGIN, doc.y).lineTo(doc.page.width - MARGIN, doc.y).strokeColor(PITCH).lineWidth(2).stroke();
  doc.moveDown(0.8);

  doc.font("Helvetica-Bold").fontSize(16).fillColor(INK).text(`Week total: ${weekTotal} kcal`, MARGIN);
  doc.moveDown(0.3);
  doc
    .font("Helvetica")
    .fontSize(12)
    .fillColor(MUTED)
    .text(`Daily average: ${dailyAverage} kcal (over ${daysLogged} day${daysLogged === 1 ? "" : "s"} logged)`, MARGIN);

  if (hasMacros(weekMacros)) {
    doc.moveDown(0.3);
    doc
      .font("Helvetica")
      .fontSize(11)
      .fillColor(MUTED)
      .text(`Macros for the week: ${macroText(weekMacros)}`, MARGIN);
  }

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

  if (insights) {
    drawInsights(doc, insights);
  }

  drawFooters(doc);
  doc.end();
  return finished;
}
