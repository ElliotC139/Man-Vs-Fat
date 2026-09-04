import path from "node:path";
import express from "express";
import cookieParser from "cookie-parser";
import multer from "multer";
import { config } from "./config";
import { ensureUploadsDir, UPLOADS_DIR } from "./lib/storage";
import { ensureSessionSecret } from "./auth";
import { ensureVapidKeys } from "./push";
import { recordError } from "./errorLog";
import { authRouter } from "./routes/auth";
import { bodyRouter } from "./routes/body";
import { dataRouter } from "./routes/dataExport";
import { daysRouter } from "./routes/days";
import { diagnosticsRouter } from "./routes/diagnostics";
import { entriesRouter } from "./routes/entries";
import { exercisesRouter } from "./routes/exercises";
import { foodsRouter } from "./routes/foods";
import { foodSearchRouter } from "./routes/foodSearch";
import { matchWeeksRouter } from "./routes/matchWeeks";
import { mealsRouter } from "./routes/meals";
import { pushRouter } from "./routes/push";
import { statsRouter } from "./routes/stats";
import { weighInsRouter } from "./routes/weighIns";
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
app.use("/api/body", bodyRouter);
app.use("/api/data", dataRouter);
app.use("/api/days", daysRouter);
app.use("/api/diagnostics", diagnosticsRouter);
app.use("/api/entries", entriesRouter);
app.use("/api/exercises", exercisesRouter);
app.use("/api/foods", foodsRouter);
app.use("/api/food-search", foodSearchRouter);
app.use("/api/match-weeks", matchWeeksRouter);
app.use("/api/meals", mealsRouter);
app.use("/api/push", pushRouter);
app.use("/api/stats", statsRouter);
app.use("/api/weigh-ins", weighInsRouter);
app.use("/api/whoop", whoopRouter);

app.get("/healthz", (_req, res) => res.json({ ok: true }));

// Reached only if nothing above matched — no API route, no static file.
app.use((req, res) => {
  if (req.path.startsWith("/api/")) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.status(404).sendFile(path.join(process.cwd(), "public", "404.html"));
});

// Multer throws synchronously-caught errors (e.g. exceeding the upload size
// limit) that Express only reaches via the 4-arg error-handling signature —
// without this, a too-large photo previously fell through to Express's
// default HTML error page instead of a usable message.
app.use((err: unknown, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (res.headersSent) {
    next(err);
    return;
  }
  if (err instanceof multer.MulterError) {
    const message = err.code === "LIMIT_FILE_SIZE" ? "That photo is too large — please use a smaller image." : err.message;
    res.status(413).json({ error: message });
    return;
  }
  // Recorded rather than only logged, so a 500 at 3am is still findable at
  // 9am (see src/errorLog.ts). Deliberately not awaited: the response
  // shouldn't wait on a database write and a webhook.
  void recordError(`request ${_req.method} ${_req.path}`, err, _req.userId);
  res.status(500).json({ error: "Something went wrong." });
});

Promise.all([ensureSessionSecret(), ensureVapidKeys()])
  .then(() => {
    app.listen(config.PORT, () => {
      console.log(`Match week food diary listening on :${config.PORT} (timezone ${config.TIMEZONE})`);
      startScheduler();
    });
  })
  .catch((error) => {
    console.error("Failed to bootstrap session secret or push keys:", error);
    process.exit(1);
  });
