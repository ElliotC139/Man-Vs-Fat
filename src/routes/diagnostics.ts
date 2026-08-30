import { Router } from "express";
import { prisma } from "../db";
import { requireAuth } from "../auth";
import { backupStatus, runBackup } from "../jobs/backup";
import { recordError } from "../errorLog";

/**
 * What Settings > Diagnostics reads. Errors used to go to stdout only, where
 * a failure overnight had rolled away by morning; this is the same
 * information somewhere it can still be looked at.
 *
 * Everything here is account-wide rather than per-user, which is fine for a
 * single-operator app but is the reason to revisit this if the app ever
 * genuinely has separate members: an error message can carry another user's
 * data in it.
 */
export const diagnosticsRouter = Router();
diagnosticsRouter.use(requireAuth);

diagnosticsRouter.get("/", async (_req, res) => {
  const [errors, errorCount] = await Promise.all([
    prisma.appError.findMany({ orderBy: { createdAt: "desc" }, take: 20 }),
    prisma.appError.count(),
  ]);

  res.json({
    backup: backupStatus(),
    errorCount,
    errors: errors.map((error) => ({
      id: error.id,
      context: error.context,
      message: error.message,
      createdAt: error.createdAt,
    })),
  });
});

diagnosticsRouter.post("/backup", async (_req, res) => {
  try {
    await runBackup();
    res.json({ ok: true, backup: backupStatus() });
  } catch (error) {
    await recordError("backup.manual", error);
    res.status(500).json({ error: "The backup failed — see the errors below." });
  }
});

diagnosticsRouter.delete("/errors", async (_req, res) => {
  await prisma.appError.deleteMany({});
  res.status(204).end();
});
