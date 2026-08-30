import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { prisma } from "../db";
import { config } from "../config";
import { requireAuth } from "../auth";
import { localDayKey } from "../matchWeek";
import { saveUploadedImage, deleteUploadedImage } from "../lib/storage";
import { normalizeUploadedImage } from "../lib/imageProcessing";

/**
 * Body measurements and progress photos — the two ways of tracking a change
 * the scale doesn't show. Both are keyed by calendar day rather than by match
 * week: a waist is a waist regardless of which side of Monday 17:00 it was
 * measured on.
 */
export const bodyRouter = Router();
bodyRouter.use(requireAuth);

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// A tape measure reads in whole or half centimetres; the bounds are just wide
// enough to catch a misplaced decimal point rather than to judge anyone.
const measurementSchema = z.object({
  date: z.string().regex(DATE_RE),
  waistCm: z.number().min(30).max(250).nullable().optional(),
  chestCm: z.number().min(30).max(250).nullable().optional(),
  hipsCm: z.number().min(30).max(250).nullable().optional(),
  thighCm: z.number().min(20).max(150).nullable().optional(),
  armCm: z.number().min(10).max(100).nullable().optional(),
});

bodyRouter.get("/measurements", async (req, res) => {
  const measurements = await prisma.measurement.findMany({
    where: { userId: req.userId! },
    orderBy: { date: "asc" },
  });
  res.json(measurements);
});

bodyRouter.post("/measurements", async (req, res) => {
  const parsed = measurementSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Check those measurements — they look out of range." });
    return;
  }
  const { date, ...values } = parsed.data;

  if (date > localDayKey(new Date(), config.TIMEZONE)) {
    res.status(400).json({ error: "Can't log a measurement for a future date." });
    return;
  }
  if (Object.values(values).every((value) => value === undefined || value === null)) {
    res.status(400).json({ error: "Enter at least one measurement." });
    return;
  }

  const measurement = await prisma.measurement.upsert({
    where: { userId_date: { userId: req.userId!, date } },
    update: values,
    create: { userId: req.userId!, date, ...values },
  });
  res.json(measurement);
});

bodyRouter.delete("/measurements/:date", async (req, res) => {
  await prisma.measurement.deleteMany({ where: { userId: req.userId!, date: req.params.date } });
  res.status(204).end();
});

bodyRouter.get("/photos", async (req, res) => {
  const photos = await prisma.progressPhoto.findMany({
    where: { userId: req.userId! },
    orderBy: [{ date: "desc" }, { id: "desc" }],
  });
  res.json(photos);
});

bodyRouter.post("/photos", upload.single("photo"), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: "Choose a photo first." });
    return;
  }

  const date = typeof req.body.date === "string" && DATE_RE.test(req.body.date)
    ? req.body.date
    : localDayKey(new Date(), config.TIMEZONE);
  const note = typeof req.body.note === "string" && req.body.note.trim() ? req.body.note.trim().slice(0, 200) : null;

  let normalized;
  try {
    normalized = await normalizeUploadedImage(req.file.buffer, req.file.mimetype);
  } catch (error) {
    console.error("Progress photo processing failed:", error);
    res.status(400).json({ error: "Couldn't process that photo — please try a different one." });
    return;
  }

  const imageUrl = saveUploadedImage(normalized.buffer);
  const photo = await prisma.progressPhoto.create({ data: { userId: req.userId!, date, imageUrl, note } });
  res.status(201).json(photo);
});

bodyRouter.delete("/photos/:id", async (req, res) => {
  const id = Number(req.params.id);
  const existing = await prisma.progressPhoto.findUnique({ where: { id } });
  if (!existing || existing.userId !== req.userId) {
    res.status(404).json({ error: "Photo not found" });
    return;
  }
  await prisma.progressPhoto.delete({ where: { id } });
  deleteUploadedImage(existing.imageUrl);
  res.status(204).end();
});
