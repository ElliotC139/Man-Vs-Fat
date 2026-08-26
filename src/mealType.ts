export const MEAL_TYPES = ["breakfast", "lunch", "dinner", "snack"] as const;
export type MealType = (typeof MEAL_TYPES)[number];

/** Default meal slot from local hour-of-day, used when an entry is first created. */
export function inferMealType(hour: number): MealType {
  if (hour >= 4 && hour < 11) return "breakfast";
  if (hour >= 11 && hour < 15) return "lunch";
  if (hour >= 17 && hour < 22) return "dinner";
  return "snack";
}

/**
 * Representative local hour for each meal slot, inside that slot's
 * inferMealType band. Used when an entry is moved to a different calendar
 * day without an explicit hour, so the match-week boundary (Mon 17:00)
 * recalculates against a time that's actually consistent with the chosen
 * meal — otherwise a moved entry can silently land in the wrong week on a
 * Monday (e.g. "dinner" kept at its original 11:22 submit time is still
 * before the 17:00 cutoff).
 */
export const MEAL_TYPE_DEFAULT_HOUR: Record<MealType, number> = {
  breakfast: 8,
  lunch: 13,
  dinner: 19,
  snack: 21,
};
