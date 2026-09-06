import { describe, expect, it } from "vitest";
import { describeAmount, formatQuantity, normalizeUnit } from "../src/servingUnit";

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
