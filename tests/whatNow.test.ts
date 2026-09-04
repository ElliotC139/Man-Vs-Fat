import { describe, expect, it } from "vitest";
import { macroRoom, whatCanIStillEat, type WhatNowFood, type WhatNowMeal } from "../src/whatNow";
import { resolveMacroTargets } from "../src/macros";

function food(partial: Partial<WhatNowFood> & { label: string }): WhatNowFood {
  return {
    labelKey: partial.labelKey ?? partial.label.toLowerCase(),
    label: partial.label,
    kcal: partial.kcal ?? 100,
    proteinG: partial.proteinG ?? 0,
    carbsG: partial.carbsG ?? 0,
    fatG: partial.fatG ?? 0,
    count: partial.count ?? 1,
  };
}

const noMacros = { remainingKcal: 500, rooms: [], meals: [] as WhatNowMeal[] };

describe("macroRoom", () => {
  it("reads a floor as a gap with no upper edge", () => {
    const targets = resolveMacroTargets({ macroMode: "grams", proteinTargetG: 150, proteinOp: "min" });
    const [room] = macroRoom(targets, { protein: 90, carbs: 0, fat: 0 });
    expect(room).toMatchObject({ key: "protein", op: "min", gap: 60, headroom: null });
  });

  it("reads a ceiling as headroom with no gap", () => {
    const targets = resolveMacroTargets({ macroMode: "grams", fatTargetG: 70, fatOp: "max" });
    const [room] = macroRoom(targets, { protein: 0, carbs: 0, fat: 52 });
    expect(room).toMatchObject({ key: "fat", op: "max", gap: 0, headroom: 18 });
  });

  it("reads an 'about' figure as both, inside the same 5% margin the diary uses", () => {
    const targets = resolveMacroTargets({ macroMode: "grams", carbsTargetG: 200, carbsOp: "eq" });
    const [room] = macroRoom(targets, { protein: 0, carbs: 100, fat: 0 });
    // 200 ± 10: still 90g short of the bottom of the band, 110g below the top.
    expect(room).toMatchObject({ key: "carbs", op: "eq", gap: 90, headroom: 110 });
  });

  it("goes negative on a ceiling that has already been passed", () => {
    const targets = resolveMacroTargets({ macroMode: "grams", fatTargetG: 70, fatOp: "max" });
    const [room] = macroRoom(targets, { protein: 0, carbs: 0, fat: 78 });
    expect(room!.headroom).toBe(-8);
  });

  it("says nothing about a macro with no target", () => {
    const targets = resolveMacroTargets({ macroMode: "grams", proteinTargetG: 150, proteinOp: "min" });
    expect(macroRoom(targets, { protein: 0, carbs: 0, fat: 0 })).toHaveLength(1);
    expect(macroRoom(null, { protein: 0, carbs: 0, fat: 0 })).toEqual([]);
  });
});

describe("what can I still eat", () => {
  it("has nothing to say without a calorie reference to measure against", () => {
    const result = whatCanIStillEat({ ...noMacros, remainingKcal: null, foods: [food({ label: "Toast" })] });
    expect(result).toMatchObject({ available: false, reason: "no-reference", suggestions: [] });
  });

  it("says so plainly rather than suggesting food once the day is spent", () => {
    const result = whatCanIStillEat({ ...noMacros, remainingKcal: -120, foods: [food({ label: "Toast" })] });
    expect(result).toMatchObject({ available: false, reason: "no-room" });
  });

  it("has nothing to suggest from an empty library", () => {
    const result = whatCanIStillEat({ ...noMacros, foods: [] });
    expect(result).toMatchObject({ available: false, reason: "empty-library" });
  });

  it("never offers something that doesn't fit the calories left", () => {
    const result = whatCanIStillEat({
      ...noMacros,
      remainingKcal: 300,
      foods: [food({ label: "Apple", kcal: 90 }), food({ label: "Pizza", kcal: 900 })],
    });
    expect(result.suggestions.map((s) => s.label)).toEqual(["Apple"]);
  });

  it("never offers something that would breach a ceiling", () => {
    const rooms = macroRoom(
      resolveMacroTargets({ macroMode: "grams", fatTargetG: 70, fatOp: "max" }),
      { protein: 0, carbs: 0, fat: 60 },
    );
    const result = whatCanIStillEat({
      ...noMacros,
      rooms,
      foods: [food({ label: "Chicken", kcal: 200, proteinG: 40, fatG: 4 }), food({ label: "Chips", kcal: 300, fatG: 20 })],
    });
    // 10g of fat headroom: the chicken fits inside it, the chips don't.
    expect(result.suggestions.map((s) => s.label)).toEqual(["Chicken"]);
  });

  it("puts what closes an outstanding gap first", () => {
    const rooms = macroRoom(
      resolveMacroTargets({ macroMode: "grams", proteinTargetG: 150, proteinOp: "min" }),
      { protein: 100, carbs: 0, fat: 0 },
    );
    const result = whatCanIStillEat({
      ...noMacros,
      // Only room for one of them, so nothing can pair its way to the top.
      remainingKcal: 300,
      rooms,
      // Same calories, same familiarity — the protein is the only difference.
      foods: [
        food({ label: "Rice", kcal: 200, proteinG: 4, carbsG: 44 }),
        food({ label: "Greek yoghurt", kcal: 200, proteinG: 34, carbsG: 12 }),
      ],
    });
    expect(result.suggestions[0]!.label).toBe("Greek yoghurt");
  });

  it("says what a suggestion does to the day without telling anyone to eat it", () => {
    const rooms = macroRoom(
      resolveMacroTargets({ macroMode: "grams", proteinTargetG: 150, proteinOp: "min" }),
      { protein: 110, carbs: 0, fat: 0 },
    );
    const result = whatCanIStillEat({
      ...noMacros,
      remainingKcal: 500,
      rooms,
      foods: [food({ label: "Greek yoghurt", kcal: 200, proteinG: 20 })],
    });
    expect(result.suggestions[0]!.why).toBe("Covers 20g of the 40g of protein still to go, and leaves 300 kcal.");
  });

  it("groups thousands the way the rest of the screen does", () => {
    const result = whatCanIStillEat({
      ...noMacros,
      remainingKcal: 1800,
      foods: [food({ label: "Apple", kcal: 95 })],
    });
    expect(result.suggestions[0]!.why).toBe("Leaves 1,705 kcal of today's allowance.");
  });

  it("leaves out foods with no macro figures when macros are being tracked", () => {
    const rooms = macroRoom(
      resolveMacroTargets({ macroMode: "grams", proteinTargetG: 150, proteinOp: "min" }),
      { protein: 0, carbs: 0, fat: 0 },
    );
    const result = whatCanIStillEat({
      ...noMacros,
      rooms,
      foods: [
        food({ label: "Chicken", kcal: 200, proteinG: 40 }),
        // Counting these as zero would let it look safe against any ceiling.
        { labelKey: "mystery", label: "Mystery pie", kcal: 200, proteinG: null, carbsG: null, fatG: null, count: 5 },
      ],
    });
    expect(result.suggestions.map((s) => s.label)).toEqual(["Chicken"]);
    expect(result.skippedForMissingMacros).toBe(1);
  });

  it("keeps missing macros out of the count when no macros are tracked at all", () => {
    const result = whatCanIStillEat({
      ...noMacros,
      foods: [{ labelKey: "mystery", label: "Mystery pie", kcal: 200, proteinG: null, carbsG: null, fatG: null, count: 5 }],
    });
    expect(result.skippedForMissingMacros).toBe(0);
    expect(result.suggestions.map((s) => s.label)).toEqual(["Mystery pie"]);
  });

  it("says the macros are unknown rather than that nothing fits", () => {
    const rooms = macroRoom(
      resolveMacroTargets({ macroMode: "grams", proteinTargetG: 150, proteinOp: "min" }),
      { protein: 0, carbs: 0, fat: 0 },
    );
    const result = whatCanIStillEat({
      ...noMacros,
      rooms,
      foods: [{ labelKey: "pie", label: "Mystery pie", kcal: 400, proteinG: null, carbsG: null, fatG: null, count: 3 }],
    });
    // Nothing was measured and found wanting — there was nothing to measure.
    expect(result).toMatchObject({ available: false, reason: "macros-unknown", skippedForMissingMacros: 1 });
  });

  it("shortens the list to the leanest few once a ceiling has been passed", () => {
    const rooms = macroRoom(
      resolveMacroTargets({ macroMode: "grams", fatTargetG: 70, fatOp: "max" }),
      { protein: 0, carbs: 0, fat: 80 },
    );
    const foods = Array.from({ length: 10 }, (_, i) => food({ label: `Food ${i}`, kcal: 100, fatG: i }));
    const result = whatCanIStillEat({ ...noMacros, remainingKcal: 900, rooms, foods });
    expect(result.suggestions.map((s) => s.label)).toEqual(["Food 0", "Food 1", "Food 2"]);
  });

  it("offers a pair when no single food covers the gap", () => {
    const rooms = macroRoom(
      resolveMacroTargets({ macroMode: "grams", proteinTargetG: 60, proteinOp: "min" }),
      { protein: 0, carbs: 0, fat: 0 },
    );
    const result = whatCanIStillEat({
      ...noMacros,
      remainingKcal: 600,
      rooms,
      foods: [
        food({ label: "Eggs", kcal: 180, proteinG: 18, count: 10 }),
        food({ label: "Greek yoghurt", kcal: 150, proteinG: 20, count: 9 }),
      ],
    });
    const top = result.suggestions[0]!;
    expect(top.kind).toBe("pair");
    expect(top.proteinG).toBe(38);
    // Both halves are logged separately, so each can be undone on its own.
    expect(top.parts.map((p) => p.labelKey)).toEqual(["eggs", "greek yoghurt"]);
  });

  it("costs a pair as the sum of its halves", () => {
    const result = whatCanIStillEat({
      ...noMacros,
      remainingKcal: 600,
      foods: [
        food({ label: "Eggs", kcal: 180, proteinG: 18, carbsG: 1, fatG: 12, count: 10 }),
        food({ label: "Toast", kcal: 200, proteinG: 8, carbsG: 38, fatG: 2, count: 9 }),
      ],
    });
    const pair = result.suggestions.find((s) => s.kind === "pair")!;
    expect(pair).toMatchObject({ kcal: 380, proteinG: 26, carbsG: 39, fatG: 14 });
  });

  it("never offers a pair that overshoots the calories left", () => {
    const result = whatCanIStillEat({
      ...noMacros,
      remainingKcal: 300,
      foods: [
        food({ label: "Eggs", kcal: 180, count: 10 }),
        food({ label: "Toast", kcal: 200, count: 9 }),
      ],
    });
    expect(result.suggestions.some((s) => s.kind === "pair")).toBe(false);
  });

  it("carries saved meals through at their per-serving cost", () => {
    const result = whatCanIStillEat({
      ...noMacros,
      remainingKcal: 700,
      foods: [],
      meals: [{ id: 7, name: "Chilli", kind: "recipe", kcal: 480, proteinG: 38, carbsG: 40, fatG: 16 }],
    });
    expect(result.suggestions[0]).toMatchObject({
      kind: "meal",
      label: "Chilli",
      kcal: 480,
      parts: [{ kind: "meal", mealId: 7, label: "Chilli", kcal: 480 }],
    });
  });

  it("says nothing fits rather than bending the limits", () => {
    const rooms = macroRoom(
      resolveMacroTargets({ macroMode: "grams", carbsTargetG: 100, carbsOp: "max" }),
      { protein: 0, carbs: 95, fat: 0 },
    );
    const result = whatCanIStillEat({
      ...noMacros,
      rooms,
      foods: [food({ label: "Rice", kcal: 200, carbsG: 44 }), food({ label: "Pasta", kcal: 300, carbsG: 60 })],
    });
    expect(result).toMatchObject({ available: false, reason: "nothing-fits", suggestions: [] });
  });

  it("switches to the least of a ceiling that has already been passed, and flags it", () => {
    const rooms = macroRoom(
      resolveMacroTargets({ macroMode: "grams", fatTargetG: 70, fatOp: "max" }),
      { protein: 0, carbs: 0, fat: 80 },
    );
    const result = whatCanIStillEat({
      ...noMacros,
      rooms,
      foods: [
        food({ label: "Cheese", kcal: 200, fatG: 18, count: 20 }),
        food({ label: "Turkey", kcal: 200, fatG: 2, count: 1 }),
      ],
    });
    expect(result.breachedCeilings).toEqual(["fat"]);
    // Cheese is the far more familiar food; the passed ceiling outranks that.
    expect(result.suggestions[0]!.label).toBe("Turkey");
  });

  it("keeps the card to a handful of suggestions", () => {
    const foods = Array.from({ length: 30 }, (_, i) => food({ label: `Food ${i}`, kcal: 50 + i, count: 30 - i }));
    const result = whatCanIStillEat({ ...noMacros, remainingKcal: 900, foods });
    expect(result.suggestions.length).toBeLessThanOrEqual(6);
    expect(result.suggestions.filter((s) => s.kind === "pair").length).toBeLessThanOrEqual(2);
  });
});
