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
  const [user, matchWeeks, entries, exercises, weighIns, favorites, tags, savedMeals, cycles, sleeps, recoveries] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: userId } }),
    prisma.matchWeek.findMany({ where: { userId }, orderBy: { startsAt: "asc" } }),
    prisma.entry.findMany({ where: { matchWeek: { userId } }, orderBy: { timestamp: "asc" } }),
    prisma.exercise.findMany({ where: { matchWeek: { userId } }, orderBy: { timestamp: "asc" } }),
    prisma.weighIn.findMany({ where: { userId }, orderBy: { date: "asc" } }),
    prisma.foodFavorite.findMany({ where: { userId } }),
    prisma.foodTag.findMany({ where: { userId } }),
    prisma.savedMeal.findMany({ where: { userId }, include: { items: true }, orderBy: { name: "asc" } }),
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
    foodFavorites: favorites.map((f) => f.labelKey),
    foodTags: tags.map((t) => ({ labelKey: t.labelKey, tag: t.tag })),
    savedMeals: savedMeals.map((m) => ({
      name: m.name,
      kind: m.kind,
      servings: m.servings,
      items: [...m.items]
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((i) => ({ label: i.label, kcal: i.kcal })),
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
    ["date", "time", "label", "kcal", "meal_type", "source", "raw_input"],
    entries.map((e) => [
      localDayKey(e.timestamp, config.TIMEZONE),
      e.timestamp.toISOString().slice(11, 16),
      e.label,
      e.kcal,
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
        source: z.string().optional(),
      }),
    )
    .optional(),
  weighIns: z.array(z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), weightKg: z.number() })).optional(),
  foodFavorites: z.array(z.string()).optional(),
  foodTags: z.array(z.object({ labelKey: z.string(), tag: z.string() })).optional(),
  savedMeals: z
    .array(
      z.object({
        name: z.string().min(1),
        kind: z.string().optional(),
        servings: z.number().positive().optional(),
        items: z.array(z.object({ label: z.string().min(1), kcal: z.number().int().nullable().optional() })).min(1),
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
  const counts = { entries: 0, weighIns: 0, favorites: 0, tags: 0, savedMeals: 0, skipped: 0 };

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

  for (const m of data.savedMeals ?? []) {
    const kind = m.kind === "recipe" ? "recipe" : "template";
    const servings = kind === "recipe" ? (m.servings ?? 1) : 1;
    const items = m.items.map((it, i) => ({ label: it.label, kcal: it.kcal ?? null, sortOrder: i }));
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
