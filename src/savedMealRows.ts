/**
 * Turning a saved meal into the rows it becomes.
 *
 * The rule differs by kind, and the difference is the point. A template is a
 * sitting — eggs, bacon, coffee — and logging it puts those three back in the
 * diary as three rows. A recipe is a batch cooked once and eaten over several
 * days, so logging it puts "chilli (2 portions)" in as one row: what went in
 * the diary is the portion, not the ingredient list again.
 *
 * Both abstain the same way. A batch with one un-costed ingredient gives a
 * portion with unknown figures rather than a total quietly missing that
 * ingredient — reporting one would under-count it, silently, every time.
 *
 * Extracted from POST /meals/:id/log because sharing a saved meal has to
 * produce exactly what logging it would (see src/routes/shares.ts). Two copies
 * of this would be two chances for a shared recipe to arrive as something the
 * sender never ate.
 */

import { scaleMacros, sumMacros } from "./macros";
import { scaleNutrients, sumNutrients } from "./nutrients";

export interface SavedMealItemFigures {
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
}

export interface SavedMealRow {
  label: string;
  kcal: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  fibreG: number | null;
  sugarG: number | null;
  satFatG: number | null;
  saltG: number | null;
}

/** Trims float noise off a user-entered portion count (1.5, not 1.5000001). */
export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function savedMealRows(
  meal: { name: string; kind: string; servings: number; items: SavedMealItemFigures[] },
  eaten: number,
): SavedMealRow[] {
  const items = [...meal.items].sort((a, b) => a.sortOrder - b.sortOrder);

  if (meal.kind !== "recipe") {
    return items.map((item) => ({
      label: eaten === 1 ? item.label : `${item.label} (x${round2(eaten)})`,
      kcal: item.kcal === null ? null : Math.round(item.kcal * eaten),
      ...blankFigures(),
      ...scaleMacros(item, eaten),
      ...scaleNutrients(item, eaten),
    }));
  }

  const anyUnknown = items.some((item) => item.kcal === null);
  const total = anyUnknown ? null : items.reduce((sum, item) => sum + (item.kcal ?? 0), 0);
  const share = eaten / meal.servings;

  const macroTotals = sumMacros(items);
  const perPortion = macroTotals.unknownEntries > 0
    ? { proteinG: null, carbsG: null, fatG: null }
    : scaleMacros(
        { proteinG: macroTotals.protein, carbsG: macroTotals.carbs, fatG: macroTotals.fat },
        share,
      );

  const nutrientTotals = sumNutrients(items);
  const nutrientsPerPortion = nutrientTotals.unknownEntries > 0
    ? { fibreG: null, sugarG: null, satFatG: null, saltG: null }
    : scaleNutrients(
        {
          fibreG: nutrientTotals.fibre,
          sugarG: nutrientTotals.sugar,
          satFatG: nutrientTotals.satFat,
          saltG: nutrientTotals.salt,
        },
        share,
      );

  return [{
    label: `${meal.name} (${eaten === 1 ? "1 portion" : `${round2(eaten)} portions`})`,
    kcal: total === null ? null : Math.round(total * share),
    ...blankFigures(),
    ...perPortion,
    ...nutrientsPerPortion,
  }];
}

/** Every figure present and null, so a row is never missing a field. */
function blankFigures() {
  return {
    proteinG: null, carbsG: null, fatG: null,
    fibreG: null, sugarG: null, satFatG: null, saltG: null,
  };
}
