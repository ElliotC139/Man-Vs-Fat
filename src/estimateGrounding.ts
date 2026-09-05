/**
 * Real figures for a typed meal, before anything is guessed.
 *
 * Typing a meal used to be pure recall: the model was handed a line of text
 * and asked what it thought that came to. For anything generic that is fine —
 * nobody has a database row for "chicken stir fry". For a named packaged
 * product it is the worst way to get an answer, because the app already knows
 * a better one. "Milkybar White Chocolate Giant Buttons (10 pieces)" is a
 * product with a barcode and a published panel, sitting in the same databases
 * food search has queried all along; the estimate just never looked.
 *
 * So the text path now looks first. Whatever the databases return is passed to
 * the model as reference figures, which turns "how many calories is that?"
 * into arithmetic — grams eaten, times the per-100g figures off the packet.
 *
 * Grounding is a bonus and never a blocker. No match, no key, no network, too
 * slow: the estimate goes ahead exactly as it did before.
 */

import { cacheGet, cacheSet, rankResults, type FoodSearchResult } from "./foodSearch";
import { searchAllProviders } from "./foodSearchProviders";

/** One product's published figures, condensed to what the model can use. */
export interface EstimateReference {
  name: string;
  brand: string | null;
  /** Per 100g, where the source states enough to scale by weight. */
  per100g: { kcal: number; protein: number | null; carbs: number | null; fat: number | null } | null;
  /** One portion as the source describes it, for menu items sold by the plate. */
  portion: { label: string; kcal: number } | null;
  servingGrams: number | null;
}

/**
 * How many rows to hand over.
 *
 * Enough that the right product is among them when the top hit is a variant
 * ("Milkybar Buttons" vs "Milkybar Giant Buttons"), few enough that the model
 * is choosing rather than wading. The prompt tells it to ignore rows that are
 * a different food, so a near-miss costs nothing.
 */
const MAX_REFERENCES = 5;

/**
 * A search nobody is watching can't hold up the thing they are watching.
 *
 * The providers have their own 4s ceiling, which is right for a search box
 * where the results ARE the answer. Here they are a footnote to a model call,
 * so the wait is shorter and running out of it means carrying on without them.
 */
const GROUNDING_TIMEOUT_MS = 2500;

/**
 * Everything a phrase like "(10 pieces)" or "200g" adds to a search query is
 * noise — the databases index products, not portions, and leaving the quantity
 * in pushes the real product down the rankings or off them entirely.
 */
export function groundingQuery(text: string): string {
  return text
    // Parenthesised asides are nearly always the amount: "(10 pieces)".
    .replace(/\([^)]*\)/g, " ")
    // Leading or trailing amounts: "200g chicken", "chicken 200g".
    .replace(/\b\d+(?:[.,]\d+)?\s*(?:mg|g|kg|oz|lb|lbs|ml|cl|l|litres?|liters?|pints?)\b/gi, " ")
    .replace(/\b\d+(?:[.,]\d+)?\s*[x×]\s*/gi, " ")
    // A bare count in front of the food: "10 buttons", "2 slices".
    .replace(/\b\d+(?:[.,]\d+)?\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function condense(result: FoodSearchResult): EstimateReference {
  return {
    name: result.name,
    brand: result.brand,
    per100g: result.per100g
      ? {
          kcal: Math.round(result.per100g.kcal),
          protein: result.per100g.protein,
          carbs: result.per100g.carbs,
          fat: result.per100g.fat,
        }
      : null,
    portion: result.portion ? { label: result.portion.label, kcal: Math.round(result.portion.kcal) } : null,
    servingGrams: result.servingGrams,
  };
}

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(fallback), ms);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch(() => {
        clearTimeout(timer);
        resolve(fallback);
      });
  });
}

/**
 * Reference figures for a typed description, or an empty list.
 *
 * Shares the search cache with the search box, so someone who searched for a
 * product and then typed it costs one round trip rather than two.
 */
export async function findReferences(text: string | undefined): Promise<EstimateReference[]> {
  const query = groundingQuery(text ?? "");
  // One word is not a product name worth a round trip, and the search route
  // holds the same floor.
  if (query.length < 3) return [];

  const cacheKey = query.toLowerCase();
  const cached = cacheGet(cacheKey);
  const results = cached ?? (await withTimeout(searchAllProviders(query), GROUNDING_TIMEOUT_MS, []));
  // Only a real answer is worth caching: a timeout's empty list would
  // otherwise poison the search box for as long as the entry lives.
  if (!cached && results.length > 0) cacheSet(cacheKey, results);

  return rankResults(results, query, MAX_REFERENCES)
    // A row with neither per-100g figures nor a portion says nothing the model
    // can compute from.
    .filter((result) => result.per100g !== null || result.portion !== null)
    .map(condense);
}
