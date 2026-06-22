import cron from "node-cron";
import { config } from "../config";
import { closeMatchWeeksNeedingReport } from "./weeklyReport";

export function startScheduler(): void {
  // Every Monday at 17:00 in the configured timezone, i.e. right at the
  // match week boundary.
  cron.schedule(
    "0 17 * * 1",
    () => {
      closeMatchWeeksNeedingReport().catch((error) => console.error("Scheduled report run failed:", error));
    },
    { timezone: config.TIMEZONE },
  );

  // Catch up on startup too, in case the boundary passed while the process
  // was offline (deploys, restarts, etc).
  setTimeout(() => {
    closeMatchWeeksNeedingReport().catch((error) => console.error("Startup catch-up report run failed:", error));
  }, 5_000);

  console.log(`Weekly report scheduler started (Mon 17:00 ${config.TIMEZONE}).`);
}
