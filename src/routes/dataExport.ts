import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { prisma } from "../db";
import { config } from "../config";
import { requireAuth } from "../auth";
import { findOrCreateMatchWeek, getUserWeekStart, localDayKey } from "../matchWeek";
import { parseAppleHealthStream, parseHealthExport, type HealthParseResult } from "../healthImport";
import { openZipEntry } from "../lib/zipEntry";

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
  const [
    user,
    matchWeeks,
    entries,
    exercises,
    weighIns,
    favorites,
    overrides,
    tags,
    savedMeals,
    cycles,
    sleeps,
    recoveries,
    measurements,
    dayNotes,
    waterLogs,
  ] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: userId } }),
    prisma.matchWeek.findMany({ where: { userId }, orderBy: { startsAt: "asc" } }),
    prisma.entry.findMany({ where: { matchWeek: { userId } }, orderBy: { timestamp: "asc" } }),
    prisma.exercise.findMany({ where: { matchWeek: { userId } }, orderBy: { timestamp: "asc" } }),
    prisma.weighIn.findMany({ where: { userId }, orderBy: { date: "asc" } }),
    prisma.foodFavorite.findMany({ where: { userId } }),
    prisma.foodOverride.findMany({ where: { userId } }),
    prisma.foodTag.findMany({ where: { userId } }),
    prisma.savedMeal.findMany({ where: { userId }, include: { items: true }, orderBy: { name: "asc" } }),
    prisma.whoopCycle.findMany({ where: { userId }, orderBy: { start: "asc" } }),
    prisma.whoopSleep.findMany({ where: { userId }, orderBy: { start: "asc" } }),
    prisma.whoopRecovery.findMany({ where: { userId }, orderBy: { date: "asc" } }),
    prisma.measurement.findMany({ where: { userId }, orderBy: { date: "asc" } }),
    prisma.dayNote.findMany({ where: { userId }, orderBy: { date: "asc" } }),
    prisma.waterLog.findMany({ where: { userId }, orderBy: { date: "asc" } }),
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
      dailyCalorieTarget: user.dailyCalorieTarget,
      macroMode: user.macroMode,
      proteinTargetG: user.proteinTargetG,
      carbsTargetG: user.carbsTargetG,
      fatTargetG: user.fatTargetG,
      proteinOp: user.proteinOp,
      carbsOp: user.carbsOp,
      fatOp: user.fatOp,
      proteinPct: user.proteinPct,
      carbsPct: user.carbsPct,
      fatPct: user.fatPct,
    },
    matchWeeks: matchWeeks.map((w) => ({ startsAt: w.startsAt.toISOString(), endsAt: w.endsAt.toISOString() })),
    entries: entries.map((e) => ({
      timestamp: e.timestamp.toISOString(),
      label: e.label,
      kcal: e.kcal,
      mealType: e.mealType,
      quantity: e.quantity,
      proteinG: e.proteinG,
      carbsG: e.carbsG,
      fatG: e.fatG,
      rawInput: e.rawInput,
      source: e.source,
      edited: e.edited,
    })),
    exercises: exercises.map((x) => ({
      timestamp: x.timestamp.toISOString(),
      description: x.description,
      kcalBurned: x.kcalBurned,
      fromWhoop: x.whoopWorkoutId !== null,
    })),
    weighIns: weighIns.map((w) => ({ date: w.date, weightKg: w.weightKg })),
    measurements: measurements.map((m) => ({
      date: m.date,
      waistCm: m.waistCm,
      chestCm: m.chestCm,
      hipsCm: m.hipsCm,
      thighCm: m.thighCm,
      armCm: m.armCm,
    })),
    dayNotes: dayNotes.map((n) => ({ date: n.date, note: n.note })),
    waterLogs: waterLogs.map((w) => ({ date: w.date, ml: w.ml })),
    foodFavorites: favorites.map((f) => f.labelKey),
    // Corrections are the user's own work, so an export that left them out
    // would not actually be all their data.
    foodOverrides: overrides.map((o) => ({
      labelKey: o.labelKey,
      label: o.label,
      kcal: o.kcal,
      proteinG: o.proteinG,
      carbsG: o.carbsG,
      fatG: o.fatG,
    })),
    foodTags: tags.map((t) => ({ labelKey: t.labelKey, tag: t.tag })),
    savedMeals: savedMeals.map((m) => ({
      name: m.name,
      kind: m.kind,
      servings: m.servings,
      items: [...m.items]
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((i) => ({
          label: i.label,
          kcal: i.kcal,
          proteinG: i.proteinG,
          carbsG: i.carbsG,
          fatG: i.fatG,
        })),
    })),
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
    ["date", "time", "label", "kcal", "protein_g", "carbs_g", "fat_g", "meal_type", "source", "raw_input"],
    entries.map((e) => [
      localDayKey(e.timestamp, config.TIMEZONE),
      e.timestamp.toISOString().slice(11, 16),
      e.label,
      e.kcal,
      e.proteinG,
      e.carbsG,
      e.fatG,
      e.mealType,
      e.source,
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
      dailyCalorieTarget: z.number().int().nullable().optional(),
      macroMode: z.string().nullable().optional(),
      proteinTargetG: z.number().int().nullable().optional(),
      carbsTargetG: z.number().int().nullable().optional(),
      fatTargetG: z.number().int().nullable().optional(),
      proteinOp: z.string().nullable().optional(),
      carbsOp: z.string().nullable().optional(),
      fatOp: z.string().nullable().optional(),
      proteinPct: z.number().int().nullable().optional(),
      carbsPct: z.number().int().nullable().optional(),
      fatPct: z.number().int().nullable().optional(),
    })
    .optional(),
  entries: z
    .array(
      z.object({
        timestamp: z.string(),
        label: z.string().min(1),
        kcal: z.number().int().nullable().optional(),
        quantity: z.number().positive().optional(),
        proteinG: z.number().nullable().optional(),
        carbsG: z.number().nullable().optional(),
        fatG: z.number().nullable().optional(),
        mealType: z.string().optional(),
        rawInput: z.string().nullable().optional(),
        source: z.string().optional(),
      }),
    )
    .optional(),
  weighIns: z.array(z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), weightKg: z.number() })).optional(),
  measurements: z
    .array(
      z.object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        waistCm: z.number().nullable().optional(),
        chestCm: z.number().nullable().optional(),
        hipsCm: z.number().nullable().optional(),
        thighCm: z.number().nullable().optional(),
        armCm: z.number().nullable().optional(),
      }),
    )
    .optional(),
  dayNotes: z.array(z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), note: z.string() })).optional(),
  waterLogs: z.array(z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), ml: z.number().int() })).optional(),
  foodFavorites: z.array(z.string()).optional(),
  foodOverrides: z
    .array(
      z.object({
        labelKey: z.string().min(1),
        label: z.string().min(1),
        kcal: z.number().int().nullable().optional(),
        proteinG: z.number().nullable().optional(),
        carbsG: z.number().nullable().optional(),
        fatG: z.number().nullable().optional(),
      }),
    )
    .optional(),
  foodTags: z.array(z.object({ labelKey: z.string(), tag: z.string() })).optional(),
  savedMeals: z
    .array(
      z.object({
        name: z.string().min(1),
        kind: z.string().optional(),
        servings: z.number().positive().optional(),
        items: z
          .array(
            z.object({
              label: z.string().min(1),
              kcal: z.number().int().nullable().optional(),
              proteinG: z.number().nullable().optional(),
              carbsG: z.number().nullable().optional(),
              fatG: z.number().nullable().optional(),
            }),
          )
          .min(1),
      }),
    )
    .optional(),
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
  const counts = {
    entries: 0,
    weighIns: 0,
    measurements: 0,
    dayNotes: 0,
    waterLogs: 0,
    favorites: 0,
    tags: 0,
    savedMeals: 0,
    skipped: 0,
  };

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
        ...(p.dailyCalorieTarget !== undefined ? { dailyCalorieTarget: p.dailyCalorieTarget } : {}),
        ...(p.macroMode !== undefined ? { macroMode: p.macroMode } : {}),
        ...(p.proteinTargetG !== undefined ? { proteinTargetG: p.proteinTargetG } : {}),
        ...(p.carbsTargetG !== undefined ? { carbsTargetG: p.carbsTargetG } : {}),
        ...(p.fatTargetG !== undefined ? { fatTargetG: p.fatTargetG } : {}),
        ...(p.proteinOp !== undefined ? { proteinOp: p.proteinOp } : {}),
        ...(p.carbsOp !== undefined ? { carbsOp: p.carbsOp } : {}),
        ...(p.fatOp !== undefined ? { fatOp: p.fatOp } : {}),
        ...(p.proteinPct !== undefined ? { proteinPct: p.proteinPct } : {}),
        ...(p.carbsPct !== undefined ? { carbsPct: p.carbsPct } : {}),
        ...(p.fatPct !== undefined ? { fatPct: p.fatPct } : {}),
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

  // Same upsert-on-the-day rule as weigh-ins: re-importing an export you
  // already imported corrects the rows rather than duplicating them.
  for (const m of data.measurements ?? []) {
    const { date, ...values } = m;
    await prisma.measurement.upsert({
      where: { userId_date: { userId, date } },
      update: values,
      create: { userId, date, ...values },
    });
    counts.measurements += 1;
  }

  for (const n of data.dayNotes ?? []) {
    await prisma.dayNote.upsert({
      where: { userId_date: { userId, date: n.date } },
      update: { note: n.note },
      create: { userId, date: n.date, note: n.note },
    });
    counts.dayNotes += 1;
  }

  for (const w of data.waterLogs ?? []) {
    await prisma.waterLog.upsert({
      where: { userId_date: { userId, date: w.date } },
      update: { ml: w.ml },
      create: { userId, date: w.date, ml: w.ml },
    });
    counts.waterLogs += 1;
  }

  for (const key of data.foodFavorites ?? []) {
    await prisma.foodFavorite.upsert({
      where: { userId_labelKey: { userId, labelKey: key } },
      update: {},
      create: { userId, labelKey: key },
    });
    counts.favorites += 1;
  }

  for (const fix of data.foodOverrides ?? []) {
    const fields = {
      label: fix.label,
      kcal: fix.kcal ?? null,
      proteinG: fix.proteinG ?? null,
      carbsG: fix.carbsG ?? null,
      fatG: fix.fatG ?? null,
    };
    await prisma.foodOverride.upsert({
      where: { userId_labelKey: { userId, labelKey: fix.labelKey } },
      update: fields,
      create: { userId, labelKey: fix.labelKey, ...fields },
    });
  }

  for (const t of data.foodTags ?? []) {
    await prisma.foodTag.upsert({
      where: { userId_labelKey_tag: { userId, labelKey: t.labelKey, tag: t.tag } },
      update: {},
      create: { userId, labelKey: t.labelKey, tag: t.tag },
    });
    counts.tags += 1;
  }

  for (const m of data.savedMeals ?? []) {
    const kind = m.kind === "recipe" ? "recipe" : "template";
    const servings = kind === "recipe" ? (m.servings ?? 1) : 1;
    const items = m.items.map((it, i) => ({
      label: it.label,
      kcal: it.kcal ?? null,
      proteinG: it.proteinG ?? null,
      carbsG: it.carbsG ?? null,
      fatG: it.fatG ?? null,
      sortOrder: i,
    }));
    // Name is the natural key here (it's unique per user), so importing the
    // same file twice rewrites the meal rather than making a second copy.
    const existing = await prisma.savedMeal.findFirst({ where: { userId, name: m.name }, select: { id: true } });
    if (existing) {
      await prisma.savedMealItem.deleteMany({ where: { savedMealId: existing.id } });
      await prisma.savedMeal.update({
        where: { id: existing.id },
        data: { kind, servings, items: { create: items } },
      });
    } else {
      await prisma.savedMeal.create({ data: { userId, name: m.name, kind, servings, items: { create: items } } });
    }
    counts.savedMeals += 1;
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
          quantity: e.quantity ?? 1,
          proteinG: e.proteinG ?? null,
          carbsG: e.carbsG ?? null,
          fatG: e.fatG ?? null,
          mealType: e.mealType ?? "snack",
          rawInput: e.rawInput ?? null,
          source: e.source ?? "ai",
          matchWeekId: matchWeek.id,
        },
      });
      counts.entries += 1;
    }
  }

  res.json({ imported: counts });
});


/**
 * Weight history out of a phone's health app.
 *
 * Neither Apple HealthKit nor Android's Health Connect has a web API — both
 * are native-only, and no amount of installing this to a home screen changes
 * that. What a browser *can* do is read the export file those apps already
 * produce, so that's what this accepts: an Apple Health export (the zip, or
 * the export.xml out of it) or a CSV from Health Connect, a smart scale, or
 * anything else with a date and a weight column.
 */
const healthUpload = multer({
  storage: multer.memoryStorage(),
  // An Apple export covering several years is mostly heart-rate samples and
  // gets large. This is generous for the zip while still bounding what one
  // request can ask the server to hold.
  limits: { fileSize: 120 * 1024 * 1024 },
});

dataRouter.post("/import/health", healthUpload.single("file"), async (req, res) => {
  const file = req.file;
  if (!file) {
    res.status(400).json({ error: "Choose an export file first." });
    return;
  }

  let parsed: HealthParseResult;
  try {
    // A zip starts "PK\x03\x04". Sniffing the bytes rather than trusting the
    // file name, since iOS shares the export under all sorts of names.
    const isZip = file.buffer.length > 4 && file.buffer.readUInt32LE(0) === 0x04034b50;
    if (isZip) {
      const entry = openZipEntry(file.buffer, (name) => name.endsWith("export.xml"));
      if (!entry) {
        res.status(400).json({ error: "That zip doesn't contain an export.xml — is it an Apple Health export?" });
        return;
      }
      // Streamed rather than buffered: the XML inside routinely unpacks to
      // hundreds of megabytes.
      parsed = await parseAppleHealthStream(entry);
    } else {
      const text = file.buffer.toString("utf8");
      // The JSON restore field sits directly above this one, so putting a
      // food-diary export in the wrong box is an easy mistake — worth naming
      // rather than reporting as a malformed CSV.
      if (text.trimStart().startsWith("{")) {
        res.status(400).json({
          error: "That's a food diary backup — use \u201cRestore from a JSON export\u201d above for it.",
        });
        return;
      }
      parsed = parseHealthExport(text);
    }
  } catch (error) {
    console.error("Health import parse failed:", error);
    res.status(400).json({ error: "Couldn't read that file — please check it's an unmodified export." });
    return;
  }

  if (parsed.weighIns.length === 0) {
    res.status(422).json({
      error:
        parsed.format === "apple-health"
          ? "No weight readings in that export — Apple Health only has them if something has been writing weight to it."
          : "Couldn't find a date column and a weight column in that CSV.",
      skipped: parsed.skipped,
    });
    return;
  }

  const userId = req.userId!;
  const today = localDayKey(new Date(), config.TIMEZONE);
  let imported = 0;
  let skipped = parsed.skipped;

  for (const weighIn of parsed.weighIns) {
    // A future date is a timezone artefact or a bad row, not a weigh-in.
    if (weighIn.date > today) {
      skipped += 1;
      continue;
    }
    await prisma.weighIn.upsert({
      where: { userId_date: { userId, date: weighIn.date } },
      update: { weightKg: weighIn.weightKg },
      create: { userId, date: weighIn.date, weightKg: weighIn.weightKg },
    });
    imported += 1;
  }

  res.json({
    imported,
    skipped,
    format: parsed.format,
    firstDate: parsed.weighIns[0]?.date ?? null,
    lastDate: parsed.weighIns[parsed.weighIns.length - 1]?.date ?? null,
  });
});
