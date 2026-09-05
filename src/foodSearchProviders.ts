/**
 * The network half of food search. Kept apart from the parsing in
 * foodSearch.ts so the parsers can be tested against recorded payloads without
 * a network, which is the only part that can be pinned down: these are other
 * people's APIs, and what they return is theirs to change.
 *
 * Every provider here follows the same contract — it either returns results or
 * it returns nothing. None of them can fail the search: an unset key, a
 * timeout, a 500, a shape that no longer parses, all come out the same way, as
 * one source quietly not contributing.
 */

import { config } from "./config";
import { recordError } from "./errorLog";
import {
  parseNutritionixInstant,
  parseNutritionixItem,
  parseOffProduct,
  parseOffProducts,
  parseUsdaSearch,
  type FoodSearchResult,
} from "./foodSearch";

/**
 * Open Food Facts asks callers to identify themselves and throttles those that
 * don't. The browser couldn't set this — a page can't choose its User-Agent —
 * which is one of the reasons search was worth moving to the server.
 */
const OFF_USER_AGENT = "MatchWeekFoodDiary/1.0 (https://match-week-food-diary.fly.dev)";

/** Nobody waits ten seconds for a search box. A slow source is a missing one. */
const PROVIDER_TIMEOUT_MS = 4000;

async function getJson(url: string, init: RequestInit = {}): Promise<unknown | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Wraps a provider so it can only ever contribute or not. A shape change gets
 * logged — that is worth knowing about — but never reaches the user as an
 * error, because the other sources still have an answer.
 */
async function safely(name: string, run: () => Promise<FoodSearchResult[]>): Promise<FoodSearchResult[]> {
  try {
    return await run();
  } catch (error) {
    void recordError(`foodSearch.${name}`, error);
    return [];
  }
}

// ── Open Food Facts ────────────────────────────────────────────────────────

// serving_size is the text one ("15 pieces (30 g)"), not the gram number:
// for anything sold in countable units it is the only field that says how
// many units make a serving, which is what turns "10 pieces" into a figure.
const OFF_FIELDS = "code,product_name,brands,nutriments,serving_quantity,serving_size";

function offUrl(query: string, ukOnly: boolean): string {
  const params = new URLSearchParams({
    search_simple: "1",
    action: "process",
    json: "1",
    page_size: "20",
    fields: OFF_FIELDS,
    search_terms: query,
    // Without a sort the results are an arbitrary slice of everything that
    // matches, which is why searching for something ordinary used to come back
    // with obscure re-imports of it. Scan count is the closest thing the
    // database has to "the one people actually buy".
    sort_by: "unique_scans_n",
  });
  if (ukOnly) {
    params.set("tagtype_0", "countries");
    params.set("tag_contains_0", "contains");
    params.set("tag_0", "united-kingdom");
  }
  return `https://world.openfoodfacts.org/cgi/search.pl?${params.toString()}`;
}

/** Enough UK results that widening the search would only add noise. */
const OFF_UK_ENOUGH = 8;

export function searchOpenFoodFacts(query: string): Promise<FoodSearchResult[]> {
  return safely("off", async () => {
    const headers = { "User-Agent": OFF_USER_AGENT, Accept: "application/json" };

    // British shelves first: a search for "hobnobs" should not lead with a
    // product sold only in France. The global pass only runs when the local
    // one came up short, which is also what stops this being two requests for
    // every keystroke's worth of searching.
    const uk = parseOffProducts(await getJson(offUrl(query, true), { headers }));
    if (uk.length >= OFF_UK_ENOUGH) return uk;

    const global = parseOffProducts(await getJson(offUrl(query, false), { headers }));
    return [...uk, ...global];
  });
}

// ── Nutritionix ────────────────────────────────────────────────────────────

export const nutritionixConfigured = Boolean(config.NUTRITIONIX_APP_ID && config.NUTRITIONIX_APP_KEY);

/**
 * The source that covers restaurant and pub menus, and everyday foods that
 * never came in a packet. Optional: without a key the search falls back to the
 * other two and simply doesn't cover menus.
 */
export function searchNutritionix(query: string): Promise<FoodSearchResult[]> {
  if (!nutritionixConfigured) return Promise.resolve([]);
  return safely("nutritionix", async () => {
    const url = `https://trackapi.nutritionix.com/v2/search/instant?${new URLSearchParams({
      query,
      branded: "true",
      common: "true",
      // Without this the common-food rows come back as names alone, with no
      // figures to log.
      detailed: "true",
    })}`;
    return parseNutritionixInstant(
      await getJson(url, {
        headers: {
          "x-app-id": config.NUTRITIONIX_APP_ID!,
          "x-app-key": config.NUTRITIONIX_APP_KEY!,
          // UK portions and spellings where they differ.
          "x-remote-user-id": "0",
          Accept: "application/json",
        },
      }),
    );
  });
}

// ── USDA FoodData Central ──────────────────────────────────────────────────

export const usdaConfigured = Boolean(config.USDA_API_KEY);

/**
 * Plain ingredients, stated per 100g. The datasets are restricted to the
 * reference ones — Foundation, SR Legacy and the survey set — because the
 * branded USDA data is American supermarket packaging, which Open Food Facts
 * already covers better for a British user.
 */
export function searchUsda(query: string): Promise<FoodSearchResult[]> {
  if (!usdaConfigured) return Promise.resolve([]);
  return safely("usda", async () => {
    const url = `https://api.nal.usda.gov/fdc/v1/foods/search?${new URLSearchParams({
      api_key: config.USDA_API_KEY!,
      query,
      dataType: "Foundation,SR Legacy,Survey (FNDDS)",
      pageSize: "15",
    })}`;
    return parseUsdaSearch(await getJson(url, { headers: { Accept: "application/json" } }));
  });
}

/**
 * Every remote source at once, merged.
 *
 * allSettled, not all: each provider already swallows its own failures, but
 * the search must not depend on every one of them continuing to. One source
 * throwing is one source missing from the answer, never a failed search.
 *
 * Lives here rather than in the search route because food search is no longer
 * its only caller — estimating a typed meal grounds itself in the same rows
 * (see src/estimateGrounding.ts).
 */
export async function searchAllProviders(query: string): Promise<FoodSearchResult[]> {
  const groups = await Promise.allSettled([
    searchOpenFoodFacts(query),
    searchNutritionix(query),
    searchUsda(query),
  ]);
  return groups.flatMap((group) => (group.status === "fulfilled" ? group.value : []));
}

/** Which remote sources this deployment can actually reach, for the UI to say so. */
export function configuredSources(): { menus: boolean; ingredients: boolean } {
  return { menus: nutritionixConfigured, ingredients: usdaConfigured };
}

// ── Barcode lookup ─────────────────────────────────────────────────────────

/**
 * One barcode, tried against each source in turn.
 *
 * Open Food Facts first: it is the barcode database, it is free, and it is
 * where a British shopper's groceries actually are. Nutritionix is the
 * fallback for the ones it has never been shown — which is the whole reason a
 * scan sometimes came back with nothing.
 *
 * Routed through the server rather than straight from the phone so that the
 * User-Agent above is sent, the second source is reachable at all, and the
 * answer can be cached once for everybody instead of once per device.
 */
export function lookupBarcode(barcode: string): Promise<FoodSearchResult | null> {
  return safelyOne("barcode", async () => {
    const off = parseOffProduct(
      await getJson(
        `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}` +
          `?fields=code,product_name,brands,nutriments,serving_quantity`,
        { headers: { "User-Agent": OFF_USER_AGENT, Accept: "application/json" } },
      ),
      barcode,
    );
    if (off) return off;

    if (!nutritionixConfigured) return null;
    return parseNutritionixItem(
      await getJson(`https://trackapi.nutritionix.com/v2/search/item?upc=${encodeURIComponent(barcode)}`, {
        headers: {
          "x-app-id": config.NUTRITIONIX_APP_ID!,
          "x-app-key": config.NUTRITIONIX_APP_KEY!,
          Accept: "application/json",
        },
      }),
      barcode,
    );
  });
}

async function safelyOne(
  name: string,
  run: () => Promise<FoodSearchResult | null>,
): Promise<FoodSearchResult | null> {
  try {
    return await run();
  } catch (error) {
    void recordError(`foodSearch.${name}`, error);
    return null;
  }
}
