import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export const UPLOADS_DIR = path.join(process.cwd(), "data", "uploads");

export function ensureUploadsDir(): void {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Callers run every upload through normalizeUploadedImage (see
// lib/imageProcessing.ts) before saving, so the buffer here is always a JPEG
// regardless of what format was originally uploaded.
export function saveUploadedImage(buffer: Buffer): string {
  const filename = `${Date.now()}-${crypto.randomUUID()}.jpg`;
  fs.writeFileSync(path.join(UPLOADS_DIR, filename), buffer);
  return `/uploads/${filename}`;
}
