import cron from "node-cron";
import { config } from "../config";
import { closeMatchWeeksNeedingReport } from "./weeklyReport";

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

  console.log(`Weekly report scheduler started (hourly checks, ${config.TIMEZONE}).`);
}
