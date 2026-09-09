import { describe, expect, it } from "vitest";
import { libraryShortcut, productShortcut, readAmount } from "../src/estimateShortcut";
import type { FoodSearchResult, LibraryRow } from "../src/foodSearch";

/**
 * The rule these tests hold to: a shortcut is taken only when it is certainly
 * right. Every "returns null" case below is a case where the model is cheaper
 * than a wrong figure logged without anybody noticing.
 */

function libraryRow(over: Partial<LibraryRow> & { label: string }): LibraryRow {
  return {
    kcal: 400, proteinG: 30, carbsG: 40, fatG: 10,
    fibreG: 3, sugarG: 5, satFatG: 2, saltG: 1, count: 1,
    ...over,
  };
}

function product(over: Partial<FoodSearchResult> & { name: string }): FoodSearchResult {
  return {
    id: "p", source: "off", kind: "branded", brand: null, barcode: null,
    per100g: null, servingGrams: null, servingLabel: null, servingUnit: null,
    portion: null, labelKey: null, timesLogged: 0,
    ...over,
  };
}

describe("readAmount", () => {
  it("reads a leading weight and converts it to grams", () => {
    expect(readAmount("200g chicken breast")).toEqual({ phrase: "chicken breast", count: null, grams: 200 });
    expect(readAmount("1.5 kg potatoes")).toEqual({ phrase: "potatoes", count: null, grams: 1500 });
    expect(readAmount("4 oz steak").grams).toBeCloseTo(113.398, 2);
  });

  it("reads a leading count", () => {
    expect(readAmount("2 hobnobs")).toEqual({ phrase: "hobnobs", count: 2, grams: null });
    expect(readAmount("3 x jaffa cakes")).toEqual({ phrase: "jaffa cakes", count: 3, grams: null });
  });

  it("reads no amount where none was stated", () => {
    expect(readAmount("chicken stir fry")).toEqual({ phrase: "chicken stir fry", count: null, grams: null });
    // Millilitres are deliberately not weight: converting needs a density,
    // which is exactly the kind of thing this must not invent.
    expect(readAmount("330ml coke")).toEqual({ phrase: "330ml coke", count: null, grams: null });
    // A trailing amount is left alone rather than parsed loosely.
    expect(readAmount("chicken 200g")).toEqual({ phrase: "chicken 200g", count: null, grams: null });
  });
});

describe("libraryShortcut", () => {
  const rows = [
    libraryRow({ label: "Chicken and rice", kcal: 620, count: 4 }),
    libraryRow({ label: "Greek yoghurt", kcal: 150, count: 9 }),
  ];

  it("answers from their own diary on an exact match", () => {
    const item = libraryShortcut(rows, readAmount("chicken and rice"));
    expect(item).toMatchObject({ label: "Chicken and rice", kcal: 620 });
  });

  it("matches through word order, plurals and filler words", () => {
    // normalizeLabel's job, relied on here rather than reimplemented.
    expect(libraryShortcut(rows, readAmount("a bowl of rice and chicken"))?.kcal).toBe(620);
  });

  it("multiplies by a stated count", () => {
    const item = libraryShortcut(rows, readAmount("2 greek yoghurt"));
    expect(item).toMatchObject({ label: "2 × Greek yoghurt", kcal: 300, proteinG: 60 });
  });

  it("refuses a partial match", () => {
    // "rice" is not "chicken and rice", and answering with the latter would
    // log a plate of food for a side.
    expect(libraryShortcut(rows, readAmount("rice"))).toBeNull();
    expect(libraryShortcut(rows, readAmount("chicken and rice and peas"))).toBeNull();
  });

  it("refuses a stated weight", () => {
    // A logged plate has no per-100g behind it, so "200g of it" can only be
    // guessed at — which is the model's job, not this one's.
    expect(libraryShortcut(rows, readAmount("200g chicken and rice"))).toBeNull();
  });

  it("ignores a row with no calories", () => {
    expect(libraryShortcut([libraryRow({ label: "Mystery", kcal: null })], readAmount("mystery"))).toBeNull();
  });

  it("prefers the row they have logged most", () => {
    const dupes = [
      libraryRow({ label: "Porridge", kcal: 300, count: 1 }),
      libraryRow({ label: "porridge", kcal: 380, count: 7 }),
    ];
    expect(libraryShortcut(dupes, readAmount("porridge"))?.kcal).toBe(380);
  });
});

describe("productShortcut", () => {
  const bigMac = product({
    name: "Big Mac", brand: "McDonald's", kind: "restaurant",
    portion: { label: "1 burger", kcal: 493, protein: 26, carbs: 44, fat: 24 },
  });
  const mince = product({
    name: "Beef mince",
    per100g: { kcal: 254, protein: 17.2, carbs: 0, fat: 20, fibre: 0, sugar: 0, satFat: 8, salt: 0.2 },
    servingGrams: 125,
  });

  it("uses a stated portion when no amount was given", () => {
    const item = productShortcut([bigMac], readAmount("big mac"));
    expect(item).toMatchObject({ label: "McDonald's Big Mac", kcal: 493, quantity: 1 });
  });

  it("matches with or without the brand in front", () => {
    expect(productShortcut([bigMac], readAmount("mcdonalds big mac"))?.kcal).toBe(493);
  });

  it("scales per-100g figures by a stated weight", () => {
    const item = productShortcut([mince], readAmount("200g beef mince"));
    expect(item).toMatchObject({ kcal: 508, proteinG: 34.4, fatG: 40, grams: 200, unitLabel: "g" });
  });

  it("falls back to the packet's own serving size", () => {
    const item = productShortcut([mince], readAmount("beef mince"));
    expect(item).toMatchObject({ kcal: 318, grams: 125 });
  });

  it("refuses when two products answer to the same name", () => {
    // Plain and chocolate Hobnobs are different foods, and picking one for
    // someone is how the wrong figure gets logged silently.
    const hobnobs = [
      product({ name: "Hobnobs", brand: "McVitie's", portion: { label: "1 biscuit", kcal: 66, protein: 1, carbs: 9, fat: 3 } }),
      product({ name: "Hobnobs", brand: "Tesco", portion: { label: "1 biscuit", kcal: 71, protein: 1, carbs: 9, fat: 3 } }),
    ];
    expect(productShortcut(hobnobs, readAmount("hobnobs"))).toBeNull();
  });

  it("refuses a partial name match", () => {
    expect(productShortcut([bigMac], readAmount("mac"))).toBeNull();
    expect(productShortcut([bigMac], readAmount("big mac and fries"))).toBeNull();
  });

  it("refuses a counted amount", () => {
    // "3 biscuits" needs to know what one weighs, which the packet states
    // only sometimes and in prose — the model reads that, this doesn't.
    expect(productShortcut([bigMac], readAmount("2 big mac"))).toBeNull();
  });

  it("refuses a weight it cannot scale", () => {
    expect(productShortcut([bigMac], readAmount("200g big mac"))).toBeNull();
  });

  it("refuses per-100g figures with no serving size and no stated amount", () => {
    const bare = product({ name: "Beef mince", per100g: { kcal: 254, protein: 17, carbs: 0, fat: 20 } });
    expect(productShortcut([bare], readAmount("beef mince"))).toBeNull();
  });
});
