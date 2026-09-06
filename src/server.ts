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
import { sharesRouter } from "./routes/shares";
import { startScheduler } from "./jobs/scheduler";

ensureUploadsDir();

const app = express();

/**
 * Response headers.
 *
 * Permissions-Policy is the one that matters here: `camera=(self)` means the
 * camera can only ever be reached by this origin's own pages. Anything the
 * browser loads inside this app — a font, a script, an embedded frame — is
 * refused it outright, so granting this site the camera grants it to this site
 * and nothing else riding along inside it.
 *
 * What it cannot do is narrow the browser's own permission prompt: whether a
 * phone remembers "allow" for this site alone or for everything is a device
 * setting, and Settings > Camera & microphone says where to find it.
 */
app.use((_req, res, next) => {
  res.setHeader("Permissions-Policy", "camera=(self), microphone=(self), geolocation=(), payment=()");
  // Nothing here should ever be framed by another site — the app holds a
  // logged-in session, and a frame around it is how that gets used by someone
  // else's page.
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-Content-Type-Options", "nosniff");
  // Enough for an analytics referrer, never the path of a page someone was on.
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  next();
});

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
app.use("/api/shares", sharesRouter);

app.get("/healthz", (_req, res) => res.json({ ok: true }));

// A shared link is short and pasteable, and serves the ordinary app shell —
// the page reads the token out of its own URL and asks the API for the items.
// Static files are matched above, so this can't shadow one.
app.get("/s/:token", (_req, res) => {
  res.sendFile(path.join(process.cwd(), "public", "index.html"));
});

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
