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
 * How to read a gram target. The three macros are rarely wanted the same way
 * round — protein is usually a floor you're trying to clear, carbs or fat a
 * ceiling you're trying to stay under — so each carries its own comparison
 * rather than all three being read as "hit this number".
 *
 * Percent mode is always "eq": percentages have to sum to 100, so "at least
 * 40% protein" can't be satisfied without saying what gives way.
 */
export const MACRO_OPS = ["min", "max", "eq"] as const;
export type MacroOp = (typeof MACRO_OPS)[number];

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

/** One macro's target: a gram figure and how to read it. */
export interface MacroTarget {
  grams: number;
  op: MacroOp;
}

/** Null for a macro that simply isn't tracked — blank in the settings form. */
export type MacroTargetSet = Record<MacroKey, MacroTarget | null>;

export interface MacroTargetUser {
  dailyCalorieTarget?: number | null;
  macroMode?: string | null;
  proteinTargetG?: number | null;
  carbsTargetG?: number | null;
  fatTargetG?: number | null;
  proteinOp?: string | null;
  carbsOp?: string | null;
  fatOp?: string | null;
  proteinPct?: number | null;
  carbsPct?: number | null;
  fatPct?: number | null;
}

export interface ResolvedMacroTargets {
  mode: MacroMode;
  /** Per macro, or null where it isn't being tracked. */
  targets: MacroTargetSet;
  /**
   * What the tracked targets come to in kcal — only meaningful when every one
   * of them is an "about" figure. A floor plus a ceiling doesn't describe a
   * total, so this is null rather than a number that looks like one.
   */
  kcalFromMacros: number | null;
  /** The user's own calorie target, when one is set. */
  calorieTarget: number | null;
}

function readOp(value: unknown): MacroOp {
  // Anything unrecognised — including the null every target set before this
  // column existed carries — reads as "about", which is what those meant.
  return value === "min" || value === "max" ? value : "eq";
}

/**
 * A gram figure that's actually a target. Zero counts as untracked as well as
 * null: a 0g target means nothing, and treating it as one would put a row on
 * the diary that can only ever read "0g over".
 */
function readGrams(value: number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  return value > 0 ? value : null;
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

    const targets: MacroTargetSet = {
      protein: { grams: Math.round((calorieTarget * pct.protein) / 100 / KCAL_PER_GRAM.protein), op: "eq" },
      carbs: { grams: Math.round((calorieTarget * pct.carbs) / 100 / KCAL_PER_GRAM.carbs), op: "eq" },
      fat: { grams: Math.round((calorieTarget * pct.fat) / 100 / KCAL_PER_GRAM.fat), op: "eq" },
    };
    return { mode, targets, kcalFromMacros: kcalOfTargets(targets), calorieTarget };
  }

  const targets: MacroTargetSet = {
    protein: buildTarget(user.proteinTargetG, user.proteinOp),
    carbs: buildTarget(user.carbsTargetG, user.carbsOp),
    fat: buildTarget(user.fatTargetG, user.fatOp),
  };
  // Every macro blank is the same as macros being off.
  if (MACRO_KEYS.every((key) => targets[key] === null)) return null;

  return { mode, targets, kcalFromMacros: kcalOfTargets(targets), calorieTarget };
}

function buildTarget(grams: number | null | undefined, op: unknown): MacroTarget | null {
  const value = readGrams(grams);
  return value === null ? null : { grams: value, op: readOp(op) };
}

/** Only a real total when every tracked macro is an "about" figure. */
function kcalOfTargets(targets: MacroTargetSet): number | null {
  const tracked = MACRO_KEYS.map((key) => targets[key]).filter((t): t is MacroTarget => t !== null);
  if (tracked.length === 0 || tracked.some((t) => t.op !== "eq")) return null;
  return Math.round(
    MACRO_KEYS.reduce((sum, key) => sum + (targets[key]?.grams ?? 0) * KCAL_PER_GRAM[key], 0),
  );
}

/** What a set of gram figures comes to in calories. */
export function kcalOf(grams: MacroGrams): number {
  return Math.round(
    grams.protein * KCAL_PER_GRAM.protein +
      grams.carbs * KCAL_PER_GRAM.carbs +
      grams.fat * KCAL_PER_GRAM.fat,
  );
}

export type MacroVerdict = "under" | "met" | "over";

export interface MacroProgress {
  key: MacroKey;
  target: MacroTarget;
  eaten: number;
  /**
   * "under" — short of a floor, or still inside a ceiling with room to spare.
   * "met"   — a floor cleared, or an "about" figure hit closely enough.
   * "over"  — past a ceiling, or well past an "about" figure.
   *
   * Note that "over" is a warning for a ceiling and a *good* outcome for a
   * floor, which is why the verdict and the colour are decided separately —
   * see `isGood` below.
   */
  verdict: MacroVerdict;
  /** True when the day currently satisfies this target. */
  isGood: boolean;
  /** Grams still to go (positive) or past the figure (negative). */
  remaining: number;
  /** 0-100, for the bar. */
  percentOfTarget: number;
}

/**
 * An "about" target can't mean exactly-to-the-gram — nobody lands a food
 * diary on 200.0g of carbs — so it counts as met inside this margin either
 * side. A floor or a ceiling has a hard edge and doesn't use it.
 */
const EQ_TOLERANCE = 0.05;

/**
 * The single place a macro is judged against its target. The diary mirrors
 * this in JavaScript to render the Today card without a round trip; if the
 * rules here change, that copy has to change with it.
 */
export function macroProgress(key: MacroKey, target: MacroTarget, eaten: number): MacroProgress {
  const remaining = Math.round((target.grams - eaten) * 10) / 10;
  const percentOfTarget = target.grams === 0 ? 0 : Math.max(0, Math.min(100, (eaten / target.grams) * 100));

  let verdict: MacroVerdict;
  let isGood: boolean;

  if (target.op === "min") {
    verdict = eaten >= target.grams ? "met" : "under";
    isGood = verdict === "met";
  } else if (target.op === "max") {
    verdict = eaten > target.grams ? "over" : "under";
    isGood = verdict === "under";
  } else {
    const margin = target.grams * EQ_TOLERANCE;
    if (eaten > target.grams + margin) verdict = "over";
    else if (eaten < target.grams - margin) verdict = "under";
    else verdict = "met";
    isGood = verdict === "met";
  }

  return { key, target, eaten, verdict, isGood, remaining, percentOfTarget };
}

/** Plain-English restatement of a target, used in settings and the PDF. */
export function describeTarget(key: MacroKey, target: MacroTarget): string {
  const name = key === "carbs" ? "carbs" : key;
  const phrase = target.op === "min" ? "at least" : target.op === "max" ? "at most" : "about";
  return `${name} ${phrase} ${target.grams}g`;
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
