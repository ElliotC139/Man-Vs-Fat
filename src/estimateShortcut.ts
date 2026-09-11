/**
 * The answer the app already has, before it pays for one.
 *
 * Grounding (see estimateGrounding.ts) made the model's answers better by
 * handing it published figures first. This goes one step further and asks
 * whether the model is needed at all. Two cases where it plainly isn't:
 *
 *   - Someone types the name of a meal they have logged before. Their own past
 *     entry is not an approximation of the answer, it IS the answer, at their
 *     own portion, with any correction they have since made to it.
 *   - Someone types the name of a product exactly as a database has it, and
 *     that database states a serving. "Big Mac" has a published figure; asking
 *     a model to recall one is worse and costs money.
 *
 * Everything else — a described meal, several foods at once, an amount that
 * needs a unit weight worked out — still goes to the model, which is what it
 * is good at. The rule throughout is that a shortcut is only taken when it is
 * certainly right, never when it is probably right: a wrong figure logged
 * silently is worse than a model call nobody minded paying for.
 */

import { normalizeLabel } from "./labelKey";
import { isMeasuredByWeight, normalizeUnit, sameUnit } from "./servingUnit";
import type { EstimateItem } from "./estimate";
import type { FoodSearchResult, LibraryRow } from "./foodSearch";

/** What the text said about how much, once it has been read off the front. */
export interface StatedAmount {
  /** The food, with any leading amount removed. */
  phrase: string;
  /** A plain count of whole items — "2 hobnobs" is 2. Null if none was given. */
  count: number | null;
  /** A stated weight in grams — "200g chicken" is 200. Null if none was given. */
  grams: number | null;
  /**
   * The unit the count was in, where the text named one — "2 rashers of bacon"
   * is a count of 2 in "rasher".
   *
   * Null when only a bare number was given ("2 hobnobs"), which is the common
   * case and means the count is in whatever unit the food turns out to be
   * measured in.
   */
  unit: string | null;
}

/** Weight units that convert to grams without knowing what the food is. */
const GRAM_FACTORS: Record<string, number> = {
  g: 1, gs: 1, gram: 1, grams: 1,
  kg: 1000, kgs: 1000, kilo: 1000, kilos: 1000, kilogram: 1000, kilograms: 1000,
  oz: 28.3495, ounce: 28.3495, ounces: 28.3495,
  lb: 453.592, lbs: 453.592, pound: 453.592, pounds: 453.592,
};

/** The most of anything a leading count is believed to mean. */
const MAX_STATED_COUNT = 100;

/**
 * Reads a leading amount off a description.
 *
 * Deliberately only the leading form, and only the shapes that need no
 * judgement: a weight ("200g chicken"), a bare count ("2 hobnobs") and a count
 * in a named unit ("2 rashers of bacon"). Anything else — a trailing amount,
 * "a couple of" — falls through with no amount stated, which sends it to the
 * model rather than guessing here. Millilitres are absent on purpose:
 * converting volume to weight needs a density, and a density is exactly the
 * kind of thing this function must never invent.
 */
export function readAmount(text: string): StatedAmount {
  const value = text.trim();

  const weight = value.match(/^(\d+(?:[.,]\d+)?)\s*([a-z]+)\s+(.+)$/i);
  if (weight?.[1] && weight[2] && weight[3]) {
    const factor = GRAM_FACTORS[weight[2].toLowerCase()];
    if (factor) {
      return { phrase: weight[3].trim(), count: null, unit: null, grams: Number(weight[1].replace(",", ".")) * factor };
    }
  }

  // "2 rashers of bacon", "1 piece of bacon" — a count that names its own unit.
  //
  // The "of" is what makes this safe to read. Without it, "2 chicken breasts"
  // is a count of a food whose name happens to end in a unit word, and picking
  // the unit out of the name is guesswork; with it, the sentence has already
  // said which word is the unit and which is the food. So this deliberately
  // only matches the explicit form, and "2 chicken breasts" falls through to
  // the bare count below exactly as it did before.
  const counted = value.match(/^(\d+(?:[.,]\d+)?)\s+([a-z][a-z-]{1,14})\s+of\s+(.+)$/i);
  if (counted?.[1] && counted[2] && counted[3]) {
    const n = Number(counted[1].replace(",", "."));
    const unit = normalizeUnit(counted[2]);
    // A null unit here is "2 servings of lasagne", which normalizeUnit drops
    // for the same reason it always does — but the count is still real, and a
    // bare multiple of the last portion is exactly what it means.
    if (n > 0 && n <= MAX_STATED_COUNT) {
      return { phrase: counted[3].trim(), count: n, unit, grams: null };
    }
  }

  // "2 hobnobs", "3 x hobnobs" — a whole number in front and nothing else.
  const count = value.match(/^(\d+)\s*(?:[x×]\s*)?\s+(.+)$/i);
  if (count?.[1] && count[2]) {
    const n = Number(count[1]);
    if (n >= 1 && n <= MAX_STATED_COUNT) return { phrase: count[2].trim(), count: n, unit: null, grams: null };
  }

  return { phrase: value, count: null, unit: null, grams: null };
}

function times(value: number | null | undefined, factor: number): number | null {
  if (value === null || value === undefined) return null;
  return Math.round(value * factor * 10) / 10;
}

/**
 * What a bare number in front of a food means, given how that food is measured.
 *
 * A library row is a total for some amount — two rashers, 200 g, one plate —
 * and "2 of it" means different things depending on which. Where the row
 * counts units, the count IS the new quantity: two rashers where the row was
 * two rashers is still two. Where the row is weighed, or has no unit at all,
 * there is nothing to count, so the only reading left is "twice what I had",
 * and the amount scales instead.
 *
 * That second branch is the behaviour this function has always had, and it
 * stays exactly as it was. Only the countable case changes, which is the one
 * that used to log two rashers as two two-rasher servings.
 */
/**
 * Unit words that pin nothing down.
 *
 * "A piece of bacon" and "a rasher of bacon" are the same sentence; "a piece"
 * is just how you say it when you don't know the word. So a generic unit is
 * treated as no unit at all — it agrees with whatever the food is actually
 * counted in, rather than disagreeing with it and sending a question the app
 * can already answer off to the model.
 *
 * "serving" is absent because normalizeUnit has already dropped it by the time
 * anything reaches here, for the same reason it is on this list.
 */
const GENERIC_UNITS = new Set(["piece", "pieces", "portion", "portions", "bit", "bits", "of"]);

function quantityFor(amount: StatedAmount, row: LibraryRow): number | null {
  const rowQuantity = row.quantity && row.quantity > 0 ? row.quantity : 1;
  const n = amount.count;
  if (n === null) return rowQuantity;

  // The text named a real unit and the row is measured in a different one.
  // Nothing here can convert slices to grams, and inventing the conversion is
  // how a silent wrong figure gets into a diary — so the model gets it.
  const statedUnit = amount.unit !== null && !GENERIC_UNITS.has(amount.unit) ? amount.unit : null;
  if (statedUnit !== null && row.unitLabel && !sameUnit(statedUnit, row.unitLabel)) return null;

  if (row.unitLabel && !isMeasuredByWeight(row.unitLabel)) return n;
  return rowQuantity * n;
}

/**
 * Their own past entry for exactly this food, at the amount they asked for.
 *
 * Exact on the normalized label, not a substring: "toast" must not answer for
 * "beans on toast". normalizeLabel already collapses word order, plurals and
 * filler words, so "a bowl of chicken and rice" still finds "chicken and rice".
 *
 * The arithmetic goes through ONE of the food rather than through the whole
 * row, which is the point of the exercise. A row holding 180 kcal for two
 * rashers is 90 kcal of bacon and a 2; asking for one rasher takes the 90, and
 * asking for four takes 360. Before this, the row was just "180 kcal of
 * bacon" and four rashers came back as 720 — the last plate multiplied again,
 * which is only right when the last plate happened to be one of something.
 *
 * A stated weight bails out. A library row is a plate of food someone logged,
 * not a weight — there is no per-100g behind it, so "200g of it" cannot be
 * worked out from it, only guessed at.
 */
export function libraryShortcut(rows: LibraryRow[], amount: StatedAmount): EstimateItem | null {
  if (amount.grams !== null) return null;
  const key = normalizeLabel(amount.phrase);
  if (!key) return null;

  const matches = rows.filter((row) => row.kcal !== null && normalizeLabel(row.label) === key);
  if (matches.length === 0) return null;
  // The one they log most is the one they mean, and its figures are the ones
  // they have had the most chances to correct.
  const best = matches.reduce((a, b) => (b.count > a.count ? b : a));

  const quantity = quantityFor(amount, best);
  if (quantity === null) return null;

  // Divide and multiply in one step. Dividing to a per-unit figure, rounding
  // it, then multiplying back walks the number away from where it started, so
  // asking for the same amount you logged last time would hand back a total
  // one or two kcal off the one you approved.
  const factor = quantity / (best.quantity && best.quantity > 0 ? best.quantity : 1);

  return {
    // The amount lives in the quantity now, so the label names the food and
    // nothing else. It used to read "2 × Bacon", which then went into the
    // diary, came back out through the food library as its own listing, and
    // left you with one row per number of rashers you had ever eaten.
    label: best.label,
    kcal: best.kcal === null ? null : Math.round(best.kcal * factor),
    proteinG: times(best.proteinG, factor),
    carbsG: times(best.carbsG, factor),
    fatG: times(best.fatG, factor),
    fibreG: times(best.fibreG, factor),
    sugarG: times(best.sugarG, factor),
    satFatG: times(best.satFatG, factor),
    saltG: times(best.saltG, factor),
    quantity,
    unitLabel: best.unitLabel ?? null,
  };
}

/**
 * Brand names are full of possessives, and nobody types the apostrophe.
 *
 * normalizeLabel strips punctuation to spaces, which turns "McDonald's" into
 * two words and leaves a stray "s" that "mcdonalds" doesn't produce. Folding
 * the possessive back into the word first makes the two agree. Deliberately
 * only here: the food library groups entries with plain normalizeLabel, and a
 * different key in this file would make it disagree with itself.
 */
function nameKey(value: string): string {
  return normalizeLabel(value.replace(/['’]s\b/gi, "s"));
}

/**
 * True when a database row is the same words that were typed, not merely a
 * product containing them. Brand-and-name is allowed either way round, so
 * "Birds Eye beef burgers" and "beef burgers" both match the same row.
 */
function namesTheSameThing(result: FoodSearchResult, key: string): boolean {
  if (!key) return false;
  const withBrand = nameKey([result.brand, result.name].filter(Boolean).join(" "));
  return nameKey(result.name) === key || withBrand === key;
}

/**
 * A published product, when the text named exactly one and stated an amount
 * the packet can answer.
 *
 * The single-match rule is doing real work: "hobnobs" matching both plain and
 * chocolate Hobnobs is a choice between two different foods, and choosing for
 * someone is how the wrong figure gets logged without anybody noticing. Two
 * candidates means the model, or the search box, gets it.
 */
export function productShortcut(
  results: FoodSearchResult[],
  amount: StatedAmount,
): EstimateItem & { per100?: unknown; grams?: number } | null {
  // A count needs a unit weight — how much one biscuit weighs — which the
  // packet states only sometimes and in prose. That is the model's job.
  if (amount.count !== null) return null;

  const key = nameKey(amount.phrase);
  const matched = results.filter((result) => namesTheSameThing(result, key));
  const product = matched.length === 1 ? matched[0] : undefined;
  if (!product) return null;

  if (amount.grams !== null) {
    if (!product.per100g) return null;
    const factor = amount.grams / 100;
    return {
      label: product.brand ? `${product.brand} ${product.name}` : product.name,
      kcal: Math.round(product.per100g.kcal * factor),
      proteinG: times(product.per100g.protein, factor),
      carbsG: times(product.per100g.carbs, factor),
      fatG: times(product.per100g.fat, factor),
      fibreG: times(product.per100g.fibre, factor),
      sugarG: times(product.per100g.sugar, factor),
      satFatG: times(product.per100g.satFat, factor),
      saltG: times(product.per100g.salt, factor),
      // The confirm sheet rescales off these, so changing the grams there
      // recomputes from the packet rather than from a rounded total.
      per100: product.per100g,
      grams: amount.grams,
      quantity: amount.grams,
      unitLabel: "g",
    };
  }

  // No amount stated: one portion as the source describes it, if it has one.
  if (product.portion) {
    return {
      label: product.brand ? `${product.brand} ${product.name}` : product.name,
      kcal: Math.round(product.portion.kcal),
      proteinG: product.portion.protein,
      carbsG: product.portion.carbs,
      fatG: product.portion.fat,
      fibreG: product.portion.fibre ?? null,
      sugarG: product.portion.sugar ?? null,
      satFatG: product.portion.satFat ?? null,
      saltG: product.portion.salt ?? null,
      quantity: 1,
      unitLabel: product.servingUnit,
    };
  }

  // Or one serving, where the packet says what a serving weighs.
  if (product.per100g && product.servingGrams) {
    const factor = product.servingGrams / 100;
    return {
      label: product.brand ? `${product.brand} ${product.name}` : product.name,
      kcal: Math.round(product.per100g.kcal * factor),
      proteinG: times(product.per100g.protein, factor),
      carbsG: times(product.per100g.carbs, factor),
      fatG: times(product.per100g.fat, factor),
      fibreG: times(product.per100g.fibre, factor),
      sugarG: times(product.per100g.sugar, factor),
      satFatG: times(product.per100g.satFat, factor),
      saltG: times(product.per100g.salt, factor),
      per100: product.per100g,
      grams: product.servingGrams,
      quantity: product.servingGrams,
      unitLabel: "g",
    };
  }

  // Per-100g with no stated serving says nothing about how much was eaten.
  return null;
}
