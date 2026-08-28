import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { config } from "../config";
import { requireAuth } from "../auth";
import { findOrCreateMatchWeek, getUserWeekStart, localDayKey } from "../matchWeek";

/**
 * Data portability. Everything a user has put in, back out again in a form
 * they own — and back in, so the export isn't a dead end.
 *
 * WHOOP-derived rows are deliberately not re-importable: they're a mirror of
 * WHOOP's own records, keyed by WHOOP's ids, and re-inserting them from a
 * file would create rows that the next sync can't reconcile. They're included
 * in the export for completeness, and reconnecting WHOOP restores them.
 */
export const dataRouter = Router();
dataRouter.use(requireAuth);

const EXPORT_VERSION = 1;

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(headers: string[], rows: unknown[][]): string {
  return [headers.join(","), ...rows.map((r) => r.map(csvCell).join(","))].join("\n");
}

async function collectExport(userId: number) {
  const [user, matchWeeks, entries, exercises, weighIns, favorites, tags, cycles, sleeps, recoveries] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: userId } }),
    prisma.matchWeek.findMany({ where: { userId }, orderBy: { startsAt: "asc" } }),
    prisma.entry.findMany({ where: { matchWeek: { userId } }, orderBy: { timestamp: "asc" } }),
    prisma.exercise.findMany({ where: { matchWeek: { userId } }, orderBy: { timestamp: "asc" } }),
    prisma.weighIn.findMany({ where: { userId }, orderBy: { date: "asc" } }),
    prisma.foodFavorite.findMany({ where: { userId } }),
    prisma.foodTag.findMany({ where: { userId } }),
    prisma.whoopCycle.findMany({ where: { userId }, orderBy: { start: "asc" } }),
    prisma.whoopSleep.findMany({ where: { userId }, orderBy: { start: "asc" } }),
    prisma.whoopRecovery.findMany({ where: { userId }, orderBy: { date: "asc" } }),
  ]);

  return {
    exportVersion: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    timezone: config.TIMEZONE,
    profile: {
      username: user.username,
      weekStartWeekday: user.weekStartWeekday,
      weekStartHour: user.weekStartHour,
      weekStartMinute: user.weekStartMinute,
      weightKg: user.weightKg,
      heightCm: user.heightCm,
      ageYears: user.ageYears,
      activityLevel: user.activityLevel,
      weeklyGoalKg: user.weeklyGoalKg,
      goalWeightKg: user.goalWeightKg,
    },
    matchWeeks: matchWeeks.map((w) => ({ startsAt: w.startsAt.toISOString(), endsAt: w.endsAt.toISOString() })),
    entries: entries.map((e) => ({
      timestamp: e.timestamp.toISOString(),
      label: e.label,
      kcal: e.kcal,
      mealType: e.mealType,
      rawInput: e.rawInput,
      edited: e.edited,
    })),
    exercises: exercises.map((x) => ({
      timestamp: x.timestamp.toISOString(),
      description: x.description,
      kcalBurned: x.kcalBurned,
      fromWhoop: x.whoopWorkoutId !== null,
    })),
    weighIns: weighIns.map((w) => ({ date: w.date, weightKg: w.weightKg })),
    foodFavorites: favorites.map((f) => f.labelKey),
    foodTags: tags.map((t) => ({ labelKey: t.labelKey, tag: t.tag })),
    // Read-only mirror of WHOOP's data — see the note at the top of the file.
    whoop: {
      cycles: cycles.map((c) => ({ start: c.start.toISOString(), end: c.end?.toISOString() ?? null, kcalBurned: c.kcalBurned })),
      sleeps: sleeps.map((s) => ({
        start: s.start.toISOString(),
        end: s.end.toISOString(),
        performancePercent: s.performancePercent,
        timeAsleepMin: s.timeAsleepMin,
      })),
      recoveries: recoveries.map((r) => ({ date: r.date, recoveryScore: r.recoveryScore, restingHeartRate: r.restingHeartRate })),
    },
  };
}

dataRouter.get("/export.json", async (req, res) => {
  const data = await collectExport(req.userId!);
  const stamp = localDayKey(new Date(), config.TIMEZONE);
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="food-diary-export-${stamp}.json"`);
  res.send(JSON.stringify(data, null, 2));
});

dataRouter.get("/export/entries.csv", async (req, res) => {
  const entries = await prisma.entry.findMany({ where: { matchWeek: { userId: req.userId! } }, orderBy: { timestamp: "asc" } });
  const csv = toCsv(
    ["date", "time", "label", "kcal", "meal_type", "raw_input"],
    entries.map((e) => [
      localDayKey(e.timestamp, config.TIMEZONE),
      e.timestamp.toISOString().slice(11, 16),
      e.label,
      e.kcal,
      e.mealType,
      e.rawInput,
    ]),
  );
  const stamp = localDayKey(new Date(), config.TIMEZONE);
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="food-diary-entries-${stamp}.csv"`);
  res.send(csv);
});

dataRouter.get("/export/weigh-ins.csv", async (req, res) => {
  const weighIns = await prisma.weighIn.findMany({ where: { userId: req.userId! }, orderBy: { date: "asc" } });
  const csv = toCsv(["date", "weight_kg"], weighIns.map((w) => [w.date, w.weightKg]));
  const stamp = localDayKey(new Date(), config.TIMEZONE);
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="food-diary-weigh-ins-${stamp}.csv"`);
  res.send(csv);
});

const importSchema = z.object({
  exportVersion: z.number().int().optional(),
  profile: z
    .object({
      weightKg: z.number().nullable().optional(),
      heightCm: z.number().nullable().optional(),
      ageYears: z.number().int().nullable().optional(),
      activityLevel: z.string().nullable().optional(),
      weeklyGoalKg: z.number().nullable().optional(),
      goalWeightKg: z.number().nullable().optional(),
    })
    .optional(),
  entries: z
    .array(
      z.object({
        timestamp: z.string(),
        label: z.string().min(1),
        kcal: z.number().int().nullable().optional(),
        mealType: z.string().optional(),
        rawInput: z.string().nullable().optional(),
      }),
    )
    .optional(),
  weighIns: z.array(z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), weightKg: z.number() })).optional(),
  foodFavorites: z.array(z.string()).optional(),
  foodTags: z.array(z.object({ labelKey: z.string(), tag: z.string() })).optional(),
});

/**
 * Merges an export back in. Weigh-ins, favourites and tags are upserted on
 * their natural keys, so re-importing the same file twice is a no-op rather
 * than a duplicate. Entries have no natural key, so they're matched on
 * timestamp+label to keep a repeat import from doubling every meal.
 */
dataRouter.post("/import", async (req, res) => {
  const parsed = importSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "That doesn't look like a food diary export file." });
    return;
  }
  const userId = req.userId!;
  const data = parsed.data;
  const counts = { entries: 0, weighIns: 0, favorites: 0, tags: 0, skipped: 0 };

  if (data.profile) {
    const p = data.profile;
    await prisma.user.update({
      where: { id: userId },
      data: {
        ...(p.weightKg !== undefined ? { weightKg: p.weightKg } : {}),
        ...(p.heightCm !== undefined ? { heightCm: p.heightCm } : {}),
        ...(p.ageYears !== undefined ? { ageYears: p.ageYears } : {}),
        ...(p.activityLevel !== undefined ? { activityLevel: p.activityLevel } : {}),
        ...(p.weeklyGoalKg !== undefined ? { weeklyGoalKg: p.weeklyGoalKg } : {}),
        ...(p.goalWeightKg !== undefined ? { goalWeightKg: p.goalWeightKg } : {}),
      },
    });
  }

  for (const w of data.weighIns ?? []) {
    await prisma.weighIn.upsert({
      where: { userId_date: { userId, date: w.date } },
      update: { weightKg: w.weightKg },
      create: { userId, date: w.date, weightKg: w.weightKg },
    });
    counts.weighIns += 1;
  }

  for (const key of data.foodFavorites ?? []) {
    await prisma.foodFavorite.upsert({
      where: { userId_labelKey: { userId, labelKey: key } },
      update: {},
      create: { userId, labelKey: key },
    });
    counts.favorites += 1;
  }

  for (const t of data.foodTags ?? []) {
    await prisma.foodTag.upsert({
      where: { userId_labelKey_tag: { userId, labelKey: t.labelKey, tag: t.tag } },
      update: {},
      create: { userId, labelKey: t.labelKey, tag: t.tag },
    });
    counts.tags += 1;
  }

  if (data.entries?.length) {
    const weekStart = await getUserWeekStart(userId);
    for (const e of data.entries) {
      const timestamp = new Date(e.timestamp);
      if (Number.isNaN(timestamp.getTime())) {
        counts.skipped += 1;
        continue;
      }
      const existing = await prisma.entry.findFirst({
        where: { matchWeek: { userId }, timestamp, label: e.label },
        select: { id: true },
      });
      if (existing) {
        counts.skipped += 1;
        continue;
      }
      const matchWeek = await findOrCreateMatchWeek(timestamp, config.TIMEZONE, userId, weekStart);
      await prisma.entry.create({
        data: {
          timestamp,
          label: e.label,
          kcal: e.kcal ?? null,
          mealType: e.mealType ?? "snack",
          rawInput: e.rawInput ?? null,
          matchWeekId: matchWeek.id,
        },
      });
      counts.entries += 1;
    }
  }

  res.json({ imported: counts });
});
