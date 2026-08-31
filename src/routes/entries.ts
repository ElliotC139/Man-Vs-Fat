import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { prisma } from "../db";
import { config } from "../config";
import { requireAuth } from "../auth";
import { estimateMeal, type EstimateItem } from "../estimate";
import { scaleMacros } from "../macros";
import { findOrCreateMatchWeek, getLocalParts, getUserWeekStart, localDayKey, zonedTimeToUtc } from "../matchWeek";
import { MEAL_TYPES, MEAL_TYPE_DEFAULT_HOUR, inferMealType, type MealType } from "../mealType";
import { saveUploadedImage, deleteUploadedImage } from "../lib/storage";
import { normalizeUploadedImage } from "../lib/imageProcessing";
import { consumeAll, AI_BURST, AI_DAILY } from "../rateLimit";

export const entriesRouter = Router();
entriesRouter.use(requireAuth);

const upload = multer({
  storage: multer.memoryStorage(),
  // Generous headroom for an un-normalized phone-camera original (HDR/high
  // megapixel photos routinely exceed the old 8MB cap) — normalizeUploadedImage
  // shrinks it well below this before anything is stored or sent anywhere.
  limits: { fileSize: 25 * 1024 * 1024 },
});

const createEntrySchema = z.object({
  text: z.string().trim().optional(),
  timestamp: z.string().datetime().optional(),
  lastWeek: z.string().optional(),
  directKcal: z.coerce.number().int().positive().optional(),
  // Sent alongside directKcal by the barcode scanner and food search when
  // Open Food Facts has per-100g macro data. Real label figures, so they skip
  // estimation entirely — same reasoning as directKcal.
  directProteinG: z.coerce.number().min(0).max(1000).optional(),
  directCarbsG: z.coerce.number().min(0).max(1000).optional(),
  directFatG: z.coerce.number().min(0).max(1000).optional(),
});

entriesRouter.post("/", upload.single("photo"), async (req, res) => {
  const parsed = createEntrySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const { text, timestamp, lastWeek, directKcal, directProteinG, directCarbsG, directFatG } = parsed.data;
  const rawPhoto = req.file;

  if (!text?.trim() && !rawPhoto) {
    res.status(400).json({ error: "Provide a text description and/or a photo." });
    return;
  }

  // Converts HEIC (the default iPhone format, which Claude's vision API
  // doesn't accept) to JPEG and downsizes anything oversized — see
  // lib/imageProcessing.ts for why this is needed at all.
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

  const weekStart = await getUserWeekStart(req.userId!);

  let entryTimestamp = timestamp ? new Date(timestamp) : new Date();
  if (lastWeek === "true") {
    // Place the entry 1 minute before the user's rollover boundary so it lands
    // in the closing week regardless of when it was actually logged.
    const now = getLocalParts(entryTimestamp, config.TIMEZONE);
    const rolloverToday = zonedTimeToUtc(now.year, now.month, now.day, weekStart.hour, weekStart.minute, config.TIMEZONE);
    entryTimestamp = new Date(rolloverToday.getTime() - 60_000);
  }

  // directKcal is supplied by the barcode scanner and food search when Open
  // Food Facts has nutrition data — skip AI estimation and use the known
  // value directly, and record that the figure came from a real database
  // rather than a guess.
  const source = directKcal ? "database" : "ai";

  // Only the estimating path is metered — a barcode scan or a typed number
  // costs nothing, and rationing those would punish exactly the entries the
  // app most wants people to make.
  if (!directKcal) {
    const verdict = consumeAll(`ai:${req.userId!}`, [AI_BURST, AI_DAILY]);
    if (!verdict.allowed) {
      res.status(429)
        .set("Retry-After", String(verdict.retryAfterSec))
        .json({ error: "That's a lot of entries at once — give it a minute and try again." });
      return;
    }
  }

  const items: EstimateItem[] = directKcal
    ? [
        {
          label: text?.trim() || "Scanned item",
          kcal: directKcal,
          proteinG: directProteinG ?? null,
          carbsG: directCarbsG ?? null,
          fatG: directFatG ?? null,
        },
      ]
    : await estimateMeal({
        text,
        imageBase64: photo?.buffer.toString("base64"),
        imageMediaType: photo?.mimeType,
      });

  const imageUrl = photo ? saveUploadedImage(photo.buffer) : null;
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
          proteinG: item.proteinG,
          carbsG: item.carbsG,
          fatG: item.fatG,
          imageUrl,
          mealType,
          source,
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
  // How many were eaten. Changing this rescales kcal from the old quantity,
  // so "two of those" is one tap rather than re-describing the food.
  quantity: z.number().min(0.25).max(50).optional(),
  // Typed over an estimate the same way kcal can be. Null clears a figure
  // back to "not known" rather than setting it to zero.
  proteinG: z.number().min(0).max(1000).nullable().optional(),
  carbsG: z.number().min(0).max(1000).nullable().optional(),
  fatG: z.number().min(0).max(1000).nullable().optional(),
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

  const { date, hour, quantity, ...rest } = parsed.data;

  try {
    const data: typeof rest & {
      edited: true;
      source?: string;
      timestamp?: Date;
      matchWeekId?: number;
      quantity?: number;
      proteinG?: number | null;
      carbsG?: number | null;
      fatG?: number | null;
    } = {
      ...rest,
      edited: true,
    };

    // Typing a number over an estimate makes it the user's own figure, so it
    // should stop being labelled as guessed.
    if (rest.kcal !== undefined && rest.kcal !== null) data.source = "manual";

    if (quantity !== undefined) {
      data.quantity = quantity;
      // kcal and the macros store the total for the whole entry, so a
      // quantity change has to move them too — scaled from the previous
      // quantity rather than from one unit, since the entry may already have
      // been "two of those". An explicit figure in the same request wins:
      // that's the user overriding the arithmetic, which is the whole point
      // of being able to type it.
      if (existing.quantity > 0) {
        const factor = quantity / existing.quantity;
        if (rest.kcal === undefined && existing.kcal !== null) {
          data.kcal = Math.round(existing.kcal * factor);
        }
        const scaled = scaleMacros(existing, factor);
        if (rest.proteinG === undefined) data.proteinG = scaled.proteinG;
        if (rest.carbsG === undefined) data.carbsG = scaled.carbsG;
        if (rest.fatG === undefined) data.fatG = scaled.fatG;
      }
    }

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
      quantity: existing.quantity,
      proteinG: existing.proteinG,
      carbsG: existing.carbsG,
      fatG: existing.fatG,
      imageUrl: existing.imageUrl,
      mealType,
      // A repeat is only as trustworthy as what it copies, so it inherits
      // the original's provenance rather than claiming a fresh one.
      source: existing.source,
      matchWeekId: matchWeek.id,
    },
  });

  res.status(201).json(entry);
});

const copyDaySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

/**
 * Duplicates every food entry from one calendar day onto another — the
 * "copy yesterday" shortcut. Each copy keeps its original time of day, so a
 * copied breakfast stays a breakfast and, on a rollover Monday, still lands
 * on the same side of the week boundary as the meal it came from.
 */
entriesRouter.post("/copy-day", async (req, res) => {
  const parsed = copyDaySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Pick a day to copy from and a day to copy to." });
    return;
  }
  const { from, to } = parsed.data;
  if (from === to) {
    res.status(400).json({ error: "Those are the same day." });
    return;
  }
  // Same rule as a weigh-in: this is a diary of what was eaten, so copying
  // onto a day that hasn't happened would put food in a week's totals before
  // anyone ate it.
  if (to > localDayKey(new Date(), config.TIMEZONE)) {
    res.status(400).json({ error: "Can't copy onto a day that hasn't happened yet." });
    return;
  }

  const weekStart = await getUserWeekStart(req.userId!);
  const weeks = await prisma.matchWeek.findMany({
    where: { userId: req.userId! },
    include: { entries: true },
  });

  const source = weeks
    .flatMap((week) => week.entries)
    .filter((entry) => localDayKey(entry.timestamp, config.TIMEZONE) === from)
    .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  if (source.length === 0) {
    res.status(404).json({ error: "Nothing was logged on that day." });
    return;
  }

  const [year, month, day] = to.split("-").map(Number) as [number, number, number];
  const created = [];
  for (const entry of source) {
    const local = getLocalParts(entry.timestamp, config.TIMEZONE);
    const timestamp = zonedTimeToUtc(year, month, day, local.hour, local.minute, config.TIMEZONE);
    const matchWeek = await findOrCreateMatchWeek(timestamp, config.TIMEZONE, req.userId!, weekStart);
    created.push(
      await prisma.entry.create({
        data: {
          timestamp,
          rawInput: null,
          label: entry.label,
          kcal: entry.kcal,
          quantity: entry.quantity,
          proteinG: entry.proteinG,
          carbsG: entry.carbsG,
          fatG: entry.fatG,
          // The photo is left behind on purpose: it is a picture of a meal
          // eaten on the original day, and carrying it over would make the
          // copy claim to be evidence of something that didn't happen.
          imageUrl: null,
          mealType: entry.mealType,
          source: entry.source,
          matchWeekId: matchWeek.id,
        },
      }),
    );
  }

  res.status(201).json(created);
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
    // Photos used to outlive the row that referenced them, filling the volume
    // with files nothing could ever show again. A photo shared with another
    // entry (a repeat copies the URL) is kept.
    if (existing.imageUrl) {
      const stillUsed = await prisma.entry.count({ where: { imageUrl: existing.imageUrl } });
      if (stillUsed === 0) deleteUploadedImage(existing.imageUrl);
    }
    res.status(204).end();
  } catch {
    res.status(404).json({ error: "Entry not found" });
  }
});
