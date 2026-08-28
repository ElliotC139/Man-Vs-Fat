import zlib from "node:zlib";
import { Readable } from "node:stream";

/**
 * Just enough zip reading to pull one file out of an archive as a stream.
 *
 * A dependency for this would be one more thing to keep patched for a format
 * that hasn't changed since 1993, and Node's zlib already does the only hard
 * part — a zip entry is raw deflate with a header in front of it.
 *
 * Entries are located through the central directory at the end of the file
 * rather than by scanning for local headers: when an archive is written
 * streaming (bit 3 of the flags), the local header's sizes are zero and the
 * real ones live in a descriptor after the data, where they can't be read
 * ahead of time.
 */

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const MAX_COMMENT = 0xffff;

interface ZipEntry {
  name: string;
  compressionMethod: number;
  compressedSize: number;
  localHeaderOffset: number;
}

function findEndOfCentralDirectory(buffer: Buffer): number | null {
  // The EOCD is last, but a trailing comment can push it back by up to 64KB.
  const earliest = Math.max(0, buffer.length - MAX_COMMENT - 22);
  for (let i = buffer.length - 22; i >= earliest; i--) {
    if (buffer.readUInt32LE(i) === EOCD_SIGNATURE) return i;
  }
  return null;
}

function readCentralDirectory(buffer: Buffer): ZipEntry[] {
  const eocd = findEndOfCentralDirectory(buffer);
  if (eocd === null) return [];

  let offset = buffer.readUInt32LE(eocd + 16);
  const count = buffer.readUInt16LE(eocd + 10);
  const entries: ZipEntry[] = [];

  for (let i = 0; i < count; i++) {
    if (offset + 46 > buffer.length || buffer.readUInt32LE(offset) !== CENTRAL_SIGNATURE) break;
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    entries.push({
      compressionMethod: buffer.readUInt16LE(offset + 10),
      compressedSize: buffer.readUInt32LE(offset + 20),
      name: buffer.toString("utf8", offset + 46, offset + 46 + nameLength),
      localHeaderOffset: buffer.readUInt32LE(offset + 42),
    });
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

/** Where an entry's compressed bytes actually begin, past its local header. */
function dataOffsetOf(buffer: Buffer, entry: ZipEntry): number {
  const local = entry.localHeaderOffset;
  const nameLength = buffer.readUInt16LE(local + 26);
  const extraLength = buffer.readUInt16LE(local + 28);
  return local + 30 + nameLength + extraLength;
}

export function listZipEntries(buffer: Buffer): string[] {
  return readCentralDirectory(buffer).map((e) => e.name);
}

/**
 * Opens the first entry whose name satisfies `match`, as a stream of its
 * decompressed bytes. Null when the archive has no such entry.
 */
export function openZipEntry(buffer: Buffer, match: (name: string) => boolean): Readable | null {
  const entry = readCentralDirectory(buffer).find((e) => match(e.name));
  if (!entry) return null;

  const start = dataOffsetOf(buffer, entry);
  const compressed = buffer.subarray(start, start + entry.compressedSize);

  // 0 = stored, 8 = deflate. Nothing else is worth supporting here.
  if (entry.compressionMethod === 0) return Readable.from([compressed]);
  if (entry.compressionMethod !== 8) return null;

  const source = Readable.from([compressed]);
  return source.pipe(zlib.createInflateRaw());
}
