import { prisma } from "../db";
import { listUploadedFiles, deleteUploadedImage, uploadModifiedAt, uploadFilename } from "../lib/storage";

/**
 * Sweeps up photos nothing references any more.
 *
 * Deleting an entry now removes its photo directly, but that only helps from
 * here on — the volume already holds files from every entry deleted before
 * that existed, plus any upload whose row creation failed part-way. This
 * reconciles the directory against the database instead of trusting either.
 */

// A file younger than this is left alone: an upload that has been written but
// whose row hasn't been created yet is indistinguishable from an orphan, and
// deleting it would break the entry being logged right now.
const MIN_AGE_MS = 24 * 60 * 60 * 1000;

export async function cleanupOrphanedUploads(now = Date.now()): Promise<number> {
  const [entries, exercises, photos] = await Promise.all([
    prisma.entry.findMany({ where: { imageUrl: { not: null } }, select: { imageUrl: true } }),
    prisma.exercise.findMany({ where: { imageUrl: { not: null } }, select: { imageUrl: true } }),
    prisma.progressPhoto.findMany({ select: { imageUrl: true } }),
  ]);

  const referenced = new Set<string>();
  for (const row of [...entries, ...exercises, ...photos]) {
    const name = uploadFilename(row.imageUrl);
    if (name) referenced.add(name);
  }

  let removed = 0;
  for (const filename of listUploadedFiles()) {
    if (referenced.has(filename)) continue;
    const modified = uploadModifiedAt(filename);
    if (!modified || now - modified.getTime() < MIN_AGE_MS) continue;
    deleteUploadedImage(`/uploads/${filename}`);
    removed += 1;
  }

  if (removed > 0) console.log(`Cleaned up ${removed} orphaned upload(s).`);
  return removed;
}
