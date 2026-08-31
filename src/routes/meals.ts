import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { config } from "../config";
import { requireAuth } from "../auth";
import { findOrCreateMatchWeek, getLocalParts, getUserWeekStart } from "../matchWeek";
import { MEAL_TYPES, inferMealType, type MealType } from "../mealType";
import { scaleMacros, sumMacros } from "../macros";

export const mealsRouter = Router();
mealsRouter.use(requireAuth);

const KINDS = ["template", "recipe"] as const;

const itemSchema = z.object({
  label: z.string().trim().min(1).max(200),
  kcal: z.number().int().min(0).max(20000).nullable().optional(),
  proteinG: z.number().min(0).max(1000).nullable().optional(),
  carbsG: z.number().min(0).max(1000).nullable().optional(),
  fatG: z.number().min(0).max(1000).nullable().optional(),
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
    select: { label: true, kcal: true, proteinG: true, carbsG: true, fatG: true },
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
          sortOrder: i,
        })),
      },
    },
    include: { items: true },
  });
  res.status(201).json(present(meal));
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
  mealType: z.enum(MEAL_TYPES).optional(),
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

  const timestamp = new Date();
  const weekStart = await getUserWeekStart(req.userId!);
  const matchWeek = await findOrCreateMatchWeek(timestamp, config.TIMEZONE, req.userId!, weekStart);
  const mealType: MealType =
    parsed.data.mealType ?? inferMealType(getLocalParts(timestamp, config.TIMEZONE).hour);

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

          return [{ label: `${meal.name} (${portionLabel})`, kcal, ...perPortion }];
        })()
      : items.map((i) => ({
          label: eaten === 1 ? i.label : `${i.label} (x${round2(eaten)})`,
          kcal: i.kcal === null ? null : Math.round(i.kcal * eaten),
          ...scaleMacros(i, eaten),
        }));

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
          imageUrl: null,
          mealType,
          source: "meal",
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
