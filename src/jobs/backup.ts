import fs from "node:fs";
import path from "node:path";
import { prisma } from "../db";
import { config, driveConfigured } from "../config";
import { recordError } from "../errorLog";
import { uploadFileToDrive } from "../drive/uploadToDrive";

/**
 * Nightly database backup.
 *
 * Everything the app has ever recorded lives in one SQLite file on one Fly
 * volume, with no snapshot and no copy anywhere else — losing the volume lost
 * the lot. This makes a consistent copy on disk every night, keeps a rolling
 * fortnight of them, and pushes the newest one to Google Drive when Drive is
 * configured, so at least one copy exists off the machine.
 *
 * `VACUUM INTO` is what makes it safe to run against a live database: SQLite
 * writes a complete, consistent copy without holding the writers out, which a
 * plain file copy of a WAL-mode database can't promise.
 */

const BACKUP_DIR = path.join(process.cwd(), "data", "backups");
const KEEP_LOCAL_BACKUPS = 14;

function databasePath(): string {
  // DATABASE_URL is "file:../data/dev.db", relative to prisma/schema.prisma
  // rather than the repo root — the same quirk fly.toml calls out.
  const raw = config.DATABASE_URL.replace(/^file:/, "");
  return path.isAbsolute(raw) ? raw : path.resolve(process.cwd(), "prisma", raw);
}

function backupName(now: Date): string {
  return `diary-backup-${now.toISOString().slice(0, 10)}.db`;
}

function pruneOldBackups(): void {
  const files = fs
    .readdirSync(BACKUP_DIR)
    .filter((name) => name.startsWith("diary-backup-") && name.endsWith(".db"))
    // The date is in the filename, so lexical order is chronological order.
    .sort();

  for (const stale of files.slice(0, Math.max(0, files.length - KEEP_LOCAL_BACKUPS))) {
    fs.rmSync(path.join(BACKUP_DIR, stale), { force: true });
  }
}

export async function runBackup(): Promise<string | null> {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });

  const target = path.join(BACKUP_DIR, backupName(new Date()));
  // Re-running on the same day overwrites rather than failing: VACUUM INTO
  // refuses to write to a file that already exists.
  fs.rmSync(target, { force: true });

  // Interpolated rather than parameterised because SQLite does not accept a
  // bind parameter for the VACUUM target. The path is built here from a
  // fixed directory and a date, never from user input.
  await prisma.$executeRawUnsafe(`VACUUM INTO '${target.replace(/'/g, "''")}'`);
  pruneOldBackups();

  if (driveConfigured) {
    try {
      await uploadFileToDrive(backupName(new Date()), fs.readFileSync(target), "application/x-sqlite3");
    } catch (error) {
      // A failed upload still leaves the local copy, so this is worth
      // recording but not worth failing the whole backup over.
      await recordError("backup.drive", error);
    }
  }

  console.log(`Database backup written to ${target}${driveConfigured ? " and uploaded to Drive" : ""}.`);
  return target;
}

export interface BackupStatus {
  latest: string | null;
  latestAt: string | null;
  count: number;
  offsite: boolean;
}

/** What the Diagnostics panel shows, so a silent backup failure is visible. */
export function backupStatus(): BackupStatus {
  let files: string[] = [];
  try {
    files = fs.readdirSync(BACKUP_DIR).filter((name) => name.endsWith(".db")).sort();
  } catch {
    files = [];
  }
  const latest = files[files.length - 1] ?? null;
  let latestAt: string | null = null;
  if (latest) {
    try {
      latestAt = fs.statSync(path.join(BACKUP_DIR, latest)).mtime.toISOString();
    } catch {
      latestAt = null;
    }
  }
  return { latest, latestAt, count: files.length, offsite: driveConfigured };
}

export { databasePath };
