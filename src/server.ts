import path from "node:path";
import express from "express";
import cookieParser from "cookie-parser";
import { config } from "./config";
import { ensureUploadsDir, UPLOADS_DIR } from "./lib/storage";
import { ensureSessionSecret } from "./auth";
import { authRouter } from "./routes/auth";
import { entriesRouter } from "./routes/entries";
import { exercisesRouter } from "./routes/exercises";
import { matchWeeksRouter } from "./routes/matchWeeks";
import { whoopRouter } from "./routes/whoop";
import { startScheduler } from "./jobs/scheduler";

ensureUploadsDir();

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use("/uploads", express.static(UPLOADS_DIR));
app.use(express.static(path.join(process.cwd(), "public")));

app.use("/api/auth", authRouter);
app.use("/api/entries", entriesRouter);
app.use("/api/exercises", exercisesRouter);
app.use("/api/match-weeks", matchWeeksRouter);
app.use("/api/whoop", whoopRouter);

app.get("/healthz", (_req, res) => res.json({ ok: true }));

ensureSessionSecret()
  .then(() => {
    app.listen(config.PORT, () => {
      console.log(`Match week food diary listening on :${config.PORT} (timezone ${config.TIMEZONE})`);
      startScheduler();
    });
  })
  .catch((error) => {
    console.error("Failed to bootstrap session secret:", error);
    process.exit(1);
  });
