import { Router } from "express";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { prisma } from "../db";
import { config } from "../config";
import { requireAuth } from "../auth";
import { findOrCreateMatchWeek, getLocalParts, getUserWeekStart } from "../matchWeek";
import { MEAL_TYPES, inferMealType, type MealType } from "../mealType";
import { timestampOnLocalDay } from "../entryTiming";
import { scaleMacros, sumMacros } from "../macros";
import { scaleNutrients, sumNutrients } from "../nutrients";
import multer from "multer";
import { estimateRecipeFromPhoto } from "../estimateRecipe";
import { normalizeUploadedImage } from "../lib/imageProcessing";
import { consumeAll, AI_BURST, AI_DAILY } from "../rateLimit";

// Same ceiling as a meal photo: an un-normalized phone original is large.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

export const mealsRouter = Router();
mealsRouter.use(requireAuth);

const KINDS = ["template", "recipe"] as const;

const itemSchema = z.object({
  label: z.string().trim().min(1).max(200),
  kcal: z.number().int().min(0).max(20000).nullable().optional(),
  proteinG: z.number().min(0).max(1000).nullable().optional(),
  carbsG: z.number().min(0).max(1000).nullable().optional(),
  fatG: z.number().min(0).max(1000).nullable().optional(),
  fibreG: z.number().min(0).max(1000).nullable().optional(),
  sugarG: z.number().min(0).max(1000).nullable().optional(),
  satFatG: z.number().min(0).max(100).nullable().optional(),
  saltG: z.number().min(0).max(100).nullable().optional(),
});

const saveSchema = z.object({
  name: z.string().trim().min(1).max(80),
  kind: z.enum(KINDS).default("template"),
  // A template is one sitting by definition, so its servings is forced to 1
  // below regardless of what's sent.
  servings: z.number().positive().max(100).default(1),
  items: z.array(itemSchema).min(1).max(50),
});

/** Shape returned to the client — items plus the two figures it would
 *  otherwise have to recompute on every render. */
function present(meal: {
  id: number;
  name: string;
  kind: string;
  servings: number;
  updatedAt: Date;
  items: {
    id: number;
    label: string;
    kcal: number | null;
    proteinG: number | null;
    carbsG: number | null;
    fatG: number | null;
    fibreG: number | null;
    sugarG: number | null;
    satFatG: number | null;
    saltG: number | null;
    sortOrder: number;
  }[];
}) {
  const items = [...meal.items].sort((a, b) => a.sortOrder - b.sortOrder);
  // A meal with any un-costed item can't honestly claim a total, so it
  // reports null rather than a figure that silently omits an ingredient.
  const anyUnknown = items.some((i) => i.kcal === null);
  const totalKcal = anyUnknown ? null : items.reduce((sum, i) => sum + (i.kcal ?? 0), 0);
  // Same rule applied to the macros, judged separately: a meal can have a
  // complete calorie total while one ingredient's macros were never worked
  // out, and reporting a macro total there would under-count it.
  const macroTotals = sumMacros(items);
  const macrosComplete = macroTotals.unknownEntries === 0;
  return {
    id: meal.id,
    name: meal.name,
    kind: meal.kind,
    servings: meal.servings,
    updatedAt: meal.updatedAt,
    items: items.map((i) => ({
      id: i.id,
      label: i.label,
      kcal: i.kcal,
      proteinG: i.proteinG,
      carbsG: i.carbsG,
      fatG: i.fatG,
      fibreG: i.fibreG,
      sugarG: i.sugarG,
      satFatG: i.satFatG,
      saltG: i.saltG,
    })),
    totalKcal,
    kcalPerServing: totalKcal === null ? null : Math.round(totalKcal / meal.servings),
    macros: macrosComplete
      ? { protein: macroTotals.protein, carbs: macroTotals.carbs, fat: macroTotals.fat }
      : null,
  };
}

mealsRouter.get("/", async (req, res) => {
  const meals = await prisma.savedMeal.findMany({
    where: { userId: req.userId! },
    include: { items: true },
    orderBy: { updatedAt: "desc" },
  });
  res.json(meals.map(present));
});

mealsRouter.post("/", async (req, res) => {
  const parsed = saveSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const { name, kind, items } = parsed.data;
  const servings = kind === "recipe" ? parsed.data.servings : 1;

  const existing = await prisma.savedMeal.findFirst({ where: { userId: req.userId!, name } });
  if (existing) {
    res.status(409).json({ error: "You already have a saved meal with that name." });
    return;
  }

  const meal = await prisma.savedMeal.create({
    data: {
      userId: req.userId!,
      name,
      kind,
      servings,
      items: {
        create: items.map((it, i) => ({
          label: it.label,
          kcal: it.kcal ?? null,
          proteinG: it.proteinG ?? null,
          carbsG: it.carbsG ?? null,
          fatG: it.fatG ?? null,
          fibreG: it.fibreG ?? null,
          sugarG: it.sugarG ?? null,
          satFatG: it.satFatG ?? null,
          saltG: it.saltG ?? null,
          sortOrder: i,
        })),
      },
    },
    include: { items: true },
  });
  res.status(201).json(present(meal));
});

// Builds a saved meal out of entries already in the diary — the path that
// makes this feature worth using, since it turns a meal the user just logged
// item by item into something re-loggable in one tap.
const fromEntriesSchema = z.object({
  name: z.string().trim().min(1).max(80),
  kind: z.enum(KINDS).default("template"),
  servings: z.number().positive().max(100).default(1),
  entryIds: z.array(z.number().int().positive()).min(1).max(50),
});

mealsRouter.post("/from-entries", async (req, res) => {
  const parsed = fromEntriesSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const { name, kind, entryIds } = parsed.data;
  const servings = kind === "recipe" ? parsed.data.servings : 1;

  const entries = await prisma.entry.findMany({
    where: { id: { in: entryIds }, matchWeek: { userId: req.userId! } },
    orderBy: { timestamp: "asc" },
    select: {
      id: true, label: true, kcal: true, proteinG: true, carbsG: true, fatG: true,
      fibreG: true, sugarG: true, satFatG: true, saltG: true,
    },
  });
  if (entries.length === 0) {
    res.status(404).json({ error: "None of those entries were found." });
    return;
  }

  const existing = await prisma.savedMeal.findFirst({ where: { userId: req.userId!, name } });
  if (existing) {
    res.status(409).json({ error: "You already have a saved meal with that name." });
    return;
  }

  const meal = await prisma.savedMeal.create({
    data: {
      userId: req.userId!,
      name,
      kind,
      servings,
      items: {
        create: entries.map((e, i) => ({
          label: e.label,
          kcal: e.kcal,
          proteinG: e.proteinG,
          carbsG: e.carbsG,
          fatG: e.fatG,
          fibreG: e.fibreG,
          sugarG: e.sugarG,
          satFatG: e.satFatG,
          saltG: e.saltG,
          sortOrder: i,
        })),
      },
    },
    include: { items: true },
  });

  // Saying "these four things were one meal" is a statement about the diary as
  // much as about the library, so the rows it was built from now sit together
  // under that name, exactly as they would had the meal been logged in one tap.
  // The name is copied rather than referenced: renaming the saved meal later
  // must not rewrite what the diary says happened, same as logging one.
  if (entries.length > 1) {
    await prisma.entry.updateMany({
      where: { id: { in: entries.map((e) => e.id) } },
      data: { mealGroupId: randomUUID(), mealGroupName: name },
    });
  }

  res.status(201).json(present(meal));
});

/**
 * Reads a recipe out of a photograph, without saving anything.
 *
 * A draft, deliberately: it goes back to the editor the user already knows so
 * they can check the ingredients and the portions before deciding to keep it.
 * Nothing the app guessed should reach their food library unlooked at.
 */
mealsRouter.post("/scan", upload.single("photo"), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: "Add a photo of the recipe." });
    return;
  }

  // Reading a page of a cookbook costs a vision call, so it is metered like
  // every other estimate rather than being a free door into the model.
  const verdict = consumeAll(`ai:${req.userId!}`, [AI_BURST, AI_DAILY]);
  if (!verdict.allowed) {
    res.status(429)
      .set("Retry-After", String(verdict.retryAfterSec))
      .json({ error: "That's a lot of scanning at once — give it a minute and try again." });
    return;
  }

  let photo: { buffer: Buffer; mimeType: "image/jpeg" };
  try {
    photo = await normalizeUploadedImage(req.file.buffer, req.file.mimetype);
  } catch (error) {
    console.error("Recipe photo processing failed:", error);
    res.status(400).json({ error: "Couldn't process that photo — please try a different one." });
    return;
  }

  try {
    const draft = await estimateRecipeFromPhoto(photo.buffer.toString("base64"), photo.mimeType);
    if (draft.items.length === 0) {
      res.status(422).json({ error: "Couldn't find a recipe in that photo — try a clearer shot of the ingredients." });
      return;
    }
    res.json(draft);
  } catch (error) {
    res.status(502).json({ error: error instanceof Error ? error.message : "Couldn't read that photo." });
  }
});

mealsRouter.patch("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const parsed = saveSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const existing = await prisma.savedMeal.findFirst({ where: { id, userId: req.userId! } });
  if (!existing) {
    res.status(404).json({ error: "Saved meal not found" });
    return;
  }

  const kind = parsed.data.kind ?? existing.kind;
  const servings = kind === "recipe" ? (parsed.data.servings ?? existing.servings) : 1;

  // Items are replaced wholesale rather than diffed: the editor sends the
  // full list it's showing, so anything missing from it was deleted.
  const meal = await prisma.$transaction(async (tx) => {
    if (parsed.data.items) {
      await tx.savedMealItem.deleteMany({ where: { savedMealId: id } });
      await tx.savedMealItem.createMany({
        data: parsed.data.items.map((it, i) => ({
          savedMealId: id,
          label: it.label,
          kcal: it.kcal ?? null,
          proteinG: it.proteinG ?? null,
          carbsG: it.carbsG ?? null,
          fatG: it.fatG ?? null,
          fibreG: it.fibreG ?? null,
          sugarG: it.sugarG ?? null,
          satFatG: it.satFatG ?? null,
          saltG: it.saltG ?? null,
          sortOrder: i,
        })),
      });
    }
    return tx.savedMeal.update({
      where: { id },
      data: { name: parsed.data.name ?? existing.name, kind, servings },
      include: { items: true },
    });
  });

  res.json(present(meal));
});

mealsRouter.delete("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const existing = await prisma.savedMeal.findFirst({ where: { id, userId: req.userId! } });
  if (!existing) {
    res.status(404).json({ error: "Saved meal not found" });
    return;
  }
  await prisma.savedMeal.delete({ where: { id } });
  res.status(204).end();
});

const logSchema = z.object({
  // How much of the meal was eaten: portions for a recipe, multiples of the
  // whole thing for a template.
  servings: z.number().positive().max(20).default(1),
  // Null means the user chose no tag; absent means infer from the clock.
  mealType: z.enum(MEAL_TYPES).nullable().optional(),
  // The day being looked at, when that isn't today.
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

mealsRouter.post("/:id/log", async (req, res) => {
  const id = Number(req.params.id);
  const parsed = logSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const eaten = parsed.data.servings;

  const meal = await prisma.savedMeal.findFirst({
    where: { id, userId: req.userId! },
    include: { items: true },
  });
  if (!meal) {
    res.status(404).json({ error: "Saved meal not found" });
    return;
  }

  const timestamp = parsed.data.date
    ? timestampOnLocalDay(parsed.data.date, new Date(), parsed.data.mealType)
    : new Date();
  const weekStart = await getUserWeekStart(req.userId!);
  const matchWeek = await findOrCreateMatchWeek(timestamp, config.TIMEZONE, req.userId!, weekStart);
  const mealType: MealType | null = parsed.data.mealType === undefined
    ? inferMealType(getLocalParts(timestamp, config.TIMEZONE).hour)
    : parsed.data.mealType;
  const mealTypeSet = parsed.data.mealType !== undefined;

  const items = [...meal.items].sort((a, b) => a.sortOrder - b.sortOrder);

  const rows =
    meal.kind === "recipe"
      ? (() => {
          // A recipe collapses to one entry: what went in the diary is
          // "two portions of chilli", not the whole ingredient list again.
          const anyUnknown = items.some((i) => i.kcal === null);
          const total = anyUnknown ? null : items.reduce((sum, i) => sum + (i.kcal ?? 0), 0);
          const kcal = total === null ? null : Math.round((total / meal.servings) * eaten);
          const portionLabel = eaten === 1 ? "1 portion" : `${round2(eaten)} portions`;

          // The macros follow the same rule as the calories: a batch with one
          // un-costed ingredient gives a portion with unknown macros rather
          // than a total quietly missing that ingredient.
          const macroTotals = sumMacros(items);
          const perPortion =
            macroTotals.unknownEntries > 0
              ? { proteinG: null, carbsG: null, fatG: null }
              : scaleMacros(
                  { proteinG: macroTotals.protein, carbsG: macroTotals.carbs, fatG: macroTotals.fat },
                  eaten / meal.servings,
                );

          // The rest of the label divides the same way, and abstains the same
          // way: an ingredient with no fibre figure means the portion's fibre
          // is unknown, not that the batch contained none.
          const nutrientTotals = sumNutrients(items);
          const nutrientsPerPortion =
            nutrientTotals.unknownEntries > 0
              ? { fibreG: null, sugarG: null, satFatG: null, saltG: null }
              : scaleNutrients(
                  {
                    fibreG: nutrientTotals.fibre,
                    sugarG: nutrientTotals.sugar,
                    satFatG: nutrientTotals.satFat,
                    saltG: nutrientTotals.salt,
                  },
                  eaten / meal.servings,
                );

          return [{
            label: `${meal.name} (${portionLabel})`,
            kcal,
            ...perPortion,
            ...nutrientsPerPortion,
          }];
        })()
      : items.map((i) => ({
          label: eaten === 1 ? i.label : `${i.label} (x${round2(eaten)})`,
          kcal: i.kcal === null ? null : Math.round(i.kcal * eaten),
          ...scaleMacros(i, eaten),
          ...scaleNutrients(i, eaten),
        }));

  // Only worth grouping when there is more than one row to group: a recipe
  // already collapses to a single "two portions of chilli" entry, and marking
  // that as a group of one would put a chevron on a row with nothing under it.
  const groupId = rows.length > 1 ? randomUUID() : null;

  const created = await prisma.$transaction(
    rows.map((row) =>
      prisma.entry.create({
        data: {
          timestamp,
          rawInput: null,
          label: row.label,
          kcal: row.kcal,
          proteinG: row.proteinG ?? null,
          carbsG: row.carbsG ?? null,
          fatG: row.fatG ?? null,
          fibreG: row.fibreG ?? null,
          sugarG: row.sugarG ?? null,
          satFatG: row.satFatG ?? null,
          saltG: row.saltG ?? null,
          imageUrl: null,
          mealType,
          mealTypeSet,
          source: "meal",
          mealGroupId: groupId,
          // The name as it was when logged: renaming the saved meal later
          // must not rewrite what the diary says happened.
          mealGroupName: groupId ? meal.name : null,
          matchWeekId: matchWeek.id,
        },
      }),
    ),
  );

  res.status(201).json(created);
});

/** Trims float noise off a user-entered portion count (1.5, not 1.5000001). */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
