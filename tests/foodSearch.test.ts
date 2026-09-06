import { describe, expect, it, beforeEach } from "vitest";
import {
  cacheClear,
  cacheGet,
  cacheSet,
  dedupeResults,
  parseNutritionixInstant,
  parseNutritionixItem,
  parseOffProduct,
  parseOffProducts,
  parseUsdaSearch,
  rankResults,
  searchLibrary,
  scoreResult,
  type FoodSearchResult,
} from "../src/foodSearch";

/**
 * These are other people's APIs, so what can actually be pinned down is the
 * parsing: given this payload, exactly which rows come out, at which figures,
 * and what happens when a field the docs promise isn't there.
 */

function result(partial: Partial<FoodSearchResult>): FoodSearchResult {
  return {
    id: partial.id ?? "x",
    source: partial.source ?? "off",
    kind: partial.kind ?? "branded",
    name: partial.name ?? "Thing",
    brand: partial.brand ?? null,
    servingLabel: partial.servingLabel ?? null,
    servingUnit: partial.servingUnit ?? null,
    barcode: partial.barcode ?? null,
    per100g: partial.per100g ?? null,
    servingGrams: partial.servingGrams ?? null,
    portion: partial.portion ?? null,
    labelKey: partial.labelKey ?? null,
    timesLogged: partial.timesLogged ?? 0,
  };
}

describe("Open Food Facts", () => {
  const payload = {
    products: [
      {
        code: "5000168001678",
        product_name: "Hobnobs",
        brands: "McVitie's",
        serving_quantity: "15",
        serving_size: "2 biscuits (15 g)",
        nutriments: { "energy-kcal_100g": 471, proteins_100g: 6.9, carbohydrates_100g: 63, fat_100g: 20 },
      },
    ],
  };

  it("reads a product into per-100g figures", () => {
    expect(parseOffProducts(payload)[0]).toMatchObject({
      source: "off",
      kind: "branded",
      name: "Hobnobs",
      brand: "McVitie's",
      barcode: "5000168001678",
      per100g: { kcal: 471, protein: 6.9, carbs: 63, fat: 20 },
      servingGrams: 15,
      // How many units make a serving is the fact that turns a stated count
      // into a figure, and the gram number alone cannot carry it.
      servingLabel: "2 biscuits (15 g)",
    });
  });

  it("leaves the serving text null when the packet doesn't state one", () => {
    const [result] = parseOffProducts({ products: [
      { code: "9", product_name: "Plain flour", nutriments: { "energy-kcal_100g": 341 } },
    ] });
    expect(result).toMatchObject({ servingLabel: null, servingGrams: null });
  });

  it("drops rows that couldn't be logged anyway", () => {
    expect(parseOffProducts({ products: [
      { code: "1", product_name: "", nutriments: { "energy-kcal_100g": 100 } },
      { code: "2", product_name: "No figures", nutriments: {} },
    ] })).toEqual([]);
  });

  it("survives a payload that isn't the shape it should be", () => {
    expect(parseOffProducts(null)).toEqual([]);
    expect(parseOffProducts({ products: "nope" })).toEqual([]);
    expect(parseOffProducts({ products: [null, 7, "x"] })).toEqual([]);
  });

  it("reads the single-barcode endpoint too", () => {
    const single = { status: 1, product: payload.products[0] };
    expect(parseOffProduct(single, "5000168001678")).toMatchObject({ name: "Hobnobs", barcode: "5000168001678" });
    expect(parseOffProduct({ status: 0 }, "123")).toBeNull();
  });
});

describe("Nutritionix", () => {
  const payload = {
    branded: [
      {
        nix_item_id: "abc",
        food_name: "Big Mac",
        brand_name: "McDonald's",
        brand_type: 1,
        nf_calories: 493,
        nf_protein: 26,
        nf_total_carbohydrate: 44,
        nf_total_fat: 24,
        serving_qty: 1,
        serving_unit: "burger",
        serving_weight_grams: 219,
      },
      {
        nix_item_id: "def",
        food_name: "Ready Salted Crisps",
        brand_name: "Walkers",
        brand_type: 2,
        nf_calories: 130,
        serving_qty: 1,
        serving_unit: "bag",
        // No serving weight, so there is no honest way to state this per 100g.
        serving_weight_grams: null,
      },
    ],
    common: [
      {
        tag_id: "1",
        food_name: "boiled egg",
        nf_calories: 78,
        nf_protein: 6.3,
        nf_total_carbohydrate: 0.6,
        nf_total_fat: 5.3,
        serving_qty: 1,
        serving_unit: "large",
        serving_weight_grams: 50,
      },
    ],
  };

  it("marks a restaurant item as a menu item, not a packet", () => {
    const [bigMac] = parseNutritionixInstant(payload);
    expect(bigMac).toMatchObject({ kind: "restaurant", name: "Big Mac", brand: "McDonald's" });
  });

  it("scales a portion to 100g only when a real serving weight says how", () => {
    const [bigMac, crisps] = parseNutritionixInstant(payload);
    // 493 kcal in 219g.
    expect(bigMac!.per100g).toMatchObject({ kcal: 225.1 });
    expect(bigMac!.portion).toMatchObject({ label: "1 burger", kcal: 493 });
    // No weight, so no invented density — the portion is all it claims.
    expect(crisps!.per100g).toBeNull();
    expect(crisps!.portion).toMatchObject({ label: "1 bag", kcal: 130 });
  });

  it("treats the common set as generic ingredients", () => {
    const generic = parseNutritionixInstant(payload).filter((r) => r.kind === "generic");
    expect(generic).toHaveLength(1);
    expect(generic[0]).toMatchObject({ name: "boiled egg", portion: { label: "1 large", kcal: 78 } });
  });

  it("skips common rows that came back without figures", () => {
    const thin = { common: [{ tag_id: "9", food_name: "porridge" }] };
    expect(parseNutritionixInstant(thin)).toEqual([]);
  });

  it("survives a payload that isn't the shape it should be", () => {
    expect(parseNutritionixInstant(null)).toEqual([]);
    expect(parseNutritionixInstant({ branded: "nope", common: 3 })).toEqual([]);
    expect(parseNutritionixInstant({ branded: [null], common: [undefined, 4] })).toEqual([]);
  });

  it("reads the barcode endpoint, which returns the same rows under foods", () => {
    const item = parseNutritionixItem({ foods: [payload.branded[0]] }, "5000000000000");
    expect(item).toMatchObject({ name: "Big Mac", barcode: "5000000000000" });
    expect(parseNutritionixItem({ foods: [] }, "1")).toBeNull();
  });
});

describe("USDA FoodData Central", () => {
  const payload = {
    foods: [
      {
        fdcId: 171077,
        description: "Chicken, broilers or fryers, breast, meat only, raw",
        foodNutrients: [
          { nutrientNumber: "208", value: 114 },
          { nutrientNumber: "203", value: 21.2 },
          { nutrientNumber: "205", value: 0 },
          { nutrientNumber: "204", value: 2.6 },
        ],
      },
    ],
  };

  it("reads nutrients by their number, not their display name", () => {
    expect(parseUsdaSearch(payload)[0]).toMatchObject({
      source: "usda",
      kind: "generic",
      per100g: { kcal: 114, protein: 21.2, carbs: 0, fat: 2.6 },
    });
  });

  it("puts the reference-table name back into the order people read", () => {
    // "Chicken, broilers…, breast, …" is how a reference table sorts, not how
    // anyone searches.
    expect(parseUsdaSearch(payload)[0]!.name).toBe("Chicken broilers or fryers, breast, meat only, raw");
  });

  it("skips a food with no energy figure", () => {
    expect(parseUsdaSearch({ foods: [{ fdcId: 1, description: "Water", foodNutrients: [] }] })).toEqual([]);
  });

  it("survives a payload that isn't the shape it should be", () => {
    expect(parseUsdaSearch(undefined)).toEqual([]);
    expect(parseUsdaSearch({ foods: {} })).toEqual([]);
    expect(parseUsdaSearch({ foods: [null, { fdcId: 1, description: "X", foodNutrients: [null] }] })).toEqual([]);
  });
});

describe("the user's own foods", () => {
  const rows = [
    { label: "Chicken and rice", kcal: 620, proteinG: 48, carbsG: 70, fatG: 12, count: 9 },
    { label: "Greek yoghurt", kcal: 150, proteinG: 20, carbsG: 8, fatG: 4, count: 3 },
    { label: "Mystery thing", kcal: null, proteinG: null, carbsG: null, fatG: null, count: 1 },
  ];

  it("offers a past meal as the portion it was, not as a weight", () => {
    const [found] = searchLibrary(rows, "chicken", 5);
    // Rescaling "a plate of chicken and rice" by grams would invent a density
    // it never had.
    expect(found).toMatchObject({
      kind: "yours",
      per100g: null,
      portion: { label: "as you logged it", kcal: 620 },
      labelKey: "chicken rice",
      timesLogged: 9,
    });
  });

  it("leaves out anything with no calories on it", () => {
    expect(searchLibrary(rows, "mystery", 5)).toEqual([]);
  });
});

describe("ranking", () => {
  it("puts their own foods above anything a database can offer", () => {
    const ranked = rankResults(
      [
        result({ id: "a", name: "Greek Yoghurt", source: "off" }),
        result({ id: "b", name: "Greek yoghurt", source: "library", kind: "yours", timesLogged: 4 }),
      ],
      "greek yoghurt",
      10,
    );
    expect(ranked[0]!.source).toBe("library");
  });

  it("prefers the thing that was searched for over a variant of it", () => {
    const exact = result({ id: "a", name: "Hobnobs" });
    const variant = result({ id: "b", name: "Chocolate Hobnob Flapjack Bites" });
    expect(scoreResult(exact, "hobnobs")).toBeGreaterThan(scoreResult(variant, "hobnobs"));
  });

  it("rewards a complete macro breakdown, which is what the day's targets need", () => {
    const complete = result({ id: "a", name: "Yoghurt", per100g: { kcal: 60, protein: 10, carbs: 4, fat: 1 } });
    const partial = result({ id: "b", name: "Yoghurt", per100g: { kcal: 60, protein: null, carbs: null, fat: null } });
    expect(scoreResult(complete, "yoghurt")).toBeGreaterThan(scoreResult(partial, "yoghurt"));
  });

  it("shows the same product once when two databases both have it", () => {
    const rows = [
      result({ id: "a", source: "off", barcode: "5000168001678", name: "Hobnobs" }),
      result({ id: "b", source: "nutritionix", barcode: "5000168001678", name: "Hobnobs Oat Biscuits" }),
    ];
    expect(dedupeResults(rows)).toHaveLength(1);
  });

  it("matches the same food by name when neither side has a barcode", () => {
    const rows = [
      result({ id: "a", source: "off", name: "Greek Yoghurt", brand: "Fage" }),
      result({ id: "b", source: "usda", name: "greek yoghurts", brand: "Fage" }),
    ];
    expect(dedupeResults(rows)).toHaveLength(1);
  });

  it("keeps two genuinely different foods apart", () => {
    const rows = [
      result({ id: "a", name: "Greek Yoghurt" }),
      result({ id: "b", name: "Greek Salad" }),
    ];
    expect(dedupeResults(rows)).toHaveLength(2);
  });
});

describe("the search cache", () => {
  beforeEach(() => cacheClear());

  it("hands back what it was given", () => {
    const rows = [result({ id: "a" })];
    cacheSet("hobnobs", rows);
    expect(cacheGet("hobnobs")).toEqual(rows);
  });

  it("says nothing for a query it hasn't seen", () => {
    expect(cacheGet("nothing")).toBeNull();
  });

  it("remembers that a barcode is in none of the databases", () => {
    // Otherwise every scan of the same unknown packet asks all of them again
    // for the same answer.
    cacheSet("barcode:0000000000000", []);
    expect(cacheGet("barcode:0000000000000")).toEqual([]);
  });
});
