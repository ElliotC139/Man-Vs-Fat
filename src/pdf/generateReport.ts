import path from "node:path";
import fs from "node:fs";
import PDFDocument from "pdfkit";
import type { Entry, MatchWeek } from "@prisma/client";
import { localDayKey, localDayLabel, localTimeLabel } from "../matchWeek";
import type { WeekInsights } from "../insights";
import { buildWeekSummary, type ReportContext, type WeekSummary } from "./weekSummary";

/**
 * The weekly report, in the app's own colours.
 *
 * These are lifted from public/style.css rather than approximated, because a
 * report that arrives in a slightly different green than the app it came from
 * reads as a document somebody else made. BRAND is the header band and the
 * mark; PITCH is the lighter accent used for totals and the K in the wordmark.
 *
 * The one thing not carried across is the typeface. The app is set in
 * Bricolage Grotesque and Plus Jakarta Sans; PDFKit can only use the fourteen
 * standard PDF fonts unless the .ttf files are committed to this repo, which
 * is a real cost for a document nobody reads for its lettering. Helvetica is the neutral choice
 * and stays until there is a reason to pay for the alternative.
 */
const BRAND = "#176b3a";
const PITCH = "#1f9d52";
const INK = "#0f1417";
const MUTED = "#6e7b74";
const HAIRLINE = "#e6ece8";
const BAND_INK = "#e7f3ec";
// The summary's own few: a tile ground, the over-target amber, a still-open
// day's paler green, and the carbs and fat colours from the app's macro bars.
const SURFACE = "#f2f5f3";
const AMBER = "#d98a1c";
const OPEN = "#a8dcbc";
const GRID = "#e9eeeb";
const AXIS = "#c5d0ca";
const CARBS = "#b07a1e";
const FAT = "#7b8781";

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
  return kcal === null ? "—" : `${kcal.toLocaleString("en-GB")} kcal`;
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

/** 9,840 — the way the app writes a figure. */
function num(value: number): string {
  return Math.round(value).toLocaleString("en-GB");
}

/** +320 / –1,240. An en dash, because the standard PDF fonts have no minus sign. */
function signed(value: number, digits = 0): string {
  const text = Math.abs(value).toLocaleString("en-GB", { minimumFractionDigits: digits, maximumFractionDigits: digits });
  if (value > 0) return `+${text}`;
  if (value < 0) return `\u2013${text}`;
  return text;
}

/** 5½ — a boundary Monday counts as half a day, here as in the app. */
function dayCount(days: number): string {
  const whole = Math.floor(days);
  const half = days - whole >= 0.5;
  const text = half ? `${whole === 0 ? "" : whole}\u00bd` : `${whole}`;
  return `${text} day${days === 1 ? "" : "s"}`;
}

interface Tile {
  label: string;
  value: string;
  sub: string;
  colour?: string;
}

function summaryTiles(s: WeekSummary): Tile[] {
  const tiles: Tile[] = [
    { label: "EATEN", value: num(s.totalKcal), sub: `kcal \u00b7 ${dayCount(s.daysLogged)}` },
    { label: "DAILY AVERAGE", value: num(s.dailyAverage), sub: "kcal a day" },
  ];
  if (s.balance !== null) {
    const label = s.usesMeasured ? "VS BURN" : s.reference?.kind === "target" ? "VS TARGET" : "VS ESTIMATE";
    tiles.push({
      label,
      value: signed(s.balance),
      sub: s.under + s.over > 0 ? `${s.under} under \u00b7 ${s.over} over` : "so far",
      colour: s.balance <= 0 ? BRAND : AMBER,
    });
  }
  if (s.exercise.count > 0) {
    tiles.push({
      label: "EXERCISE",
      value: num(s.exercise.kcal),
      sub: `kcal \u00b7 ${s.exercise.count} session${s.exercise.count === 1 ? "" : "s"}`,
    });
  }
  if (s.weightChangeKg !== null) {
    tiles.push({ label: "WEIGHT", value: `${signed(s.weightChangeKg, 1)} kg`, sub: `over ${s.weighInCount} weigh-ins` });
  }
  return tiles;
}

/** One sentence saying what the days were measured against, because "over" means nothing without it. */
function referenceLine(s: WeekSummary): string {
  const ref = s.reference;
  if (s.usesMeasured) {
    return ref
      ? `Each day is measured against what your tracker says you burned, or your ${num(ref.kcal)} kcal ${
          ref.kind === "target" ? "target" : "estimate"
        } where it has no figure.`
      : "Each day is measured against what your tracker says you burned.";
  }
  if (ref?.kind === "target") return `Each day is measured against your ${num(ref.kcal)} kcal daily target.`;
  if (ref?.kind === "estimate") {
    return `Each day is measured against an estimated ${num(ref.kcal)} kcal burn, from your height, weight, age and activity.`;
  }
  return "Set a daily calorie target in Settings and each day here is measured against it.";
}

const TILE_H = 64;

function drawTiles(doc: PDFKit.PDFDocument, tiles: Tile[], x: number, y: number, width: number) {
  const gap = 10;
  const w = (width - gap * (tiles.length - 1)) / tiles.length;
  const valueSize = tiles.length >= 5 ? 15 : 17;
  tiles.forEach((tile, i) => {
    const tx = x + i * (w + gap);
    doc.roundedRect(tx, y, w, TILE_H, 9).fill(SURFACE);
    doc
      .font("Helvetica-Bold")
      .fontSize(7)
      .fillColor(MUTED)
      .text(tile.label, tx + 11, y + 11, { width: w - 22, lineBreak: false, characterSpacing: 0.5 });
    doc
      .font("Helvetica-Bold")
      .fontSize(valueSize)
      .fillColor(tile.colour ?? INK)
      .text(tile.value, tx + 11, y + 24, { width: w - 22, lineBreak: false });
    doc
      .font("Helvetica")
      .fontSize(7.5)
      .fillColor(MUTED)
      // One line, always: a height of one line is what makes PDFKit cut it
      // short with an ellipsis rather than wrap it out of the tile.
      .text(tile.sub, tx + 11, y + 46, { width: w - 22, height: 9, ellipsis: true });
  });
}

/** A step that gives four or five gridlines whatever the week's scale. */
function gridStep(max: number): number {
  for (const step of [250, 500, 1000, 1500, 2000, 2500, 5000]) {
    if (max / step <= 5) return step;
  }
  return 10000;
}

const CHART_PLOT_H = 136;
const CHART_H = 22 + CHART_PLOT_H + 30;

/**
 * The week as bars, one a day, against the line each day was measured by.
 *
 * Green for a day under, amber for a day over, a paler green for today while
 * it is still going. With a fixed target the line is one dashed rule across
 * the chart; with a tracker each day has its own burn, so each gets its own
 * short rule over its bar.
 */
function drawChart(doc: PDFKit.PDFDocument, s: WeekSummary, x: number, y: number, width: number) {
  const lineName = s.usesMeasured ? "Burned" : s.reference?.kind === "target" ? "Target" : "Estimated burn";
  const hasLine = s.days.some((day) => day.against !== null && day.verdict !== "future");

  doc.font("Helvetica-Bold").fontSize(11).fillColor(INK).text("Calories, day by day", x, y, { lineBreak: false });

  // Legend, right-aligned on the title's line. Nothing measured means no
  // under or over to explain.
  const legend: { label: string; draw: (lx: number, ly: number) => void }[] = hasLine
    ? [
        { label: "Under", draw: (lx, ly) => doc.roundedRect(lx, ly, 8, 8, 2).fill(PITCH) },
        { label: "Over", draw: (lx, ly) => doc.roundedRect(lx, ly, 8, 8, 2).fill(AMBER) },
      ]
    : [];
  if (hasLine) {
    legend.push({
      label: lineName,
      draw: (lx, ly) => doc.moveTo(lx, ly + 4).lineTo(lx + 10, ly + 4).lineWidth(1.6).strokeColor(INK).stroke(),
    });
  }
  doc.font("Helvetica").fontSize(8);
  let lx = x + width;
  for (const item of [...legend].reverse()) {
    const textW = doc.widthOfString(item.label);
    lx -= textW;
    doc.fillColor(MUTED).text(item.label, lx, y + 2, { lineBreak: false });
    lx -= 13;
    item.draw(lx, y + 2.5);
    lx -= 14;
  }

  const gutter = 34;
  const plotX = x + gutter;
  const plotW = width - gutter;
  const plotTop = y + 24;
  const plotBottom = plotTop + CHART_PLOT_H;

  const peak = Math.max(
    0,
    ...s.days.map((day) => day.kcal),
    ...s.days.filter((day) => day.verdict !== "future").map((day) => day.against ?? 0),
  );
  const step = gridStep(peak > 0 ? peak * 1.08 : 2000);
  const top = Math.max(step, Math.ceil((peak > 0 ? peak * 1.08 : 2000) / step) * step);
  const yFor = (value: number) => plotBottom - (value / top) * CHART_PLOT_H;

  // Gridlines and their figures.
  for (let value = 0; value <= top; value += step) {
    const gy = yFor(value);
    doc
      .moveTo(plotX, gy)
      .lineTo(x + width, gy)
      .lineWidth(value === 0 ? 1 : 0.6)
      .strokeColor(value === 0 ? AXIS : GRID)
      .stroke();
    doc
      .font("Helvetica")
      .fontSize(7)
      .fillColor(MUTED)
      .text(num(value), x, gy - 3.5, { width: gutter - 8, align: "right", lineBreak: false });
  }

  // A fixed target is one line across the whole week, drawn before the bars
  // so a bar that reaches it sits over it rather than under a dashed rule.
  if (!s.usesMeasured && hasLine && s.reference) {
    const ry = yFor(s.reference.kcal);
    doc.save();
    doc
      .moveTo(plotX, ry)
      .lineTo(x + width, ry)
      .dash(3, { space: 3 })
      .lineWidth(1.2)
      .strokeColor(INK)
      .stroke();
    doc.restore();
    doc
      .font("Helvetica-Bold")
      .fontSize(7)
      .fillColor(INK)
      .text(`${lineName} ${num(s.reference.kcal)}`, x + width - 120, ry - 10, {
        width: 120,
        align: "right",
        lineBreak: false,
      });
  }

  const slot = plotW / Math.max(s.days.length, 1);
  const barW = Math.min(30, slot * 0.56);

  s.days.forEach((day, i) => {
    const cx = plotX + i * slot + slot / 2;
    const bx = cx - barW / 2;
    const future = day.verdict === "future";

    if (day.kcal > 0) {
      // Paler only for today while it is still going; a day with nothing to
      // measure it against is just a bar.
      const colour = day.verdict === "over" ? AMBER : day.verdict === "open" ? OPEN : PITCH;
      const h = Math.max(2, (day.kcal / top) * CHART_PLOT_H);
      const by = plotBottom - h;
      // Rounded at the top only, as one shape: two overlapping fills leave a
      // hairline seam where they meet in some viewers.
      const r = Math.min(4, h / 2, barW / 2);
      doc
        .moveTo(bx, plotBottom)
        .lineTo(bx, by + r)
        .quadraticCurveTo(bx, by, bx + r, by)
        .lineTo(bx + barW - r, by)
        .quadraticCurveTo(bx + barW, by, bx + barW, by + r)
        .lineTo(bx + barW, plotBottom)
        .closePath()
        .fill(colour);

      // The figure sits on a white chip, so a line running through it at
      // that height can't make it unreadable.
      const figure = num(day.kcal);
      doc.font("Helvetica-Bold").fontSize(7);
      const figureW = doc.widthOfString(figure);
      doc.rect(cx - figureW / 2 - 2, by - 11, figureW + 4, 9).fill("#ffffff");
      doc.fillColor(INK).text(figure, cx - slot / 2, by - 10, { width: slot, align: "center", lineBreak: false });
    } else if (!future) {
      // A day with nothing logged still has a place on the axis.
      doc.rect(bx, plotBottom - 2, barW, 2).fill(HAIRLINE);
    }

    // Each day's own line when a tracker gives each day its own burn.
    if (s.usesMeasured && day.against !== null && !future) {
      const ay = yFor(day.against);
      doc
        .moveTo(bx - 4, ay)
        .lineTo(bx + barW + 4, ay)
        .lineWidth(1.6)
        .strokeColor(INK)
        .stroke();
    }

    doc
      .font("Helvetica-Bold")
      .fontSize(8)
      .fillColor(future ? AXIS : INK)
      .text(day.weekday, cx - slot / 2, plotBottom + 7, { width: slot, align: "center", lineBreak: false });
    doc
      .font("Helvetica")
      .fontSize(7.5)
      .fillColor(future ? AXIS : MUTED)
      .text(String(day.dayOfMonth), cx - slot / 2, plotBottom + 18, { width: slot, align: "center", lineBreak: false });
  });
}

const MACRO_H = 52;

/** Where the week's calories came from, as one bar split three ways by energy. */
function drawMacroSplit(doc: PDFKit.PDFDocument, s: WeekSummary, x: number, y: number, width: number) {
  const parts = [
    { label: "Protein", grams: s.macros.protein, kcal: s.macros.protein * 4, colour: PITCH },
    { label: "Carbs", grams: s.macros.carbs, kcal: s.macros.carbs * 4, colour: CARBS },
    { label: "Fat", grams: s.macros.fat, kcal: s.macros.fat * 9, colour: FAT },
  ];
  const total = parts.reduce((sum, part) => sum + part.kcal, 0);
  if (total <= 0) return;

  doc.font("Helvetica-Bold").fontSize(11).fillColor(INK).text("Where the calories came from", x, y, { lineBreak: false });

  const barY = y + 19;
  doc.save();
  doc.roundedRect(x, barY, width, 10, 5).clip();
  let bx = x;
  for (const part of parts) {
    const w = (part.kcal / total) * width;
    doc.rect(bx, barY, w, 10).fill(part.colour);
    bx += w;
  }
  doc.restore();

  const colW = width / parts.length;
  parts.forEach((part, i) => {
    const cx = x + i * colW;
    const share = Math.round((part.kcal / total) * 100);
    doc.circle(cx + 4, barY + 24, 3.5).fill(part.colour);
    doc
      .font("Helvetica-Bold")
      .fontSize(8.5)
      .fillColor(INK)
      .text(`${part.label} ${share}%`, cx + 12, barY + 20, { continued: true, lineBreak: false })
      .font("Helvetica")
      .fillColor(MUTED)
      .text(`  ${num(part.grams)} g`, { lineBreak: false });
  });
}

/** The top of page one: the week in a few figures, then the chart, then the macros. */
function drawWeekSummary(doc: PDFKit.PDFDocument, s: WeekSummary) {
  const x = MARGIN;
  const width = doc.page.width - MARGIN * 2;
  let y = doc.y;

  doc.font("Helvetica-Bold").fontSize(16).fillColor(INK).text("The week at a glance", x, y, { lineBreak: false });
  y += 22;
  doc.font("Helvetica").fontSize(9).fillColor(MUTED).text(referenceLine(s), x, y, { width });
  y = doc.y + 12;

  drawTiles(doc, summaryTiles(s), x, y, width);
  y += TILE_H + 24;

  drawChart(doc, s, x, y, width);
  y += CHART_H + 14;

  if (s.macros.protein + s.macros.carbs + s.macros.fat >= 1) {
    drawMacroSplit(doc, s, x, y, width);
    y += MACRO_H;
  }

  if (s.unestimated > 0) {
    doc
      .font("Helvetica-Oblique")
      .fontSize(8.5)
      .fillColor(MUTED)
      .text(
        `${s.unestimated} entr${s.unestimated === 1 ? "y" : "ies"} couldn't be estimated and ${
          s.unestimated === 1 ? "isn't" : "aren't"
        } included in the figures above.`,
        x,
        y,
        { width },
      );
    y = doc.y + 6;
  }

  doc.moveTo(x, y + 6).lineTo(x + width, y + 6).strokeColor(HAIRLINE).lineWidth(1).stroke();
  doc.x = x;
  doc.y = y + 24;
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

/** What a report knows when nothing else has been loaded: no target, no tracker, no weigh-ins. */
const EMPTY_CONTEXT: ReportContext = { reference: null, measuredBurn: {}, exercise: { count: 0, kcal: 0 }, weighIns: [] };

export async function generateMatchWeekReport(
  week: MatchWeek & { entries: Entry[] },
  timeZone: string,
  insights: WeekInsights | null = null,
  context: ReportContext = EMPTY_CONTEXT,
  now: Date = new Date(),
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
  } else {
    drawWeekSummary(doc, buildWeekSummary(week, sortedEntries, context, timeZone, now));
    doc.font("Helvetica-Bold").fontSize(16).fillColor(INK).text("Day by day", MARGIN);
    doc.moveDown(0.6);
  }

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

      if (entry.kcal !== null) daySubtotal += entry.kcal;

      // Macros are optional per row — an older entry, or one logged before a
      // database had figures for it — so they accumulate independently of
      // kcal rather than being skipped alongside it.
      dayMacros.protein += entry.proteinG ?? 0;
      dayMacros.carbs += entry.carbsG ?? 0;
      dayMacros.fat += entry.fatG ?? 0;
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
      .text(`Day subtotal: ${daySubtotal.toLocaleString("en-GB")} kcal`, MARGIN, subtotalY, {
        width: doc.page.width - MARGIN * 2,
        align: "right",
      });
    doc.moveDown(1.1);
  }

  if (insights) {
    drawInsights(doc, insights);
  }

  drawFooters(doc);
  doc.end();
  return finished;
}
