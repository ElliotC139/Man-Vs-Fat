import path from "node:path";
import express from "express";
import cookieParser from "cookie-parser";
import multer from "multer";
import { config } from "./config";
import { ensureUploadsDir, UPLOADS_DIR } from "./lib/storage";
import { ensureSessionSecret } from "./auth";
import { authRouter } from "./routes/auth";
import { entriesRouter } from "./routes/entries";
import { exercisesRouter } from "./routes/exercises";
import { foodsRouter } from "./routes/foods";
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
app.use("/api/foods", foodsRouter);
app.use("/api/match-weeks", matchWeeksRouter);
app.use("/api/whoop", whoopRouter);

app.get("/healthz", (_req, res) => res.json({ ok: true }));

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
  console.error("Unhandled request error:", err);
  res.status(500).json({ error: "Something went wrong." });
});

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
