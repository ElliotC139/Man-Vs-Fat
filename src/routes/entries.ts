import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { prisma } from "../db";
import { config } from "../config";
import { estimateMeal } from "../estimate";
import { findOrCreateMatchWeek, getLocalParts, zonedTimeToUtc } from "../matchWeek";
import { MEAL_TYPES, inferMealType } from "../mealType";
import { saveUploadedImage } from "../lib/storage";

export const entriesRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
});

const createEntrySchema = z.object({
  text: z.string().trim().optional(),
  timestamp: z.string().datetime().optional(),
});

entriesRouter.post("/", upload.single("photo"), async (req, res) => {
  const parsed = createEntrySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const { text, timestamp } = parsed.data;
  const photo = req.file;

  if (!text?.trim() && !photo) {
    res.status(400).json({ error: "Provide a text description and/or a photo." });
    return;
  }

  const entryTimestamp = timestamp ? new Date(timestamp) : new Date();

  const items = await estimateMeal({
    text,
    imageBase64: photo?.buffer.toString("base64"),
    imageMediaType: photo?.mimetype,
  });

  const imageUrl = photo ? saveUploadedImage(photo.buffer, photo.mimetype) : null;
  const matchWeek = await findOrCreateMatchWeek(entryTimestamp, config.TIMEZONE);
  const mealType = inferMealType(getLocalParts(entryTimestamp, config.TIMEZONE).hour);

  const entries = await prisma.$transaction(
    items.map((item) =>
      prisma.entry.create({
        data: {
          timestamp: entryTimestamp,
          rawInput: text ?? null,
          label: item.label,
          kcal: item.kcal,
          imageUrl,
          mealType,
          matchWeekId: matchWeek.id,
        },
      }),
    ),
  );

  res.status(201).json(entries);
});

const updateEntrySchema = z.object({
  label: z.string().trim().min(1).optional(),
  kcal: z.number().int().min(0).nullable().optional(),
  mealType: z.enum(MEAL_TYPES).optional(),
  // Local calendar day (YYYY-MM-DD) to move the entry to; time-of-day is kept as-is.
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

entriesRouter.patch("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const parsed = updateEntrySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  if (Object.keys(parsed.data).length === 0) {
    res.status(400).json({ error: "Provide label, kcal, mealType and/or date to update." });
    return;
  }

  const { date, ...rest } = parsed.data;

  try {
    const data: typeof rest & { edited: true; timestamp?: Date; matchWeekId?: number } = {
      ...rest,
      edited: true,
    };

    if (date) {
      const existing = await prisma.entry.findUnique({ where: { id } });
      if (!existing) {
        res.status(404).json({ error: "Entry not found" });
        return;
      }
      const [year, month, day] = date.split("-").map(Number) as [number, number, number];
      const localTime = getLocalParts(existing.timestamp, config.TIMEZONE);
      const newTimestamp = zonedTimeToUtc(year, month, day, localTime.hour, localTime.minute, config.TIMEZONE);
      const matchWeek = await findOrCreateMatchWeek(newTimestamp, config.TIMEZONE);
      data.timestamp = newTimestamp;
      data.matchWeekId = matchWeek.id;
    }

    const entry = await prisma.entry.update({ where: { id }, data });
    res.json(entry);
  } catch {
    res.status(404).json({ error: "Entry not found" });
  }
});

entriesRouter.delete("/:id", async (req, res) => {
  const id = Number(req.params.id);
  try {
    await prisma.entry.delete({ where: { id } });
    res.status(204).end();
  } catch {
    res.status(404).json({ error: "Entry not found" });
  }
});
