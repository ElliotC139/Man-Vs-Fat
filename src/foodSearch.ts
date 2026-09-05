/**
 * Food search.
 *
 * This used to be one call from the browser straight to Open Food Facts's
 * legacy search endpoint, unsorted and unidentified. That is most of why
 * "the database doesn't have it": Open Food Facts is packaged groceries only —
 * no roast chicken, no jacket potato, no pint of lager, and nothing off a pub
 * menu — and without a sort the twenty results that came back were an
 * arbitrary twenty out of thousands rather than the ones people actually buy.
 *
 * So search moved here, where it can:
 *
 *   - ask several databases at once and merge them, each covering what the
 *     others don't;
 *   - put the user's own foods first, because the thing you ate last Tuesday
 *     is a better answer than anything a database can offer;
 *   - identify itself to Open Food Facts, which asks callers to and throttles
 *     those that don't;
 *   - sort by how often a product is actually scanned, so the Hobnobs come
 *     back before an obscure re-import of them;
 *   - cache, so the same search twice costs one round trip.
 *
 * Every remote source is optional and independently wrapped: a provider that
 * is unconfigured, down, or has changed its response shape drops out of the
 * results and the rest of the search still answers.
 */

import { normalizeLabel } from "./labelKey";

export type FoodSource = "library" | "off" | "nutritionix" | "usda";

/**
 * What kind of thing this is, which is what the user is really choosing
 * between: something they've had before, a packet, a menu item, or a plain
 * ingredient.
 */
export type FoodKind = "yours" | "branded" | "restaurant" | "generic";

export interface FoodMacros {
  protein: number | null;
  carbs: number | null;
  fat: number | null;
}

export interface FoodSearchResult {
  id: string;
  source: FoodSource;
  kind: FoodKind;
  name: string;
  /** Brand for a packet, restaurant for a menu item. */
  brand: string | null;
  barcode: string | null;
  /**
   * Figures per 100g, for anything that can honestly be scaled by weight.
   * Null for a menu item sold as one portion with no stated weight — those
   * carry `portion` instead and are logged as one of them.
   */
  per100g: (FoodMacros & { kcal: number }) | null;
  /** A sensible default serving in grams, where the source states one. */
  servingGrams: number | null;
  /**
   * One serving in the source's own words — "15 pieces (30 g)", "2 biscuits".
   *
   * Kept as text rather than reduced to grams because for anything sold in
   * countable units the packet's own "N pieces = 1 serving" is the fact that
   * makes a stated count computable: 10 of 15 pieces is two thirds of a
   * serving, no unit weight guessed anywhere.
   */
  servingLabel: string | null;
  /** One portion as the source describes it, when that's the honest unit. */
  portion: (FoodMacros & { kcal: number; label: string }) | null;
  /** Set for the user's own foods — what POST /api/foods/log wants. */
  labelKey: string | null;
  /** How many times they've logged it. Only meaningful for their own foods. */
  timesLogged: number;
}

// ── Ranking ────────────────────────────────────────────────────────────────

/**
 * Ordering is a stated preference, not a relevance score.
 *
 * Their own foods come first because they are already the right answer at the
 * right figures. After that it's how well the name matches what was typed —
 * an exact match, then a word-start match, then a match anywhere — because a
 * search for "hobnob" wanting "Hobnobs" should not be beaten by "Chocolate
 * Hobnob Flapjack Bites" just because that product is more popular.
 */
const SOURCE_RANK: Record<FoodSource, number> = { library: 0, nutritionix: 1, off: 2, usda: 3 };

export function scoreResult(result: FoodSearchResult, query: string): number {
  const q = query.trim().toLowerCase();
  const name = result.name.toLowerCase();
  const full = [result.brand, result.name].filter(Boolean).join(" ").toLowerCase();

  let score = 0;
  if (result.kind === "yours") score += 1000;
  if (name === q || full === q) score += 200;
  else if (name.startsWith(q) || full.startsWith(q)) score += 120;
  else if (new RegExp(`\\b${escapeRegExp(q)}`).test(full)) score += 60;
  else if (full.includes(q)) score += 20;

  // A shorter name that still matches is usually the plain version of the
  // thing rather than a variant of it.
  score += Math.max(0, 30 - name.length / 4);
  // Complete macros make an item more useful, and the "what still fits" card
  // can only use foods that have them.
  const macros = result.per100g ?? result.portion;
  if (macros && macros.protein !== null && macros.carbs !== null && macros.fat !== null) score += 15;
  score += Math.min(20, result.timesLogged * 4);
  score -= SOURCE_RANK[result.source] * 5;

  return score;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Drops the same food arriving twice from two databases. Matched on barcode
 * first — that's an identity, not a guess — then on the normalized brand and
 * name, using the same grouping the food library uses so "Greek Yoghurt" and
 * "greek yoghurts" don't both take a row. The better-ranked copy is the one
 * that survives.
 */
export function dedupeResults(results: FoodSearchResult[]): FoodSearchResult[] {
  const seen = new Map<string, FoodSearchResult>();
  for (const result of results) {
    const key = result.barcode
      ? `barcode:${result.barcode}`
      : `name:${normalizeLabel([result.brand, result.name].filter(Boolean).join(" "))}`;
    if (!key || key === "name:") continue;
    if (!seen.has(key)) seen.set(key, result);
  }
  return [...seen.values()];
}

export function rankResults(results: FoodSearchResult[], query: string, limit: number): FoodSearchResult[] {
  const scored = results.map((result) => ({ result, score: scoreResult(result, query) }));
  scored.sort((a, b) => b.score - a.score);
  return dedupeResults(scored.map((s) => s.result)).slice(0, limit);
}

// ── Parsers ────────────────────────────────────────────────────────────────
//
// Kept apart from the fetching so each one can be tested against a recorded
// response without a network. Every field is treated as possibly absent or the
// wrong type: these are third-party payloads, and a shape change should cost
// one result rather than the whole search.

function num(value: unknown): number | null {
  const n = typeof value === "string" ? Number(value) : typeof value === "number" ? value : NaN;
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/**
 * A row from a third-party list, or null if it isn't an object at all. Arrays
 * from these APIs have been seen carrying nulls, and one bad element should
 * cost one result rather than the whole search.
 */
function row(value: unknown): Record<string, any> | null {
  return value !== null && typeof value === "object" ? (value as Record<string, any>) : null;
}

/** One barcode's worth of Open Food Facts, from its single-product endpoint. */
export function parseOffProduct(payload: unknown, barcode: string): FoodSearchResult | null {
  const data = (payload ?? {}) as Record<string, any>;
  if (data.status !== 1 && !data.product) return null;
  const wrapped = { products: [data.product] };
  const [result] = parseOffProducts(wrapped);
  if (!result) return null;
  return { ...result, id: `off:${barcode}`, barcode };
}

/** Open Food Facts — packaged groceries, worldwide, keyed by barcode. */
export function parseOffProducts(payload: unknown): FoodSearchResult[] {
  const products = (payload as { products?: unknown[] })?.products;
  if (!Array.isArray(products)) return [];

  const out: FoodSearchResult[] = [];
  for (const raw of products) {
    const p = row(raw);
    if (!p) continue;
    const name = text(p.product_name);
    const nutriments = (p.nutriments ?? {}) as Record<string, unknown>;
    const kcal = num(nutriments["energy-kcal_100g"] ?? nutriments["energy-kcal"]);
    // Without a name there is nothing to show, and without calories there is
    // nothing to log — either way the row would only waste a tap.
    if (!name || kcal === null) continue;

    out.push({
      id: `off:${text(p.code) ?? name}`,
      source: "off",
      kind: "branded",
      name,
      brand: text(p.brands),
      barcode: text(p.code),
      per100g: {
        kcal,
        protein: num(nutriments["proteins_100g"]),
        carbs: num(nutriments["carbohydrates_100g"]),
        fat: num(nutriments["fat_100g"]),
      },
      servingGrams: num(p.serving_quantity) === null ? null : Math.round(num(p.serving_quantity)!),
      servingLabel: text(p.serving_size),
      portion: null,
      labelKey: null,
      timesLogged: 0,
    });
  }
  return out;
}

/** Nutritionix's UPC lookup returns the same rows as a search, under `foods`. */
export function parseNutritionixItem(payload: unknown, barcode: string): FoodSearchResult | null {
  const foods = (payload as { foods?: unknown[] })?.foods;
  if (!Array.isArray(foods) || foods.length === 0) return null;
  const [result] = parseNutritionixInstant({ branded: foods });
  if (!result) return null;
  return { ...result, barcode };
}

/**
 * Nutritionix — the source that covers what Open Food Facts can't: restaurant
 * and pub menus, and everyday foods that never had a packet.
 *
 * Its "branded" set is where chain menu items live (a Big Mac, a Wetherspoon
 * burger); "common" is the generic side (a boiled egg, a jacket potato).
 * Common items are described per portion and often carry no weight, so they
 * are returned as a portion rather than being given an invented gram figure.
 */
export function parseNutritionixInstant(payload: unknown): FoodSearchResult[] {
  const data = (payload ?? {}) as Record<string, any>;
  const out: FoodSearchResult[] = [];

  for (const raw of Array.isArray(data.branded) ? data.branded : []) {
    const item = row(raw);
    if (!item) continue;
    const name = text(item.food_name);
    const kcal = num(item.nf_calories);
    if (!name || kcal === null) continue;

    const grams = num(item.serving_weight_grams);
    // brand_type 1 is a restaurant, 2 is something off a supermarket shelf.
    const restaurant = item.brand_type === 1;
    out.push({
      id: `nix:${text(item.nix_item_id) ?? name}`,
      source: "nutritionix",
      kind: restaurant ? "restaurant" : "branded",
      name,
      brand: text(item.brand_name),
      barcode: null,
      // Only scaled to 100g where a real serving weight says how: dividing by
      // a weight that isn't there would be making the figure up.
      per100g: grams && grams > 0
        ? {
            kcal: round1((kcal * 100) / grams),
            protein: perHundred(num(item.nf_protein), grams),
            carbs: perHundred(num(item.nf_total_carbohydrate), grams),
            fat: perHundred(num(item.nf_total_fat), grams),
          }
        : null,
      servingGrams: grams === null ? null : Math.round(grams),
      servingLabel: servingLabel(item),
      portion: {
        label: servingLabel(item) ?? "1 serving",
        kcal: Math.round(kcal),
        protein: num(item.nf_protein),
        carbs: num(item.nf_total_carbohydrate),
        fat: num(item.nf_total_fat),
      },
      labelKey: null,
      timesLogged: 0,
    });
  }

  for (const raw of Array.isArray(data.common) ? data.common : []) {
    const item = row(raw);
    if (!item) continue;
    const name = text(item.food_name);
    // The instant endpoint only carries figures for common foods when asked
    // for them in detail; without them there is nothing to log.
    const kcal = num(item.nf_calories);
    if (!name || kcal === null) continue;

    const grams = num(item.serving_weight_grams);
    out.push({
      id: `nix-common:${text(item.tag_id) ?? name}`,
      source: "nutritionix",
      kind: "generic",
      name,
      brand: null,
      barcode: null,
      per100g: grams && grams > 0
        ? {
            kcal: round1((kcal * 100) / grams),
            protein: perHundred(num(item.nf_protein), grams),
            carbs: perHundred(num(item.nf_total_carbohydrate), grams),
            fat: perHundred(num(item.nf_total_fat), grams),
          }
        : null,
      servingGrams: grams === null ? null : Math.round(grams),
      servingLabel: servingLabel(item),
      portion: {
        label: servingLabel(item) ?? "1 serving",
        kcal: Math.round(kcal),
        protein: num(item.nf_protein),
        carbs: num(item.nf_total_carbohydrate),
        fat: num(item.nf_total_fat),
      },
      labelKey: null,
      timesLogged: 0,
    });
  }

  return out;
}

function servingLabel(item: Record<string, any>): string | null {
  const qty = num(item.serving_qty);
  const unit = text(item.serving_unit);
  if (qty === null || !unit) return null;
  return `${formatQty(qty)} ${unit}`;
}

function formatQty(value: number): string {
  return Number.isInteger(value) ? String(value) : String(+value.toFixed(2));
}

function perHundred(value: number | null, grams: number): number | null {
  return value === null ? null : round1((value * 100) / grams);
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * USDA FoodData Central — plain ingredients, already stated per 100g, which is
 * the gap left by a database of packets. Nutrients are identified by their
 * standard numbers rather than by name, since the display names vary between
 * the datasets.
 */
const USDA_NUTRIENTS = { kcal: "208", protein: "203", fat: "204", carbs: "205" };

export function parseUsdaSearch(payload: unknown): FoodSearchResult[] {
  const foods = (payload as { foods?: unknown[] })?.foods;
  if (!Array.isArray(foods)) return [];

  const out: FoodSearchResult[] = [];
  for (const raw of foods) {
    const food = row(raw);
    if (!food) continue;
    const name = text(food.description);
    if (!name) continue;

    const byNumber = new Map<string, number>();
    for (const n of Array.isArray(food.foodNutrients) ? food.foodNutrients : []) {
      const nutrient = row(n);
      if (!nutrient) continue;
      const number = text(nutrient.nutrientNumber) ?? text(nutrient.number);
      const value = num(nutrient.value ?? nutrient.amount);
      if (number && value !== null) byNumber.set(number, value);
    }

    const kcal = byNumber.get(USDA_NUTRIENTS.kcal);
    if (kcal === undefined) continue;

    out.push({
      id: `usda:${food.fdcId ?? name}`,
      source: "usda",
      kind: "generic",
      name: tidyUsdaName(name),
      brand: text(food.brandOwner),
      barcode: text(food.gtinUpc),
      per100g: {
        kcal: round1(kcal),
        protein: byNumber.get(USDA_NUTRIENTS.protein) ?? null,
        carbs: byNumber.get(USDA_NUTRIENTS.carbs) ?? null,
        fat: byNumber.get(USDA_NUTRIENTS.fat) ?? null,
      },
      servingGrams: null,
      servingLabel: null,
      portion: null,
      labelKey: null,
      timesLogged: 0,
    });
  }
  return out;
}

/**
 * USDA writes names as "Chicken, breast, meat only, raw" — comma-first so they
 * sort together in a reference table. Nobody searches that way, so the leading
 * term is put back in front of the rest.
 */
function tidyUsdaName(name: string): string {
  const parts = name.split(",").map((part) => part.trim()).filter(Boolean);
  if (parts.length < 2) return name;
  return `${parts[0]} ${parts.slice(1).join(", ")}`;
}

// ── The user's own foods ───────────────────────────────────────────────────

export interface LibraryRow {
  label: string;
  kcal: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  count: number;
}

/**
 * Their own diary, searched first.
 *
 * These come back as one portion rather than per 100g, because that is what
 * was logged: "chicken and rice, 620 kcal" is a plate of food, not a weight,
 * and offering to rescale it by grams would invent a density it never had.
 */
export function searchLibrary(rows: LibraryRow[], query: string, limit: number): FoodSearchResult[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  return rows
    .filter((row) => row.kcal !== null && row.label.toLowerCase().includes(q))
    .slice(0, limit)
    .map((row) => ({
      id: `library:${normalizeLabel(row.label)}`,
      source: "library" as const,
      kind: "yours" as const,
      name: row.label,
      brand: null,
      barcode: null,
      per100g: null,
      servingGrams: null,
      servingLabel: null,
      portion: {
        label: "as you logged it",
        kcal: row.kcal!,
        protein: row.proteinG,
        carbs: row.carbsG,
        fat: row.fatG,
      },
      labelKey: normalizeLabel(row.label),
      timesLogged: row.count,
    }));
}

// ── Cache ──────────────────────────────────────────────────────────────────
//
// Remote results for the same words are the same for hours, and every repeat
// costs a stranger's server a request. Deliberately in memory rather than in
// the database: it is a courtesy to the upstream APIs and a speed-up for the
// user, not something worth surviving a restart.

const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const CACHE_MAX_ENTRIES = 500;

const cache = new Map<string, { at: number; results: FoodSearchResult[] }>();

export function cacheGet(key: string): FoodSearchResult[] | null {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  // Re-inserting moves it to the end, so the eviction below drops whatever has
  // gone longest without being asked for.
  cache.delete(key);
  cache.set(key, hit);
  return hit.results;
}

export function cacheSet(key: string, results: FoodSearchResult[]): void {
  cache.set(key, { at: Date.now(), results });
  while (cache.size > CACHE_MAX_ENTRIES) {
    const oldest = cache.keys().next();
    if (oldest.done) break;
    cache.delete(oldest.value);
  }
}

export function cacheClear(): void {
  cache.clear();
}
