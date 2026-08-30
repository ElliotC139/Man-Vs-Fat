import { Router } from "express";
import multer from "multer";
import { prisma } from "../db";
import { config } from "../config";
import { requireAuth } from "../auth";
import { estimateExercise } from "../estimateExercise";
import { z } from "zod";
import { findOrCreateMatchWeek, getLocalParts, getUserWeekStart, zonedTimeToUtc } from "../matchWeek";
import { saveUploadedImage, deleteUploadedImage } from "../lib/storage";
import { normalizeUploadedImage } from "../lib/imageProcessing";
import { consumeAll, AI_BURST, AI_DAILY } from "../rateLimit";

export const exercisesRouter = Router();
exercisesRouter.use(requireAuth);

// See lib/imageProcessing.ts — same reasoning as entries.ts for the raised
// limit (an un-normalized phone photo can exceed 8MB) and the conversion step.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

exercisesRouter.post("/", upload.single("photo"), async (req, res) => {
  const text = typeof req.body.text === "string" ? req.body.text.trim() : undefined;
  const rawPhoto = req.file;

  if (!text && !rawPhoto) {
    res.status(400).json({ error: "Provide a text description and/or a photo." });
    return;
  }

  let photo: { buffer: Buffer; mimeType: "image/jpeg" } | null = null;
  if (rawPhoto) {
    try {
      photo = await normalizeUploadedImage(rawPhoto.buffer, rawPhoto.mimetype);
    } catch (error) {
      console.error("Photo processing failed:", error);
      res.status(400).json({ error: "Couldn't process that photo — please try a different one." });
      return;
    }
  }

  // Same ceiling as food entries — this path calls the model too.
  const verdict = consumeAll(`ai:${req.userId!}`, [AI_BURST, AI_DAILY]);
  if (!verdict.allowed) {
    res.status(429)
      .set("Retry-After", String(verdict.retryAfterSec))
      .json({ error: "That's a lot of entries at once — give it a minute and try again." });
    return;
  }

  const { description, kcalBurned } = await estimateExercise(text, photo?.buffer.toString("base64"), photo?.mimeType);

  const imageUrl = photo ? saveUploadedImage(photo.buffer) : null;
  const timestamp = new Date();
  const weekStart = await getUserWeekStart(req.userId!);
  const matchWeek = await findOrCreateMatchWeek(timestamp, config.TIMEZONE, req.userId!, weekStart);

  const exercise = await prisma.exercise.create({
    data: { timestamp, description, kcalBurned, imageUrl, matchWeekId: matchWeek.id },
  });

  res.status(201).json(exercise);
});

const updateExerciseSchema = z.object({
  description: z.string().trim().min(1).max(200).optional(),
  kcalBurned: z.number().int().min(0).max(20000).nullable().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

/**
 * Food entries have always been editable and exercise hasn't, so fixing a
 * typo meant deleting the row and logging it again — which for a
 * WHOOP-imported workout also meant losing the link back to that workout.
 * Editing in place keeps whoopWorkoutId intact.
 */
exercisesRouter.patch("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const parsed = updateExerciseSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  if (Object.keys(parsed.data).length === 0) {
    res.status(400).json({ error: "Provide a description, a calorie figure and/or a date." });
    return;
  }

  const existing = await prisma.exercise.findUnique({ where: { id }, include: { matchWeek: true } });
  if (!existing || existing.matchWeek.userId !== req.userId) {
    res.status(404).json({ error: "Exercise not found" });
    return;
  }

  const { date, ...rest } = parsed.data;
  const data: typeof rest & { timestamp?: Date; matchWeekId?: number } = { ...rest };

  if (date) {
    // The time of day is carried over rather than reset, so a workout moved
    // to another date keeps its position relative to the week boundary.
    const local = getLocalParts(existing.timestamp, config.TIMEZONE);
    const [year, month, day] = date.split("-").map(Number) as [number, number, number];
    const timestamp = zonedTimeToUtc(year, month, day, local.hour, local.minute, config.TIMEZONE);
    const weekStart = await getUserWeekStart(req.userId!);
    const matchWeek = await findOrCreateMatchWeek(timestamp, config.TIMEZONE, req.userId!, weekStart);
    data.timestamp = timestamp;
    data.matchWeekId = matchWeek.id;
  }

  const exercise = await prisma.exercise.update({ where: { id }, data });
  res.json(exercise);
});

exercisesRouter.delete("/:id", async (req, res) => {
  const id = Number(req.params.id);
  try {
    const existing = await prisma.exercise.findUnique({ where: { id }, include: { matchWeek: true } });
    if (!existing || existing.matchWeek.userId !== req.userId) {
      res.status(404).json({ error: "Exercise not found" });
      return;
    }
    await prisma.exercise.delete({ where: { id } });
    if (existing.imageUrl) deleteUploadedImage(existing.imageUrl);
    res.status(204).end();
  } catch {
    res.status(404).json({ error: "Exercise not found" });
  }
});
