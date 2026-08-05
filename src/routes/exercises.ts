import { Router } from "express";
import multer from "multer";
import { prisma } from "../db";
import { config } from "../config";
import { requireAuth } from "../auth";
import { estimateExercise } from "../estimateExercise";
import { findOrCreateMatchWeek, getUserWeekStart } from "../matchWeek";
import { saveUploadedImage } from "../lib/storage";

export const exercisesRouter = Router();
exercisesRouter.use(requireAuth);

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });

exercisesRouter.post("/", upload.single("photo"), async (req, res) => {
  const text = typeof req.body.text === "string" ? req.body.text.trim() : undefined;
  const photo = req.file;

  if (!text && !photo) {
    res.status(400).json({ error: "Provide a text description and/or a photo." });
    return;
  }

  const { description, kcalBurned } = await estimateExercise(
    text,
    photo?.buffer.toString("base64"),
    photo?.mimetype,
  );

  const imageUrl = photo ? saveUploadedImage(photo.buffer, photo.mimetype) : null;
  const timestamp = new Date();
  const weekStart = await getUserWeekStart(req.userId!);
  const matchWeek = await findOrCreateMatchWeek(timestamp, config.TIMEZONE, req.userId!, weekStart);

  const exercise = await prisma.exercise.create({
    data: { timestamp, description, kcalBurned, imageUrl, matchWeekId: matchWeek.id },
  });

  res.status(201).json(exercise);
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
    res.status(204).end();
  } catch {
    res.status(404).json({ error: "Exercise not found" });
  }
});
