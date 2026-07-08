import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { prisma } from "../db";
import { config } from "../config";
import { requireAuth } from "../auth";
import { estimateMeal } from "../estimate";
import { findOrCreateMatchWeek, getLocalParts, getUserWeekStart, zonedTimeToUtc } from "../matchWeek";
import { MEAL_TYPES, MEAL_TYPE_DEFAULT_HOUR, inferMealType, type MealType } from "../mealType";
import { saveUploadedImage } from "../lib/storage";

export const entriesRouter = Router();
entriesRouter.use(requireAuth);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
});

const createEntrySchema = z.object({
  text: z.string().trim().optional(),
  timestamp: z.string().datetime().optional(),
  lastWeek: z.string().optional(),
});

entriesRouter.post("/", upload.single("photo"), async (req, res) => {
  const parsed = createEntrySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const { text, timestamp, lastWeek } = parsed.data;
  const photo = req.file;

  if (!text?.trim() && !photo) {
    res.status(400).json({ error: "Provide a text description and/or a photo." });
    return;
  }

  const weekStart = await getUserWeekStart(req.userId!);

  let entryTimestamp = timestamp ? new Date(timestamp) : new Date();
  if (lastWeek === "true") {
    // Place the entry 1 minute before the user's rollover boundary so it lands
    // in the closing week regardless of when it was actually logged.
    const now = getLocalParts(entryTimestamp, config.TIMEZONE);
    const rolloverToday = zonedTimeToUtc(now.year, now.month, now.day, weekStart.hour, weekStart.minute, config.TIMEZONE);
    entryTimestamp = new Date(rolloverToday.getTime() - 60_000);
  }

  const items = await estimateMeal({
    text,
    imageBase64: photo?.buffer.toString("base64"),
    imageMediaType: photo?.mimetype,
  });

  const imageUrl = photo ? saveUploadedImage(photo.buffer, photo.mimetype) : null;
  const matchWeek = await findOrCreateMatchWeek(entryTimestamp, config.TIMEZONE, req.userId!, weekStart);
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
  // Local calendar day (YYYY-MM-DD) to move the entry to.
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  // Explicit local hour (0-23) to pin the entry to. Needed alongside date/mealType
  // edits because a meal slot alone doesn't say which side of the Monday 17:00
  // match-week boundary it falls on — a Monday snack could be either side of it.
  hour: z.number().int().min(0).max(23).optional(),
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

  // Ownership is checked up front (via the entry's match week) so one user
  // can't read or mutate another's entry by guessing its id — a 404 here
  // (rather than 403) also avoids confirming the entry exists at all.
  const existing = await prisma.entry.findUnique({ where: { id }, include: { matchWeek: true } });
  if (!existing || existing.matchWeek.userId !== req.userId) {
    res.status(404).json({ error: "Entry not found" });
    return;
  }

  const { date, hour, ...rest } = parsed.data;

  try {
    const data: typeof rest & { edited: true; timestamp?: Date; matchWeekId?: number } = {
      ...rest,
      edited: true,
    };

    if (date !== undefined || hour !== undefined) {
      const localTime = getLocalParts(existing.timestamp, config.TIMEZONE);
      const [year, month, day] = date
        ? (date.split("-").map(Number) as [number, number, number])
        : [localTime.year, localTime.month, localTime.day];
      const effectiveMealType = (rest.mealType ?? existing.mealType) as MealType;
      const resolvedHour = hour ?? MEAL_TYPE_DEFAULT_HOUR[effectiveMealType];
      const newTimestamp = zonedTimeToUtc(year, month, day, resolvedHour, localTime.minute, config.TIMEZONE);
      const weekStart = await getUserWeekStart(req.userId!);
      const matchWeek = await findOrCreateMatchWeek(newTimestamp, config.TIMEZONE, req.userId!, weekStart);
      data.timestamp = newTimestamp;
      data.matchWeekId = matchWeek.id;
    }

    const entry = await prisma.entry.update({ where: { id }, data });
    res.json(entry);
  } catch {
    res.status(404).json({ error: "Entry not found" });
  }
});

entriesRouter.post("/:id/repeat", async (req, res) => {
  const id = Number(req.params.id);
  const existing = await prisma.entry.findUnique({ where: { id }, include: { matchWeek: true } });
  if (!existing || existing.matchWeek.userId !== req.userId) {
    res.status(404).json({ error: "Entry not found" });
    return;
  }

  const entryTimestamp = new Date();
  const weekStart = await getUserWeekStart(req.userId!);
  const matchWeek = await findOrCreateMatchWeek(entryTimestamp, config.TIMEZONE, req.userId!, weekStart);
  const mealType = inferMealType(getLocalParts(entryTimestamp, config.TIMEZONE).hour);

  const entry = await prisma.entry.create({
    data: {
      timestamp: entryTimestamp,
      rawInput: null,
      label: existing.label,
      kcal: existing.kcal,
      imageUrl: existing.imageUrl,
      mealType,
      matchWeekId: matchWeek.id,
    },
  });

  res.status(201).json(entry);
});

entriesRouter.delete("/:id", async (req, res) => {
  const id = Number(req.params.id);
  try {
    const existing = await prisma.entry.findUnique({ where: { id }, include: { matchWeek: true } });
    if (!existing || existing.matchWeek.userId !== req.userId) {
      res.status(404).json({ error: "Entry not found" });
      return;
    }
    await prisma.entry.delete({ where: { id } });
    res.status(204).end();
  } catch {
    res.status(404).json({ error: "Entry not found" });
  }
});
