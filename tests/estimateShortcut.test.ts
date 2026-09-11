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
    expect(readAmount("200g chicken breast")).toEqual({ phrase: "chicken breast", count: null, unit: null, grams: 200 });
    expect(readAmount("1.5 kg potatoes")).toEqual({ phrase: "potatoes", count: null, unit: null, grams: 1500 });
    expect(readAmount("4 oz steak").grams).toBeCloseTo(113.398, 2);
  });

  it("reads a leading count", () => {
    expect(readAmount("2 hobnobs")).toEqual({ phrase: "hobnobs", count: 2, unit: null, grams: null });
    expect(readAmount("3 x jaffa cakes")).toEqual({ phrase: "jaffa cakes", count: 3, unit: null, grams: null });
  });

  it("reads no amount where none was stated", () => {
    expect(readAmount("chicken stir fry")).toEqual({ phrase: "chicken stir fry", count: null, unit: null, grams: null });
    // Millilitres are deliberately not weight: converting needs a density,
    // which is exactly the kind of thing this must not invent.
    expect(readAmount("330ml coke")).toEqual({ phrase: "330ml coke", count: null, unit: null, grams: null });
    // A trailing amount is left alone rather than parsed loosely.
    expect(readAmount("chicken 200g")).toEqual({ phrase: "chicken 200g", count: null, unit: null, grams: null });
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

  it("multiplies by a stated count, and leaves the label alone", () => {
    // The label used to come back "2 × Greek yoghurt", which then went into
    // the diary and back out through the food library as a listing of its
    // own — one row per number of yoghurts anyone had ever eaten. The count
    // belongs in the quantity, where the edit form can change it.
    const item = libraryShortcut(rows, readAmount("2 greek yoghurt"));
    expect(item).toMatchObject({ label: "Greek yoghurt", kcal: 300, proteinG: 60, quantity: 2 });
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

/**
 * The arithmetic that makes re-logging work.
 *
 * A library row is a total for some amount, and until it carried that amount
 * it could only ever hand back the last plate of food again. Two rashers of
 * bacon became a listing called "2 rashers of bacon", one rasher became a
 * second listing, and four rashers came back as four two-rasher servings.
 *
 * Everything below is one question asked several ways: does the row divide
 * down to ONE of the food before it multiplies back up.
 */
describe("libraryShortcut, on a food that comes in units", () => {
  // 180 kcal of bacon, logged as two rashers. So one rasher is 90.
  const bacon = [libraryRow({
    label: "Bacon", kcal: 180, proteinG: 12, carbsG: 0, fatG: 14,
    quantity: 2, unitLabel: "rasher", count: 5,
  })];

  it("gives one of it when one was asked for", () => {
    const item = libraryShortcut(bacon, readAmount("1 rasher of bacon"));
    expect(item).toMatchObject({ label: "Bacon", kcal: 90, proteinG: 6, quantity: 1, unitLabel: "rasher" });
  });

  it("multiplies the unit, not the last plate", () => {
    // The bug this fixes: four rashers used to come back as 4 × 180.
    expect(libraryShortcut(bacon, readAmount("4 rashers of bacon"))?.kcal).toBe(360);
  });

  it("hands back exactly what was approved when the amount is unchanged", () => {
    // Dividing to a per-unit figure and multiplying back must not walk the
    // number: re-logging the same two rashers is still 180, not 179 or 181.
    const item = libraryShortcut(bacon, readAmount("2 rashers of bacon"));
    expect(item).toMatchObject({ kcal: 180, proteinG: 12, fatG: 14, quantity: 2 });
  });

  it("defaults to the amount last logged when no count was stated", () => {
    const item = libraryShortcut(bacon, readAmount("bacon"));
    expect(item).toMatchObject({ kcal: 180, quantity: 2, unitLabel: "rasher" });
  });

  it("takes a bare count as a count of units", () => {
    // "3 bacon" is three rashers, because rashers are what bacon is counted in.
    expect(libraryShortcut(bacon, readAmount("3 bacon"))?.kcal).toBe(270);
  });

  it("treats a vague unit word as agreeing with the real one", () => {
    // "A piece of bacon" and "a rasher of bacon" are the same sentence. Only
    // one of them uses the word the row happens to store.
    expect(libraryShortcut(bacon, readAmount("1 piece of bacon"))?.kcal).toBe(90);
    expect(libraryShortcut(bacon, readAmount("2 pieces of bacon"))?.kcal).toBe(180);
  });

  it("refuses a unit it would have to convert", () => {
    // Nothing here knows how many rashers are in 2 slices, and guessing is
    // how a wrong figure gets logged without anybody noticing.
    expect(libraryShortcut(bacon, readAmount("2 slices of bacon"))).toBeNull();
  });
});

describe("libraryShortcut, on a food with no unit to count", () => {
  // The case the user named: some things are just a serving.
  const stew = [libraryRow({ label: "Beef stew", kcal: 520, count: 3 })];
  // 300 g of chicken at 495 kcal. Measured, not counted.
  const chicken = [libraryRow({ label: "Chicken breast", kcal: 495, quantity: 300, unitLabel: "g", count: 4 })];

  it("leaves an unmeasured plate exactly as it always behaved", () => {
    expect(libraryShortcut(stew, readAmount("beef stew"))).toMatchObject({ kcal: 520, quantity: 1 });
    expect(libraryShortcut(stew, readAmount("2 beef stew"))).toMatchObject({ kcal: 1040, quantity: 2 });
  });

  it("reads a bare count against a weighed row as that many of what you had", () => {
    // NOT two grams of chicken, which is what counting units would give and
    // would log 3 kcal where 990 belonged.
    expect(libraryShortcut(chicken, readAmount("2 chicken breast"))).toMatchObject({
      kcal: 990, quantity: 600, unitLabel: "g",
    });
  });

  it("still refuses a stated weight, which needs a per-100g it hasn't got", () => {
    expect(libraryShortcut(chicken, readAmount("200g chicken breast"))).toBeNull();
  });
});

describe("readAmount, on a count that names its unit", () => {
  it("reads the count, the unit and the food", () => {
    expect(readAmount("2 rashers of bacon")).toEqual({ phrase: "bacon", count: 2, unit: "rashers", grams: null });
    expect(readAmount("1 piece of bacon")).toEqual({ phrase: "bacon", count: 1, unit: "piece", grams: null });
  });

  it("drops a serving the way everything else does, but keeps the count", () => {
    // "2 servings of lasagne" states an amount — twice the usual — even
    // though "serving" itself names no unit.
    expect(readAmount("2 servings of lasagne")).toEqual({ phrase: "lasagne", count: 2, unit: null, grams: null });
  });

  it("leaves a food whose name merely contains a unit word alone", () => {
    // Without the "of", picking the unit out of the name is guesswork: this
    // stays a bare count of a food called "chicken breasts", as it always was.
    expect(readAmount("2 chicken breasts")).toEqual({ phrase: "chicken breasts", count: 2, unit: null, grams: null });
  });

  it("still reads a weight as a weight, not as a unit", () => {
    expect(readAmount("200 g of chicken")).toMatchObject({ count: null, grams: 200 });
  });
});
