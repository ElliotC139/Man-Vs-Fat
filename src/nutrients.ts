/**
 * The rest of the nutrition label.
 *
 * Protein, carbohydrate and fat are the three things a calorie is made of, and
 * `macros.ts` treats them that way — Atwater factors, percentage splits that
 * have to sum to 100, a cap so a 300 kcal item can't claim 90g of protein.
 *
 * Fibre, sugar, saturated fat and salt are not that. Sugar is part of the
 * carbohydrate figure, saturated fat is part of the fat figure, fibre is a
 * carbohydrate the body largely doesn't get energy from, and salt is not
 * energy at all. Adding them to MACRO_KEYS would have silently broken every
 * one of those calculations — a percentage split summing past 100, calories
 * double-counted, the clamp dividing salt by 9. So they live here instead:
 * always grams, never a percentage, never contributing to a calorie total.
 *
 * Everything is optional in the same way macros are. With nothing configured,
 * every function here returns the defaults and the diary shows exactly the
 * three figures it always has.
 */

export const NUTRIENT_KEYS = ["fibre", "sugar", "satFat", "salt"] as const;
export type NutrientKey = (typeof NUTRIENT_KEYS)[number];

/**
 * Everything the diary can show under an entry, in the order it reads.
 *
 * "netCarbs" is not stored anywhere — it is carbohydrate minus fibre, worked
 * out at display time. It earns a place in this list because choosing to see
 * it is exactly the choice someone eating keto makes, and making them derive
 * it in their head from two other figures would be the whole feature missing.
 */
export const DIARY_FIELDS = [
  "protein",
  "carbs",
  "netCarbs",
  "fat",
  "satFat",
  "fibre",
  "sugar",
  "salt",
] as const;
export type DiaryField = (typeof DIARY_FIELDS)[number];

/** What the diary showed before any of this was a choice. */
export const DEFAULT_DIARY_FIELDS: DiaryField[] = ["protein", "carbs", "fat"];

/** Short labels, as they appear on a row where space is scarce. */
export const FIELD_LABELS: Record<DiaryField, string> = {
  protein: "P",
  carbs: "C",
  netCarbs: "Net C",
  fat: "F",
  satFat: "Sat",
  fibre: "Fib",
  sugar: "Sug",
  salt: "Salt",
};

/** Full names, for settings and anywhere with room to spell it out. */
export const FIELD_NAMES: Record<DiaryField, string> = {
  protein: "Protein",
  carbs: "Carbs",
  netCarbs: "Net carbs",
  fat: "Fat",
  satFat: "Saturated fat",
  fibre: "Fibre",
  sugar: "Sugar",
  salt: "Salt",
};

/**
 * How a nutrient is usually wanted, used as the default comparison when a
 * target is set without one. Fibre is the only one of the four people are
 * trying to reach rather than stay under.
 */
export const DEFAULT_OPS: Record<NutrientKey, "min" | "max"> = {
  fibre: "min",
  sugar: "max",
  satFat: "max",
  salt: "max",
};

export type NutrientOp = "min" | "max" | "eq";

export interface NutrientTarget {
  grams: number;
  op: NutrientOp;
}

export type NutrientTargetSet = Record<NutrientKey, NutrientTarget | null>;

export interface NutrientSource {
  fibreG?: number | null;
  sugarG?: number | null;
  satFatG?: number | null;
  saltG?: number | null;
}

export interface NutrientUser {
  nutrientsShown?: string | null;
  carbMode?: string | null;
  fibreTargetG?: number | null;
  fibreOp?: string | null;
  sugarTargetG?: number | null;
  sugarOp?: string | null;
  satFatTargetG?: number | null;
  satFatOp?: string | null;
  saltTargetG?: number | null;
  saltOp?: string | null;
}

/** The column each nutrient lives in, so callers don't hardcode the mapping. */
export const NUTRIENT_COLUMNS: Record<NutrientKey, keyof Required<NutrientSource>> = {
  fibre: "fibreG",
  sugar: "sugarG",
  satFat: "satFatG",
  salt: "saltG",
};

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * Which figures this account wants under an entry.
 *
 * Anything unrecognised in the stored list is dropped rather than rejected: a
 * field removed in a later version shouldn't stop the rest of someone's choice
 * being honoured. An empty or unreadable list falls back to the default three,
 * because a diary showing no figures at all is a bug, not a preference.
 */
export function readDiaryFields(user: NutrientUser | null | undefined): DiaryField[] {
  const raw = user?.nutrientsShown;
  if (!raw) return [...DEFAULT_DIARY_FIELDS];

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [...DEFAULT_DIARY_FIELDS];
  }
  if (!Array.isArray(parsed)) return [...DEFAULT_DIARY_FIELDS];

  const chosen = DIARY_FIELDS.filter((field) => parsed.includes(field));
  return chosen.length > 0 ? chosen : [...DEFAULT_DIARY_FIELDS];
}

/** Serialises a chosen set back to the column, in the canonical order. */
export function writeDiaryFields(fields: readonly string[]): string {
  const chosen = DIARY_FIELDS.filter((field) => fields.includes(field));
  return JSON.stringify(chosen.length > 0 ? chosen : DEFAULT_DIARY_FIELDS);
}

/**
 * Whether a carb figure means total carbohydrate or carbohydrate minus fibre.
 *
 * Null reads as "total", which is what every entry logged before this existed
 * meant, and what the label on the packet says.
 */
export function isNetCarbs(user: NutrientUser | null | undefined): boolean {
  return user?.carbMode === "net";
}

/**
 * Carbohydrate the body gets energy from: total minus fibre.
 *
 * Null in, null out — with no carb figure there is nothing to subtract from,
 * and an entry with carbs but no fibre figure returns the carbs unchanged
 * rather than assuming zero fibre. That last one matters: guessing zero would
 * make every pre-fibre entry look like pure net carbs, which for a bowl of
 * lentils is badly wrong in the direction that discourages eating them.
 */
export function netCarbsOf(carbsG: number | null | undefined, fibreG: number | null | undefined): number | null {
  if (carbsG === null || carbsG === undefined) return null;
  if (fibreG === null || fibreG === undefined) return round1(carbsG);
  return round1(Math.max(0, carbsG - fibreG));
}

function readOp(value: unknown, fallback: NutrientOp): NutrientOp {
  return value === "min" || value === "max" || value === "eq" ? value : fallback;
}

/**
 * The nutrient targets this account has set, or null per nutrient where it
 * hasn't. Zero counts as untracked for the same reason it does for macros: a
 * 0g target can only ever read "over".
 */
export function resolveNutrientTargets(user: NutrientUser | null | undefined): NutrientTargetSet {
  const read = (grams: number | null | undefined, op: unknown, key: NutrientKey): NutrientTarget | null => {
    if (grams === null || grams === undefined || grams <= 0) return null;
    return { grams, op: readOp(op, DEFAULT_OPS[key]) };
  };

  return {
    fibre: read(user?.fibreTargetG, user?.fibreOp, "fibre"),
    sugar: read(user?.sugarTargetG, user?.sugarOp, "sugar"),
    satFat: read(user?.satFatTargetG, user?.satFatOp, "satFat"),
    salt: read(user?.saltTargetG, user?.saltOp, "salt"),
  };
}

export interface NutrientTotals {
  fibre: number;
  sugar: number;
  satFat: number;
  salt: number;
  /**
   * Entries carrying none of the four — everything logged before these columns
   * existed, plus anything the model couldn't break down. Counted for the same
   * reason the macro totals count theirs: so a partial sum is never presented
   * as a complete one.
   */
  unknownEntries: number;
  knownEntries: number;
}

export function sumNutrients(entries: NutrientSource[]): NutrientTotals {
  const totals: NutrientTotals = {
    fibre: 0,
    sugar: 0,
    satFat: 0,
    salt: 0,
    unknownEntries: 0,
    knownEntries: 0,
  };

  for (const entry of entries) {
    // Any one of the four counts as known: water is legitimately 0/0/0/0, and
    // treating a genuine zero as missing would flag complete days forever.
    const hasAny = NUTRIENT_KEYS.some((key) => {
      const value = entry[NUTRIENT_COLUMNS[key]];
      return value !== null && value !== undefined;
    });

    if (!hasAny) {
      totals.unknownEntries += 1;
      continue;
    }
    totals.knownEntries += 1;
    for (const key of NUTRIENT_KEYS) {
      totals[key] += entry[NUTRIENT_COLUMNS[key]] ?? 0;
    }
  }

  for (const key of NUTRIENT_KEYS) totals[key] = round1(totals[key]);
  return totals;
}

/** Scales the four, used when an entry's quantity changes. */
export function scaleNutrients(source: NutrientSource, factor: number): NutrientSource {
  const scale = (value: number | null | undefined): number | null =>
    value === null || value === undefined ? null : round1(value * factor);

  return {
    fibreG: scale(source.fibreG),
    sugarG: scale(source.sugarG),
    satFatG: scale(source.satFatG),
    saltG: scale(source.saltG),
  };
}

/**
 * Keeps a breakdown from claiming more than the figure it breaks down.
 *
 * Saturated fat is part of the fat total and sugar is part of the carbohydrate
 * total, so neither can exceed its parent — a model asked for eight numbers at
 * once will occasionally return 12g of fat with 20g of it saturated. Same
 * stance as clampMacrosToKcal: cap the impossible figure rather than throw the
 * whole estimate away.
 *
 * Fibre is capped against carbs for the same reason. Salt has no parent and is
 * left alone.
 */
export function clampNutrients(
  nutrients: NutrientSource,
  macros: { carbs: number | null; fat: number | null },
): NutrientSource {
  const capAt = (value: number | null | undefined, ceiling: number | null): number | null => {
    if (value === null || value === undefined) return null;
    if (ceiling === null) return round1(value);
    return round1(Math.max(0, Math.min(value, ceiling)));
  };

  return {
    fibreG: capAt(nutrients.fibreG, macros.carbs),
    sugarG: capAt(nutrients.sugarG, macros.carbs),
    satFatG: capAt(nutrients.satFatG, macros.fat),
    saltG: nutrients.saltG === null || nutrients.saltG === undefined ? null : round1(nutrients.saltG),
  };
}
