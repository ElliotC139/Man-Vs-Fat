/**
 * Macro targets and totals.
 *
 * The app deliberately spent its first life as a calorie-only diary, and the
 * estimator prompt still refuses health commentary and guilt-tripping. Macros
 * change what's *counted*, not that stance: this module produces numbers, and
 * nothing here or downstream tells anyone what to think about them.
 *
 * Everything is optional. With macroMode null, every function here returns
 * null and the app behaves exactly as it did before.
 */

export const MACRO_KEYS = ["protein", "carbs", "fat"] as const;
export type MacroKey = (typeof MACRO_KEYS)[number];

export const MACRO_MODES = ["grams", "percent"] as const;
export type MacroMode = (typeof MACRO_MODES)[number];

/**
 * Atwater factors — the conventional kcal per gram used by every food label
 * and nutrition database, which is what makes a percentage target mean the
 * same thing here as it does everywhere else.
 */
export const KCAL_PER_GRAM: Record<MacroKey, number> = {
  protein: 4,
  carbs: 4,
  fat: 9,
};

export interface MacroGrams {
  protein: number;
  carbs: number;
  fat: number;
}

export interface MacroTargetUser {
  dailyCalorieTarget?: number | null;
  macroMode?: string | null;
  proteinTargetG?: number | null;
  carbsTargetG?: number | null;
  fatTargetG?: number | null;
  proteinPct?: number | null;
  carbsPct?: number | null;
  fatPct?: number | null;
}

export interface ResolvedMacroTargets {
  mode: MacroMode;
  grams: MacroGrams;
  /** Percentages, whether stored directly or derived from the gram targets. */
  percent: MacroGrams;
  /** What the three gram targets add up to in kcal. */
  kcalFromMacros: number;
  /** The user's own calorie target, when one is set. */
  calorieTarget: number | null;
}

/**
 * The one place macro targets are turned into grams.
 *
 * In percent mode this needs a calorie target to divide up — without one,
 * "30% protein" has no gram value, so it returns null rather than inventing
 * a denominator. The settings screen says as much before you can save it.
 */
export function resolveMacroTargets(user: MacroTargetUser): ResolvedMacroTargets | null {
  const mode = user.macroMode;
  if (mode !== "grams" && mode !== "percent") return null;

  const calorieTarget = user.dailyCalorieTarget ?? null;

  if (mode === "percent") {
    const pct = {
      protein: user.proteinPct ?? 0,
      carbs: user.carbsPct ?? 0,
      fat: user.fatPct ?? 0,
    };
    if (!calorieTarget || pct.protein + pct.carbs + pct.fat === 0) return null;

    const grams = {
      protein: Math.round((calorieTarget * pct.protein) / 100 / KCAL_PER_GRAM.protein),
      carbs: Math.round((calorieTarget * pct.carbs) / 100 / KCAL_PER_GRAM.carbs),
      fat: Math.round((calorieTarget * pct.fat) / 100 / KCAL_PER_GRAM.fat),
    };
    return { mode, grams, percent: pct, kcalFromMacros: kcalOf(grams), calorieTarget };
  }

  const grams = {
    protein: user.proteinTargetG ?? 0,
    carbs: user.carbsTargetG ?? 0,
    fat: user.fatTargetG ?? 0,
  };
  if (grams.protein + grams.carbs + grams.fat === 0) return null;

  // In gram mode the percentages are reported back as a share of what those
  // grams themselves come to, not of the calorie target — the two can
  // legitimately differ, and showing a share of a number the grams don't add
  // up to would be a lie about the split.
  const kcalFromMacros = kcalOf(grams);
  const percent = kcalFromMacros === 0
    ? { protein: 0, carbs: 0, fat: 0 }
    : {
        protein: Math.round((grams.protein * KCAL_PER_GRAM.protein * 100) / kcalFromMacros),
        carbs: Math.round((grams.carbs * KCAL_PER_GRAM.carbs * 100) / kcalFromMacros),
        fat: Math.round((grams.fat * KCAL_PER_GRAM.fat * 100) / kcalFromMacros),
      };

  return { mode, grams, percent, kcalFromMacros, calorieTarget };
}

/** What a set of gram figures comes to in calories. */
export function kcalOf(grams: MacroGrams): number {
  return Math.round(
    grams.protein * KCAL_PER_GRAM.protein +
      grams.carbs * KCAL_PER_GRAM.carbs +
      grams.fat * KCAL_PER_GRAM.fat,
  );
}

export interface MacroSource {
  proteinG?: number | null;
  carbsG?: number | null;
  fatG?: number | null;
}

export interface MacroTotals extends MacroGrams {
  /**
   * Entries in the set with no macro figures at all — every row logged before
   * macros existed, plus anything the model couldn't break down. The totals
   * above exclude them, so this is what stops the diary presenting a partial
   * sum as a complete one.
   */
  unknownEntries: number;
  /** Entries that did contribute. */
  knownEntries: number;
}

export function sumMacros(entries: MacroSource[]): MacroTotals {
  const totals: MacroTotals = { protein: 0, carbs: 0, fat: 0, unknownEntries: 0, knownEntries: 0 };

  for (const entry of entries) {
    // A row counts as known if it has any macro at all: a black coffee is
    // legitimately 0/0/0, and treating a genuine zero as missing would
    // permanently flag days that are in fact complete.
    const hasAny = entry.proteinG !== null && entry.proteinG !== undefined
      || entry.carbsG !== null && entry.carbsG !== undefined
      || entry.fatG !== null && entry.fatG !== undefined;

    if (!hasAny) {
      totals.unknownEntries += 1;
      continue;
    }
    totals.knownEntries += 1;
    totals.protein += entry.proteinG ?? 0;
    totals.carbs += entry.carbsG ?? 0;
    totals.fat += entry.fatG ?? 0;
  }

  totals.protein = round1(totals.protein);
  totals.carbs = round1(totals.carbs);
  totals.fat = round1(totals.fat);
  return totals;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * Keeps a set of macros physically possible for the calories claimed.
 *
 * A model asked for four numbers at once will occasionally return a
 * 300 kcal item with 90g of protein in it, which is more energy than the
 * item is supposed to contain. Rather than discard the estimate, each macro
 * is capped at what the stated calories could hold — an obviously wrong
 * figure becomes merely an approximate one.
 *
 * Deliberately a cap and not a rescale-to-fit: fibre, alcohol and rounding
 * mean 4/4/9 never reconciles exactly with a label's calories, and forcing
 * it to would introduce error into the many entries that are already fine.
 */
export function clampMacrosToKcal(
  macros: { protein: number | null; carbs: number | null; fat: number | null },
  kcal: number | null,
): { protein: number | null; carbs: number | null; fat: number | null } {
  if (kcal === null || kcal <= 0) return macros;

  const capped = { ...macros };
  for (const key of MACRO_KEYS) {
    const value = capped[key];
    if (value === null) continue;
    const max = kcal / KCAL_PER_GRAM[key];
    capped[key] = Math.max(0, Math.min(value, max));
  }
  return capped;
}

/** Scales a set of macros, used when an entry's quantity changes. */
export function scaleMacros(source: MacroSource, factor: number): MacroSource {
  return {
    proteinG: source.proteinG === null || source.proteinG === undefined ? null : round1(source.proteinG * factor),
    carbsG: source.carbsG === null || source.carbsG === undefined ? null : round1(source.carbsG * factor),
    fatG: source.fatG === null || source.fatG === undefined ? null : round1(source.fatG * factor),
  };
}
