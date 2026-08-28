import zlib from "node:zlib";
import { Readable } from "node:stream";
import { describe, expect, it } from "vitest";
import {
  parseAppleHealthExport,
  parseAppleHealthStream,
  parseHealthExport,
  parseWeightCsv,
} from "../src/healthImport";
import { listZipEntries, openZipEntry } from "../src/lib/zipEntry";

function appleRecord(date: string, value: number, unit = "kg", type = "HKQuantityTypeIdentifierBodyMass") {
  return `<Record type="${type}" sourceName="Health" unit="${unit}" startDate="${date} 08:00:00 +0000" endDate="${date} 08:00:00 +0000" value="${value}"/>`;
}

describe("parseAppleHealthExport", () => {
  it("reads body-mass records and ignores everything else", () => {
    const xml = `<HealthData>
      ${appleRecord("2026-01-01", 95.5)}
      ${appleRecord("2026-01-03", 120, "count", "HKQuantityTypeIdentifierHeartRate")}
      ${appleRecord("2026-01-05", 94.8)}
    </HealthData>`;
    const result = parseAppleHealthExport(xml);
    expect(result.weighIns).toEqual([
      { date: "2026-01-01", weightKg: 95.5 },
      { date: "2026-01-05", weightKg: 94.8 },
    ]);
  });

  it("converts pounds to kg", () => {
    const result = parseAppleHealthExport(appleRecord("2026-01-01", 210, "lb"));
    expect(result.weighIns[0]!.weightKg).toBeCloseTo(95.25, 1);
  });

  it("keeps the last reading of a day, not the first", () => {
    // Several weigh-ins in a morning is normal; the app stores one per day.
    const xml = appleRecord("2026-01-01", 95.5) + appleRecord("2026-01-01", 95.1);
    expect(parseAppleHealthExport(xml).weighIns).toEqual([{ date: "2026-01-01", weightKg: 95.1 }]);
  });

  it("refuses a physiologically impossible reading rather than storing it", () => {
    const result = parseAppleHealthExport(appleRecord("2026-01-01", 4.2));
    expect(result.weighIns).toHaveLength(0);
    expect(result.skipped).toBe(1);
  });

  it("returns the same answer streamed as it does in one piece", async () => {
    const xml = `<HealthData>${appleRecord("2026-01-01", 95.5)}${appleRecord("2026-01-05", 94.8)}${appleRecord("2026-02-01", 93.2)}</HealthData>`;
    const whole = parseAppleHealthExport(xml);

    // Split mid-record, which is what a real chunk boundary does.
    const chunks: Buffer[] = [];
    for (let i = 0; i < xml.length; i += 37) chunks.push(Buffer.from(xml.slice(i, i + 37)));
    const streamed = await parseAppleHealthStream(Readable.from(chunks));

    expect(streamed.weighIns).toEqual(whole.weighIns);
    expect(streamed.weighIns).toHaveLength(3);
  });
});

describe("parseWeightCsv", () => {
  it("reads a plain date/weight CSV", () => {
    const csv = "Date,Weight (kg)\n2026-01-01,95.5\n2026-01-05,94.8\n";
    expect(parseWeightCsv(csv).weighIns).toEqual([
      { date: "2026-01-01", weightKg: 95.5 },
      { date: "2026-01-05", weightKg: 94.8 },
    ]);
  });

  it("takes the unit from the column header", () => {
    const csv = "Date,Weight (lbs)\n2026-01-01,210\n";
    expect(parseWeightCsv(csv).weighIns[0]!.weightKg).toBeCloseTo(95.25, 1);
  });

  it("finds the columns wherever they are, under whatever name", () => {
    const csv = "Source;Mass;Comment;Timestamp\nScale;95.5;morning;2026-01-01 07:12\n";
    expect(parseWeightCsv(csv).weighIns).toEqual([{ date: "2026-01-01", weightKg: 95.5 }]);
  });

  it("reads day-first dates, and uses an impossible month to settle the ambiguity", () => {
    // 15/01 can only be day-first; 03/01 is assumed day-first to match the UK.
    const csv = "date,weight\n15/01/2026,95.5\n03/02/2026,94.8\n";
    expect(parseWeightCsv(csv).weighIns).toEqual([
      { date: "2026-01-15", weightKg: 95.5 },
      { date: "2026-02-03", weightKg: 94.8 },
    ]);
  });

  it("handles quoted cells containing the delimiter", () => {
    const csv = 'date,note,weight\n2026-01-01,"after a big, heavy meal",95.5\n';
    expect(parseWeightCsv(csv).weighIns).toEqual([{ date: "2026-01-01", weightKg: 95.5 }]);
  });

  it("says nothing was found rather than guessing at unlabelled columns", () => {
    const csv = "a,b\n2026-01-01,95.5\n";
    const result = parseWeightCsv(csv);
    expect(result.weighIns).toHaveLength(0);
    expect(result.skipped).toBe(1);
  });

  it("counts unreadable rows instead of dropping them silently", () => {
    const csv = "date,weight\n2026-01-01,95.5\nnot-a-date,94\n2026-01-02,\n";
    const result = parseWeightCsv(csv);
    expect(result.weighIns).toHaveLength(1);
    expect(result.skipped).toBe(2);
  });
});

describe("parseHealthExport", () => {
  it("picks the parser from the content, not the file name", () => {
    expect(parseHealthExport(appleRecord("2026-01-01", 95)).format).toBe("apple-health");
    expect(parseHealthExport("date,weight\n2026-01-01,95\n").format).toBe("csv");
  });
});

/** Builds a real (tiny) zip so the reader is exercised against the format. */
function makeZip(name: string, contents: string): Buffer {
  const nameBuf = Buffer.from(name);
  const raw = Buffer.from(contents);
  const deflated = zlib.deflateRawSync(raw);
  const crc = zlib.crc32 ? zlib.crc32(raw) : 0;

  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(8, 8); // deflate
  local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(deflated.length, 18);
  local.writeUInt32LE(raw.length, 22);
  local.writeUInt16LE(nameBuf.length, 26);

  const localHeaderOffset = 0;
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(20, 4);
  central.writeUInt16LE(20, 6);
  central.writeUInt16LE(8, 10);
  central.writeUInt32LE(crc, 16);
  central.writeUInt32LE(deflated.length, 20);
  central.writeUInt32LE(raw.length, 24);
  central.writeUInt16LE(nameBuf.length, 28);
  central.writeUInt32LE(localHeaderOffset, 42);

  const centralStart = 30 + nameBuf.length + deflated.length;
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(1, 8);
  eocd.writeUInt16LE(1, 10);
  eocd.writeUInt32LE(46 + nameBuf.length, 12);
  eocd.writeUInt32LE(centralStart, 16);

  return Buffer.concat([local, nameBuf, deflated, central, nameBuf, eocd]);
}

describe("zip entry reading", () => {
  it("lists what's in the archive", () => {
    const zip = makeZip("apple_health_export/export.xml", "<HealthData/>");
    expect(listZipEntries(zip)).toEqual(["apple_health_export/export.xml"]);
  });

  it("streams an entry back out intact", async () => {
    const xml = `<HealthData>${appleRecord("2026-01-01", 95.5)}${appleRecord("2026-01-05", 94.8)}</HealthData>`;
    const zip = makeZip("apple_health_export/export.xml", xml);

    const entry = openZipEntry(zip, (name) => name.endsWith("export.xml"));
    expect(entry).not.toBeNull();
    // The end-to-end path the route takes: unzip, stream, parse.
    const result = await parseAppleHealthStream(entry!);
    expect(result.weighIns).toEqual([
      { date: "2026-01-01", weightKg: 95.5 },
      { date: "2026-01-05", weightKg: 94.8 },
    ]);
  });

  it("returns nothing for an entry the archive doesn't have", () => {
    const zip = makeZip("something-else.txt", "hello");
    expect(openZipEntry(zip, (name) => name.endsWith("export.xml"))).toBeNull();
  });
});
