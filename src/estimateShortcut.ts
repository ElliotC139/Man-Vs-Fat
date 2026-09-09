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
}

/** Weight units that convert to grams without knowing what the food is. */
const GRAM_FACTORS: Record<string, number> = {
  g: 1, gs: 1, gram: 1, grams: 1,
  kg: 1000, kgs: 1000, kilo: 1000, kilos: 1000, kilogram: 1000, kilograms: 1000,
  oz: 28.3495, ounce: 28.3495, ounces: 28.3495,
  lb: 453.592, lbs: 453.592, pound: 453.592, pounds: 453.592,
};

/**
 * Reads a leading amount off a description.
 *
 * Deliberately only the leading form, and only the two shapes that need no
 * judgement: a weight ("200g chicken") and a bare count ("2 hobnobs").
 * Anything else — a trailing amount, a unit noun, "a couple of" — falls
 * through with no amount stated, which sends it to the model rather than
 * guessing here. Millilitres are absent on purpose: converting volume to
 * weight needs a density, and a density is exactly the kind of thing this
 * function must never invent.
 */
export function readAmount(text: string): StatedAmount {
  const value = text.trim();

  const weight = value.match(/^(\d+(?:[.,]\d+)?)\s*([a-z]+)\s+(.+)$/i);
  if (weight?.[1] && weight[2] && weight[3]) {
    const factor = GRAM_FACTORS[weight[2].toLowerCase()];
    if (factor) {
      return { phrase: weight[3].trim(), count: null, grams: Number(weight[1].replace(",", ".")) * factor };
    }
  }

  // "2 hobnobs", "3 x hobnobs" — a whole number in front and nothing else.
  const count = value.match(/^(\d+)\s*(?:[x×]\s*)?\s+(.+)$/i);
  if (count?.[1] && count[2]) {
    const n = Number(count[1]);
    if (n >= 1 && n <= 100) return { phrase: count[2].trim(), count: n, grams: null };
  }

  return { phrase: value, count: null, grams: null };
}

function times(value: number | null | undefined, factor: number): number | null {
  if (value === null || value === undefined) return null;
  return Math.round(value * factor * 10) / 10;
}

/**
 * Their own past entry for exactly this food, scaled by a stated count.
 *
 * Exact on the normalized label, not a substring: "toast" must not answer for
 * "beans on toast". normalizeLabel already collapses word order, plurals and
 * filler words, so "a bowl of chicken and rice" still finds "chicken and rice".
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

  const n = amount.count ?? 1;
  return {
    label: n === 1 ? best.label : `${n} × ${best.label}`,
    kcal: times(best.kcal, n) === null ? null : Math.round(best.kcal! * n),
    proteinG: times(best.proteinG, n),
    carbsG: times(best.carbsG, n),
    fatG: times(best.fatG, n),
    fibreG: times(best.fibreG, n),
    sugarG: times(best.sugarG, n),
    satFatG: times(best.satFatG, n),
    saltG: times(best.saltG, n),
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
): EstimateItem & { per100?: unknown; grams?: number; quantity?: number; unitLabel?: string | null } | null {
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
