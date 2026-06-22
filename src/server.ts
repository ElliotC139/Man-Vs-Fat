import path from "node:path";
import express from "express";
import { config } from "./config";
import { ensureUploadsDir, UPLOADS_DIR } from "./lib/storage";
import { entriesRouter } from "./routes/entries";
import { matchWeeksRouter } from "./routes/matchWeeks";
import { startScheduler } from "./jobs/scheduler";

ensureUploadsDir();

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static(UPLOADS_DIR));
app.use(express.static(path.join(process.cwd(), "public")));

app.use("/api/entries", entriesRouter);
app.use("/api/match-weeks", matchWeeksRouter);

app.get("/healthz", (_req, res) => res.json({ ok: true }));

app.listen(config.PORT, () => {
  console.log(`Match week food diary listening on :${config.PORT} (timezone ${config.TIMEZONE})`);
  startScheduler();
});
