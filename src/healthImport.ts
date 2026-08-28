/**
 * Reading weight history out of a phone's health app.
 *
 * There is no web API for this. Apple HealthKit and Android's Health Connect
 * are both native-only — a website, installed to the home screen or not,
 * cannot read either. The nearest thing a PWA can do is accept the export
 * file those apps already know how to produce, which is what this does.
 *
 * Two formats, because between them they cover both platforms:
 *
 *   Apple Health — Settings > your photo > Export All Health Data produces a
 *   zip whose export.xml has one <Record> element per measurement. Only
 *   HKQuantityTypeIdentifierBodyMass is read.
 *
 *   CSV — what Health Connect exporters, Withings, Garmin Connect and most
 *   smart scales produce. A date column and a weight column, in any order,
 *   under any of the usual names.
 *
 * Both are parsed line by line rather than into a DOM: an Apple export
 * covering several years routinely runs to hundreds of megabytes, almost all
 * of it heart-rate records this app has no use for.
 */

export interface ParsedWeighIn {
  /** Local calendar day, YYYY-MM-DD. */
  date: string;
  weightKg: number;
}

export interface HealthParseResult {
  weighIns: ParsedWeighIn[];
  /** Rows that looked like data but couldn't be read, for an honest summary. */
  skipped: number;
  format: "apple-health" | "csv";
}

const LBS_PER_KG = 2.20462;
const STONE_PER_KG = 0.157473;

// Anything outside this is a unit mix-up or a typo, not a person.
const MIN_KG = 20;
const MAX_KG = 700;

function toKg(value: number, unit: string): number | null {
  const u = unit.trim().toLowerCase();
  if (u === "kg" || u === "kgs" || u === "kilogram" || u === "kilograms" || u === "") return value;
  if (u === "lb" || u === "lbs" || u === "pound" || u === "pounds") return value / LBS_PER_KG;
  if (u === "st" || u === "stone" || u === "stones") return value / STONE_PER_KG;
  if (u === "g" || u === "gram" || u === "grams") return value / 1000;
  return null;
}

/** Apple writes "2026-01-15 08:03:12 +0000"; the day is the leading date. */
function dayFromAppleDate(raw: string): string | null {
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(raw.trim());
  return match ? match[1]! : null;
}

/**
 * Reads a date in any of the forms these exports actually use: ISO
 * (2026-01-15, optionally with a time), or day/month/year and month/day/year
 * with either separator.
 */
function dayFromCsvDate(raw: string): string | null {
  const value = raw.trim().replace(/^["']|["']$/g, "");
  if (!value) return null;

  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const slashed = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/.exec(value);
  if (slashed) {
    const first = Number(slashed[1]);
    const second = Number(slashed[2]);
    const year = slashed[3]!;
    // Ambiguous by nature. A value above 12 in the first position can only be
    // a day, which settles it; otherwise assume day-first, since this app's
    // users are in the UK.
    const [day, month] = first > 12 ? [first, second] : second > 12 ? [second, first] : [first, second];
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }
  return null;
}

/**
 * Collapses several readings on one day to the last one, matching how the
 * app already treats weigh-ins: one value per calendar day.
 */
function collapseToDays(readings: { date: string; weightKg: number; order: number }[]): ParsedWeighIn[] {
  const byDay = new Map<string, { weightKg: number; order: number }>();
  for (const reading of readings) {
    const existing = byDay.get(reading.date);
    if (!existing || reading.order >= existing.order) {
      byDay.set(reading.date, { weightKg: reading.weightKg, order: reading.order });
    }
  }
  return Array.from(byDay.entries())
    .map(([date, { weightKg }]) => ({ date, weightKg: Math.round(weightKg * 100) / 100 }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));
}

/**
 * The same extraction as parseAppleHealthExport, over a stream.
 *
 * A multi-year Apple export is routinely several hundred megabytes of XML,
 * almost all of it heart-rate samples this app has no use for. Buffering that
 * to a string would take the server down, so records are matched as chunks
 * arrive and only the handful of weight readings are kept. The tail of each
 * chunk is carried over, since a <Record> can straddle a chunk boundary.
 */
export async function parseAppleHealthStream(stream: AsyncIterable<Buffer | string>): Promise<HealthParseResult> {
  const readings: { date: string; weightKg: number; order: number }[] = [];
  let skipped = 0;
  let order = 0;
  let carry = "";

  for await (const chunk of stream) {
    const text = carry + chunk.toString();
    // Everything up to the last complete tag is safe to scan; whatever
    // follows might be half a record.
    const lastClose = text.lastIndexOf(">");
    const scannable = lastClose === -1 ? "" : text.slice(0, lastClose + 1);
    carry = lastClose === -1 ? text : text.slice(lastClose + 1);
    // A pathological input with no ">" at all must not grow the carry
    // without bound.
    if (carry.length > MAX_CARRY) carry = carry.slice(-MAX_CARRY);

    const result = extractBodyMassRecords(scannable, order);
    readings.push(...result.readings);
    skipped += result.skipped;
    order = result.order;
  }

  if (carry) {
    const result = extractBodyMassRecords(carry, order);
    readings.push(...result.readings);
    skipped += result.skipped;
  }

  return { weighIns: collapseToDays(readings), skipped, format: "apple-health" };
}

// Comfortably longer than any single <Record> element Apple writes.
const MAX_CARRY = 8192;

function extractBodyMassRecords(xml: string, startOrder: number) {
  const readings: { date: string; weightKg: number; order: number }[] = [];
  let skipped = 0;
  let order = startOrder;

  const recordPattern = /<Record\b[^>]*\/?>/g;
  let match: RegExpExecArray | null;
  while ((match = recordPattern.exec(xml)) !== null) {
    const tag = match[0];
    if (!tag.includes("HKQuantityTypeIdentifierBodyMass")) continue;

    const attr = (name: string): string | null => {
      const found = new RegExp(`${name}="([^"]*)"`).exec(tag);
      return found ? found[1]! : null;
    };

    const date = dayFromAppleDate(attr("startDate") ?? "");
    const rawValue = Number(attr("value"));
    const kg = Number.isFinite(rawValue) ? toKg(rawValue, attr("unit") ?? "kg") : null;

    order += 1;
    if (!date || kg === null || kg < MIN_KG || kg > MAX_KG) {
      skipped += 1;
      continue;
    }
    readings.push({ date, weightKg: kg, order });
  }
  return { readings, skipped, order };
}

export function parseAppleHealthExport(xml: string): HealthParseResult {
  // One Record element per measurement, self-closing, attributes in a stable
  // order — but read by name rather than position, in case that changes.
  const { readings, skipped } = extractBodyMassRecords(xml, 0);
  return { weighIns: collapseToDays(readings), skipped, format: "apple-health" };
}

const DATE_HEADERS = ["date", "day", "start", "startdate", "start date", "time", "datetime", "timestamp", "measured", "date/time"];
const WEIGHT_HEADERS = ["weight", "weightkg", "weight (kg)", "weight_kg", "kg", "mass", "body mass", "bodymass", "weight (lb)", "weight (lbs)", "lbs", "lb"];

function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i]!;
    if (char === '"') {
      // A doubled quote inside a quoted cell is a literal quote.
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if ((char === "," || char === ";" || char === "\t") && !inQuotes) {
      cells.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current);
  return cells;
}

/** The unit a weight column is in, taken from its own header. */
function unitFromHeader(header: string): string {
  const h = header.toLowerCase();
  if (h.includes("lb") || h.includes("pound")) return "lb";
  if (h.includes("stone") || /\bst\b/.test(h)) return "st";
  return "kg";
}

export function parseWeightCsv(text: string): HealthParseResult {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) return { weighIns: [], skipped: 0, format: "csv" };

  const header = splitCsvLine(lines[0]!).map((h) => h.trim().toLowerCase().replace(/^["']|["']$/g, ""));
  const dateIndex = header.findIndex((h) => DATE_HEADERS.includes(h));
  const weightIndex = header.findIndex((h) => WEIGHT_HEADERS.includes(h));
  if (dateIndex === -1 || weightIndex === -1) {
    return { weighIns: [], skipped: lines.length - 1, format: "csv" };
  }

  const unit = unitFromHeader(header[weightIndex]!);
  const readings: { date: string; weightKg: number; order: number }[] = [];
  let skipped = 0;

  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i]!);
    const date = dayFromCsvDate(cells[dateIndex] ?? "");
    const raw = Number((cells[weightIndex] ?? "").trim().replace(/["']/g, "").replace(",", "."));
    const kg = Number.isFinite(raw) ? toKg(raw, unit) : null;

    if (!date || kg === null || kg < MIN_KG || kg > MAX_KG) {
      skipped += 1;
      continue;
    }
    readings.push({ date, weightKg: kg, order: i });
  }

  return { weighIns: collapseToDays(readings), skipped, format: "csv" };
}

/** Picks the parser from the content itself, not the file name. */
export function parseHealthExport(text: string): HealthParseResult {
  return text.includes("HKQuantityTypeIdentifier") || text.includes("<HealthData")
    ? parseAppleHealthExport(text)
    : parseWeightCsv(text);
}
