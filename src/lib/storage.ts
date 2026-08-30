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

/**
 * Deletes a file previously returned by saveUploadedImage. Takes the stored
 * URL ("/uploads/<name>") rather than a path, because that's what the
 * database holds. Anything that isn't a plain filename inside UPLOADS_DIR is
 * ignored, so a doctored value can't reach outside the uploads directory.
 */
export function deleteUploadedImage(imageUrl: string | null | undefined): void {
  const filename = uploadFilename(imageUrl);
  if (!filename) return;
  try {
    fs.unlinkSync(path.join(UPLOADS_DIR, filename));
  } catch (error) {
    // Already gone is the expected case when two rows shared one photo.
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}

/** The bare filename inside UPLOADS_DIR, or null if the URL isn't one of ours. */
export function uploadFilename(imageUrl: string | null | undefined): string | null {
  if (!imageUrl || !imageUrl.startsWith("/uploads/")) return null;
  const filename = imageUrl.slice("/uploads/".length);
  if (!filename || filename.includes("/") || filename.includes("\\") || filename.includes("..")) return null;
  return filename;
}

/** Every file currently sitting in the uploads directory. */
export function listUploadedFiles(): string[] {
  try {
    return fs.readdirSync(UPLOADS_DIR);
  } catch {
    return [];
  }
}

/** Last-modified time of an upload, or null if it has gone. */
export function uploadModifiedAt(filename: string): Date | null {
  try {
    return fs.statSync(path.join(UPLOADS_DIR, filename)).mtime;
  } catch {
    return null;
  }
}
