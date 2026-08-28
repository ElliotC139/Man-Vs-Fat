import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { config } from "../config";
import { requireAuth } from "../auth";
import { findOrCreateMatchWeek, getLocalParts, getUserWeekStart } from "../matchWeek";
import { inferMealType } from "../mealType";

export const foodsRouter = Router();
foodsRouter.use(requireAuth);

// Filler words that don't distinguish one food from another — stripped so
// e.g. "a bowl of chicken and rice" and "chicken and rice" group together.
const STOPWORDS = new Set([
  "a", "an", "the", "and", "or", "with", "of", "some", "few", "little", "bit",
  "handful", "plate", "bowl", "cup", "glass", "portion", "serving", "piece", "pieces",
  "small", "medium", "large", "extra",
]);

// Groups entries by meaning rather than exact text: lowercases, strips
// punctuation and filler words, crudely singularizes, then sorts the
// remaining significant words — so word order ("rice and chicken" vs
// "chicken and rice") and minor phrasing differences collapse to the same
// key without needing another AI call. Conservative on purpose (no
// stemming/synonyms beyond a trailing-s check) to avoid merging genuinely
// different foods.
export function normalizeLabel(label: string): string {
  const words = label
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .filter((w) => !STOPWORDS.has(w) && !/^\d+$/.test(w))
    .map((w) => (w.length > 3 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w));

  return words.sort().join(" ");
}

// Aggregates every Entry the user has ever logged (across all match weeks,
// not just the current one) into one row per distinct food, grouped by the
// normalized label above.
foodsRouter.get("/", async (req, res) => {
  const q = typeof req.query.q === "string" ? req.query.q.trim().toLowerCase() : "";

  const [entries, favorites, tags] = await Promise.all([
    prisma.entry.findMany({
      where: { matchWeek: { userId: req.userId! } },
      orderBy: { timestamp: "desc" },
      select: { label: true, kcal: true, timestamp: true },
    }),
    prisma.foodFavorite.findMany({ where: { userId: req.userId! } }),
    prisma.foodTag.findMany({ where: { userId: req.userId! }, orderBy: { tag: "asc" } }),
  ]);

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
    { labelKey: string; label: string; kcal: number | null; count: number; lastLoggedAt: Date }
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
        count: 1,
        lastLoggedAt: entry.timestamp,
      });
    }
  }

  let foods = Array.from(byKey.values()).map((f) => ({
    ...f,
    favorite: favoriteKeys.has(f.labelKey),
    tags: tagsByKey.get(f.labelKey) ?? [],
  }));

  if (q) {
    foods = foods.filter((f) => f.label.toLowerCase().includes(q) || f.tags.some((t) => t.toLowerCase().includes(q)));
  }

  foods.sort((a, b) => b.lastLoggedAt.getTime() - a.lastLoggedAt.getTime());

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
  const { labelKey } = parsed.data;

  const candidates = await prisma.entry.findMany({
    where: { matchWeek: { userId: req.userId! } },
    orderBy: { timestamp: "desc" },
    select: { label: true, kcal: true, imageUrl: true },
  });
  const match = candidates.find((e) => normalizeLabel(e.label) === labelKey);
  if (!match) {
    res.status(404).json({ error: "Food not found" });
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
      label: match.label,
      kcal: match.kcal,
      imageUrl: match.imageUrl,
      mealType,
      matchWeekId: matchWeek.id,
    },
  });

  res.status(201).json(entry);
});
