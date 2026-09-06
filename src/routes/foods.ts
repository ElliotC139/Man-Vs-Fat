import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { config } from "../config";
import { requireAuth } from "../auth";
import { findOrCreateMatchWeek, getLocalParts, getUserWeekStart } from "../matchWeek";
import { MEAL_TYPES, inferMealType } from "../mealType";
import { timestampOnLocalDay } from "../entryTiming";
import { normalizeLabel } from "../labelKey";
// Re-exported: this used to live here, and half the app still imports it from
// this module.
export { normalizeLabel };

export const foodsRouter = Router();
foodsRouter.use(requireAuth);


// Aggregates every Entry the user has ever logged (across all match weeks,
// not just the current one) into one row per distinct food, grouped by the
// normalized label above.
foodsRouter.get("/", async (req, res) => {
  const q = typeof req.query.q === "string" ? req.query.q.trim().toLowerCase() : "";

  const [entries, favorites, tags, overrides] = await Promise.all([
    prisma.entry.findMany({
      where: { matchWeek: { userId: req.userId! } },
      orderBy: { timestamp: "desc" },
      select: {
        label: true, kcal: true, proteinG: true, carbsG: true, fatG: true,
        fibreG: true, sugarG: true, satFatG: true, saltG: true, timestamp: true,
      },
    }),
    prisma.foodFavorite.findMany({ where: { userId: req.userId! } }),
    prisma.foodTag.findMany({ where: { userId: req.userId! }, orderBy: { tag: "asc" } }),
    prisma.foodOverride.findMany({ where: { userId: req.userId! } }),
  ]);
  const overrideByKey = new Map(overrides.map((o) => [o.labelKey, o]));

  const favoriteKeys = new Set(favorites.map((f) => f.labelKey));
  const tagsByKey = new Map<string, string[]>();
  for (const t of tags) {
    const arr = tagsByKey.get(t.labelKey) ?? [];
    arr.push(t.tag);
    tagsByKey.set(t.labelKey, arr);
  }

  // Entries are already ordered newest-first, so the first one seen for a
  // given key is the most recent — used as the display label/kcal so
  // slightly different capitalization over time doesn't matter.
  const byKey = new Map<
    string,
    {
      labelKey: string;
      label: string;
      kcal: number | null;
      proteinG: number | null;
      carbsG: number | null;
      fatG: number | null;
      fibreG: number | null;
      sugarG: number | null;
      satFatG: number | null;
      saltG: number | null;
      count: number;
      lastLoggedAt: Date;
    }
  >();
  for (const entry of entries) {
    const labelKey = normalizeLabel(entry.label);
    if (!labelKey) continue;
    const existing = byKey.get(labelKey);
    if (existing) {
      existing.count += 1;
    } else {
      byKey.set(labelKey, {
        labelKey,
        label: entry.label.trim(),
        kcal: entry.kcal,
        proteinG: entry.proteinG,
        carbsG: entry.carbsG,
        fatG: entry.fatG,
        fibreG: entry.fibreG,
        sugarG: entry.sugarG,
        satFatG: entry.satFatG,
        saltG: entry.saltG,
        count: 1,
        lastLoggedAt: entry.timestamp,
      });
    }
  }

  let foods = Array.from(byKey.values()).map((f) => {
    // A correction wins over whatever the last entry happened to say — that
    // is the entire point of making one.
    const fix = overrideByKey.get(f.labelKey);
    return {
      ...f,
      label: fix?.label ?? f.label,
      kcal: fix ? fix.kcal : f.kcal,
      proteinG: fix ? fix.proteinG : f.proteinG,
      carbsG: fix ? fix.carbsG : f.carbsG,
      fatG: fix ? fix.fatG : f.fatG,
      fibreG: fix ? fix.fibreG : f.fibreG,
      sugarG: fix ? fix.sugarG : f.sugarG,
      satFatG: fix ? fix.satFatG : f.satFatG,
      saltG: fix ? fix.saltG : f.saltG,
      edited: Boolean(fix),
      favorite: favoriteKeys.has(f.labelKey),
      tags: tagsByKey.get(f.labelKey) ?? [],
    };
  });

  if (q) {
    foods = foods.filter((f) => f.label.toLowerCase().includes(q) || f.tags.some((t) => t.toLowerCase().includes(q)));
  }

  // How often you eat something is what makes it worth finding again, so that
  // leads. Recency breaks the ties: between two foods you have both had ten
  // times, the one you had yesterday is the one you are looking for, not the
  // one from last week.
  foods.sort((a, b) => b.count - a.count || b.lastLoggedAt.getTime() - a.lastLoggedAt.getTime());

  res.json(foods);
});

const favoriteSchema = z.object({
  labelKey: z.string().trim().min(1),
  favorite: z.boolean(),
});

foodsRouter.post("/favorite", async (req, res) => {
  const parsed = favoriteSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const { labelKey, favorite } = parsed.data;

  if (favorite) {
    await prisma.foodFavorite.upsert({
      where: { userId_labelKey: { userId: req.userId!, labelKey } },
      update: {},
      create: { userId: req.userId!, labelKey },
    });
  } else {
    await prisma.foodFavorite.deleteMany({ where: { userId: req.userId!, labelKey } });
  }
  res.status(204).end();
});

const tagSchema = z.object({
  labelKey: z.string().trim().min(1),
  tag: z.string().trim().min(1).max(30),
});

foodsRouter.post("/tags", async (req, res) => {
  const parsed = tagSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const { labelKey, tag } = parsed.data;

  await prisma.foodTag.upsert({
    where: { userId_labelKey_tag: { userId: req.userId!, labelKey, tag } },
    update: {},
    create: { userId: req.userId!, labelKey, tag },
  });
  res.status(204).end();
});

foodsRouter.post("/tags/remove", async (req, res) => {
  const parsed = tagSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const { labelKey, tag } = parsed.data;

  await prisma.foodTag.deleteMany({ where: { userId: req.userId!, labelKey, tag } });
  res.status(204).end();
});

const logSchema = z.object({
  labelKey: z.string().trim().min(1),
  // The day being looked at, when that isn't today. The quick-add strip lives
  // on the Today screen, which can now be pointed at an earlier day — so a tap
  // there has to land on the day on screen, not the day it happens to be.
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  // Null means the user chose no tag; absent means infer from the clock.
  mealType: z.enum(MEAL_TYPES).nullable().optional(),
});

// Quick "+Today" re-log from the food library — same idea as POST
// /api/entries/:id/repeat, but keyed by the food's grouping label rather
// than one specific past entry, since the library shows one row per food.
foodsRouter.post("/log", async (req, res) => {
  const parsed = logSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const { labelKey, date, mealType: chosenMeal } = parsed.data;

  const [candidates, override] = await Promise.all([
    prisma.entry.findMany({
      where: { matchWeek: { userId: req.userId! } },
      orderBy: { timestamp: "desc" },
      select: {
        label: true,
        kcal: true,
        proteinG: true,
        carbsG: true,
        fatG: true,
        fibreG: true,
        sugarG: true,
        satFatG: true,
        saltG: true,
        imageUrl: true,
        source: true,
      },
    }),
    prisma.foodOverride.findUnique({ where: { userId_labelKey: { userId: req.userId!, labelKey } } }),
  ]);
  const match = candidates.find((e) => normalizeLabel(e.label) === labelKey);
  if (!match) {
    res.status(404).json({ error: "Food not found" });
    return;
  }

  const entryTimestamp = date ? timestampOnLocalDay(date, new Date(), chosenMeal) : new Date();
  const weekStart = await getUserWeekStart(req.userId!);
  const matchWeek = await findOrCreateMatchWeek(entryTimestamp, config.TIMEZONE, req.userId!, weekStart);
  const mealType = chosenMeal === undefined
    ? inferMealType(getLocalParts(entryTimestamp, config.TIMEZONE).hour)
    : chosenMeal;
  // Supplied means chosen; absent means the clock guessed and must not look
  // like a tag the user picked.
  const mealTypeSet = chosenMeal !== undefined;

  const entry = await prisma.entry.create({
    data: {
      timestamp: entryTimestamp,
      rawInput: null,
      label: override?.label ?? match.label,
      kcal: override ? override.kcal : match.kcal,
      // These were being dropped: a one-tap re-log copied the calories but
      // left the macros null, so every quick add quietly landed as an entry
      // with no macro breakdown and the day's totals came up short.
      proteinG: override ? override.proteinG : match.proteinG,
      carbsG: override ? override.carbsG : match.carbsG,
      fatG: override ? override.fatG : match.fatG,
      fibreG: override ? override.fibreG : match.fibreG,
      sugarG: override ? override.sugarG : match.sugarG,
      satFatG: override ? override.satFatG : match.satFatG,
      saltG: override ? override.saltG : match.saltG,
      imageUrl: match.imageUrl,
      mealType,
      mealTypeSet,
      // Figures the user typed themselves are no longer an estimate.
      source: override ? "manual" : match.source,
      matchWeekId: matchWeek.id,
    },
  });

  res.status(201).json(entry);
});

const editSchema = z.object({
  labelKey: z.string().min(1),
  label: z.string().trim().min(1).max(200),
  kcal: z.number().int().min(0).max(20000).nullable(),
  proteinG: z.number().min(0).max(1000).nullable().optional(),
  carbsG: z.number().min(0).max(1000).nullable().optional(),
  fatG: z.number().min(0).max(1000).nullable().optional(),
  fibreG: z.number().min(0).max(1000).nullable().optional(),
  sugarG: z.number().min(0).max(1000).nullable().optional(),
  satFatG: z.number().min(0).max(1000).nullable().optional(),
  saltG: z.number().min(0).max(100).nullable().optional(),
});

/**
 * Corrects a food's name and figures for every future one-tap log of it.
 *
 * Past entries are left exactly as they were. Someone fixing a bad estimate
 * wants the next Greggs sausage roll to be right, not last Tuesday's diary
 * rewritten under them — and the week totals they have already looked at
 * should not move because of an edit made today.
 */
foodsRouter.put("/edit", async (req, res) => {
  const parsed = editSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const { labelKey, label, kcal, proteinG, carbsG, fatG, ...rest } = parsed.data;

  // The rest of the label is only sent by a form that offered it, and an
  // absent field means "leave it alone" rather than "clear it". The editor
  // only shows the figures the diary is showing, so treating absence as null
  // would let hiding fibre in settings silently wipe every fibre correction
  // the user had made. An explicit null still clears one.
  const presentRest = Object.fromEntries(
    Object.entries(rest).filter(([, value]) => value !== undefined),
  );

  const data = {
    label,
    kcal,
    proteinG: proteinG ?? null,
    carbsG: carbsG ?? null,
    fatG: fatG ?? null,
    ...presentRest,
  };

  const override = await prisma.foodOverride.upsert({
    where: { userId_labelKey: { userId: req.userId!, labelKey } },
    update: data,
    create: { userId: req.userId!, labelKey, ...data },
  });

  res.json(override);
});

/** Drops a correction, so the food goes back to whatever was last logged. */
foodsRouter.post("/edit/reset", async (req, res) => {
  const labelKey = typeof req.body?.labelKey === "string" ? req.body.labelKey : "";
  if (!labelKey) {
    res.status(400).json({ error: "labelKey is required" });
    return;
  }
  await prisma.foodOverride.deleteMany({ where: { userId: req.userId!, labelKey } });
  res.json({ ok: true });
});
