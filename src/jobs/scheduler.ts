import cron from "node-cron";
import { config } from "../config";
import { closeMatchWeeksNeedingReport } from "./weeklyReport";
import { sendDueReminders } from "./reminders";
import { syncAllConnectedUsers } from "../whoop/sync";
import { runBackup } from "./backup";
import { cleanupOrphanedUploads } from "./cleanupUploads";
import { recordError } from "../errorLog";

export function startScheduler(): void {
  // Hourly rather than a single fixed weekly tick, since each user now has
  // their own week-start weekday/time — this keeps every user's report
  // latency to within an hour of their own boundary instead of just one
  // user's. closeMatchWeeksNeedingReport() is idempotent (keys off each row's
  // own endsAt), so running it more often is free.
  cron.schedule(
    "0 * * * *",
    () => {
      closeMatchWeeksNeedingReport().catch((error) => console.error("Scheduled report run failed:", error));
    },
    { timezone: config.TIMEZONE },
  );

  // Catch up on startup too, in case a boundary passed while the process was
  // offline (deploys, restarts, etc).
  setTimeout(() => {
    closeMatchWeeksNeedingReport().catch((error) => console.error("Startup catch-up report run failed:", error));
  }, 5_000);

  // Backstop for the WHOOP webhook: covers missed/delayed deliveries and
  // connections still waiting on their first ping. 20 min keeps the budget
  // widget reasonably fresh without hammering WHOOP's API.
  cron.schedule("*/20 * * * *", () => {
    syncAllConnectedUsers().catch((error) => console.error("Scheduled WHOOP sync run failed:", error));
  });
  setTimeout(() => {
    syncAllConnectedUsers().catch((error) => console.error("Startup catch-up WHOOP sync run failed:", error));
  }, 10_000);

  // On the hour, so the check lines up with the whole-hour reminderHour each
  // user picks. sendDueReminders is a no-op for anyone who hasn't set one.
  cron.schedule(
    "0 * * * *",
    () => {
      sendDueReminders().catch((error) => console.error("Scheduled reminder run failed:", error));
    },
    { timezone: config.TIMEZONE },
  );

  // 03:30 local — after the last plausible late-night entry and well clear
  // of the Monday 17:00 rollover, so a backup never runs mid-week-close.
  cron.schedule(
    "30 3 * * *",
    () => {
      runBackup().catch((error) => recordError("backup", error));
    },
    { timezone: config.TIMEZONE },
  );

  // Straight after the backup, so a sweep that deletes something it shouldn't
  // is always recoverable from a copy taken minutes earlier.
  cron.schedule(
    "45 3 * * *",
    () => {
      cleanupOrphanedUploads().catch((error) => recordError("cleanupUploads", error));
    },
    { timezone: config.TIMEZONE },
  );

  // A first backup shortly after boot, so a machine that never survives to
  // 03:30 still leaves one behind.
  setTimeout(() => {
    runBackup().catch((error) => recordError("backup.startup", error));
  }, 30_000);

  console.log(`Weekly report scheduler started (hourly checks, ${config.TIMEZONE}).`);
}
