/**
 * What the four meal slots are called.
 *
 * The slots themselves are fixed — they are the values already stored on every
 * entry (see mealType.ts), and they stay that way whatever anyone renames
 * them. Only the labels move. That is the whole point: someone who calls the
 * evening meal "tea" gets their word on the screen, and their existing entries
 * are re-labelled rather than orphaned into a fifth slot nobody can filter by.
 */

import { MEAL_TYPES, type MealType } from "./mealType";

export type MealTagNames = Record<MealType, string>;

/** What each slot is called when nobody has said otherwise. */
export const DEFAULT_MEAL_TAG_NAMES: MealTagNames = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
};

const MAX_NAME_LENGTH = 20;

/**
 * Reads the stored JSON into a complete set of names.
 *
 * Every failure mode lands on the defaults for that one slot rather than
 * anywhere near an error: null, unparseable text, the wrong shape, an unknown
 * key, an empty string. A label is not worth failing a request over, and a
 * blank one would leave a button with nothing written on it.
 */
export function readMealTagNames(stored: string | null | undefined): MealTagNames {
  const names = { ...DEFAULT_MEAL_TAG_NAMES };
  if (!stored) return names;

  let parsed: unknown;
  try {
    parsed = JSON.parse(stored);
  } catch {
    return names;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return names;

  for (const slot of MEAL_TYPES) {
    const value = (parsed as Record<string, unknown>)[slot];
    if (typeof value !== "string") continue;
    const trimmed = value.trim().slice(0, MAX_NAME_LENGTH);
    if (trimmed) names[slot] = trimmed;
  }
  return names;
}

/**
 * The other direction, for saving.
 *
 * A name that matches the default is not stored at all, so someone who renames
 * a slot and then changes their mind ends up with a clean row rather than a
 * copy of the defaults frozen at whatever they were on the day.
 */
export function writeMealTagNames(names: Partial<MealTagNames> | null | undefined): string | null {
  if (!names) return null;

  const out: Partial<MealTagNames> = {};
  for (const slot of MEAL_TYPES) {
    const value = names[slot];
    if (typeof value !== "string") continue;
    const trimmed = value.trim().slice(0, MAX_NAME_LENGTH);
    if (trimmed && trimmed !== DEFAULT_MEAL_TAG_NAMES[slot]) out[slot] = trimmed;
  }
  return Object.keys(out).length > 0 ? JSON.stringify(out) : null;
}

/**
 * The tag an entry actually has, as opposed to the slot the clock once guessed.
 *
 * Everything user-facing goes through this: the row on the diary, the grouping
 * on Today, the analysis card. An entry whose slot was never chosen reads as
 * untagged, however confident the guess in the column looks.
 */
export function effectiveMealType(entry: {
  mealType: string | null;
  mealTypeSet?: boolean | null;
}): string | null {
  return entry.mealTypeSet ? entry.mealType : null;
}
