import { describe, expect, it } from "vitest";
import {
  describeAmount,
  formatQuantity,
  isMeasuredByWeight,
  normalizeUnit,
  sameUnit,
  suggestUnits,
} from "../src/servingUnit";

describe("cleaning a unit off a food database", () => {
  it("lowercases and trims what the source said", () => {
    expect(normalizeUnit("  Slice ")).toBe("slice");
  });

  it("drops a serving, which says nothing a multiplier didn't", () => {
    // A row reading "1 serving" is noise where "x1" was silence.
    expect(normalizeUnit("serving")).toBeNull();
    expect(normalizeUnit("Servings")).toBeNull();
  });

  it("drops nothing usable rather than storing an empty label", () => {
    expect(normalizeUnit("")).toBeNull();
    expect(normalizeUnit("   ")).toBeNull();
    expect(normalizeUnit(null)).toBeNull();
    expect(normalizeUnit(undefined)).toBeNull();
    expect(normalizeUnit(42 as never)).toBeNull();
  });

  it("caps a label long enough to wreck a row", () => {
    expect(normalizeUnit("x".repeat(60))!.length).toBe(20);
  });
});

describe("how much of it, as a row reads it", () => {
  it("says nothing about one of an unnamed thing", () => {
    // "x1" is a fact about arithmetic, not about food.
    expect(describeAmount(1, null)).toBeNull();
  });

  it("falls back to a multiplier when nothing named the unit", () => {
    expect(describeAmount(2, null)).toBe("×2");
    expect(describeAmount(1.5, null)).toBe("×1.5");
  });

  it("writes a mass without a space, the way a label does", () => {
    expect(describeAmount(40, "g")).toBe("40g");
    expect(describeAmount(330, "ml")).toBe("330ml");
  });

  it("keeps one of a named thing singular", () => {
    expect(describeAmount(1, "slice")).toBe("1 slice");
  });

  it("pluralises a counted thing, and not a mass", () => {
    // 30 gs is not a word anyone has ever written down.
    expect(describeAmount(2, "slice")).toBe("2 slices");
    expect(describeAmount(30, "g")).toBe("30g");
  });

  it("handles the awkward endings a food database actually uses", () => {
    expect(describeAmount(2, "sandwich")).toBe("2 sandwiches");
    expect(describeAmount(3, "patty")).toBe("3 patties");
    expect(describeAmount(2, "glass")).toBe("2 glasses");
    // A vowel before the y stays a plain s: "2 trays", not "2 traies".
    expect(describeAmount(2, "tray")).toBe("2 trays");
  });

  it("treats a serving as no unit at all, wherever it arrives from", () => {
    expect(describeAmount(2, "serving")).toBe("×2");
    expect(describeAmount(1, "serving")).toBeNull();
  });

  it("keeps a fractional amount readable", () => {
    expect(describeAmount(0.5, "slice")).toBe("0.5 slices");
    expect(describeAmount(32.5, "g")).toBe("32.5g");
  });
});

describe("formatting the number itself", () => {
  it("drops a pointless decimal but keeps a real one", () => {
    expect(formatQuantity(2)).toBe("2");
    expect(formatQuantity(1.5)).toBe("1.5");
    expect(formatQuantity(1.5000001)).toBe("1.5");
  });
});

describe("which units to offer for a food", () => {
  it("leads with the units that food is actually measured in", () => {
    expect(suggestUnits("Pepperoni pizza")[0]).toBe("slice");
    expect(suggestUnits("Semi-skimmed milk")[0]).toBe("ml");
    expect(suggestUnits("Chocolate digestive")[0]).toBe("biscuit");
    expect(suggestUnits("Olive oil")[0]).toBe("tbsp");
  });

  it("always offers the universal units, whatever the food", () => {
    for (const label of ["Pepperoni pizza", "Something nobody has a word for", ""]) {
      for (const universal of ["g", "ml", "serving", "portion"]) {
        expect(suggestUnits(label)).toContain(universal);
      }
    }
  });

  it("puts the unit the entry already has first, so the picker can show it", () => {
    // Without this the select has no option matching its own value, and
    // silently moves the entry to a different unit the moment it renders.
    expect(suggestUnits("Pepperoni pizza", "wedge")[0]).toBe("wedge");
    expect(suggestUnits("Pepperoni pizza", "wedge")).toContain("slice");
  });

  it("never repeats a unit, however many ways it was reached", () => {
    // "g" is both a hint for oats and a universal.
    const units = suggestUnits("Porridge oats", "g");
    expect(units.filter((unit) => unit === "g")).toHaveLength(1);
    expect(new Set(units).size).toBe(units.length);
  });

  it("offers a serving even though normalizeUnit discards one", () => {
    // The two disagree on purpose. normalizeUnit is about how a saved row
    // reads, and "1 serving" says nothing "x1" didn't. The picker still has to
    // list it, because choosing it is how you go back to a bare multiplier.
    expect(suggestUnits("Beef stew")).toContain("serving");
    expect(normalizeUnit("serving")).toBeNull();
  });

  it("matches whole words, so one food doesn't borrow another's units", () => {
    // "bap" inside "baps" is a bap; "bap" inside "kebab" is not.
    expect(suggestUnits("Doner kebab")).not.toContain("slice");
    expect(suggestUnits("Bacon bap")).toContain("slice");
  });

  it("ignores case and surrounding space, in the food and in the unit", () => {
    expect(suggestUnits("  PEPPERONI PIZZA  ")[0]).toBe("slice");
    expect(suggestUnits("Pizza", " SLICE ")[0]).toBe("slice");
  });

  it("still offers something usable when the label says nothing", () => {
    for (const label of [null, undefined, "", " ", "x"]) {
      expect(suggestUnits(label)).toEqual(["g", "ml", "serving", "portion"]);
    }
  });
});

describe("telling two unit words apart", () => {
  it("matches a plural to its own singular, however awkward the ending", () => {
    // Each of these is one word a food database might store and another a
    // person might type for the same unit.
    expect(sameUnit("slices", "slice")).toBe(true);
    expect(sameUnit("rashers", "rasher")).toBe(true);
    expect(sameUnit("glasses", "glass")).toBe(true);
    expect(sameUnit("patties", "patty")).toBe(true);
    expect(sameUnit("biscuit", "biscuits")).toBe(true);
  });

  it("ignores case and surrounding space, as everything else here does", () => {
    expect(sameUnit(" Rashers ", "rasher")).toBe(true);
  });

  it("keeps genuinely different units apart", () => {
    expect(sameUnit("slice", "rasher")).toBe(false);
    expect(sameUnit("g", "ml")).toBe(false);
    expect(sameUnit("bar", "pack")).toBe(false);
  });

  it("never matches on nothing", () => {
    // Two units nobody named are not the same unit, they are no units.
    expect(sameUnit(null, null)).toBe(false);
    expect(sameUnit("serving", "serving")).toBe(false);
    expect(sameUnit("", "")).toBe(false);
  });
});

describe("whether a unit is weighed or counted", () => {
  it("knows the ones you put on a scale", () => {
    for (const unit of ["g", "kg", "ml", "l", "oz", "fl oz", " G "]) {
      expect(isMeasuredByWeight(unit)).toBe(true);
    }
  });

  it("knows the ones you count", () => {
    // This is the distinction that decides what "2 bacon" means. Counted, it
    // is two rashers; weighed, two grams — and one of those answers logs 3
    // kcal where 180 belonged.
    for (const unit of ["rasher", "slice", "biscuit", "glass", "pack"]) {
      expect(isMeasuredByWeight(unit)).toBe(false);
    }
  });

  it("treats no unit as nothing to weigh", () => {
    expect(isMeasuredByWeight(null)).toBe(false);
    expect(isMeasuredByWeight("serving")).toBe(false);
  });
});
