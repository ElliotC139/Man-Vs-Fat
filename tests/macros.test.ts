import { describe, expect, it } from "vitest";
import {
  clampMacrosToKcal,
  kcalOf,
  resolveMacroTargets,
  scaleMacros,
  sumMacros,
} from "../src/macros";

describe("resolveMacroTargets", () => {
  it("returns null when macros are switched off", () => {
    expect(resolveMacroTargets({ macroMode: null })).toBeNull();
    expect(resolveMacroTargets({})).toBeNull();
  });

  it("uses gram targets directly and reports the split they imply", () => {
    const resolved = resolveMacroTargets({
      macroMode: "grams",
      dailyCalorieTarget: 2200,
      proteinTargetG: 180,
      carbsTargetG: 200,
      fatTargetG: 60,
    })!;

    expect(resolved.grams).toEqual({ protein: 180, carbs: 200, fat: 60 });
    // 720 + 800 + 540 = 2060 kcal, which is deliberately allowed to differ
    // from the 2200 calorie target — the percentages describe the grams.
    expect(resolved.kcalFromMacros).toBe(2060);
    expect(resolved.percent.protein + resolved.percent.carbs + resolved.percent.fat).toBeCloseTo(100, 0);
  });

  it("derives grams from percentages of the calorie target", () => {
    const resolved = resolveMacroTargets({
      macroMode: "percent",
      dailyCalorieTarget: 2000,
      proteinPct: 30,
      carbsPct: 40,
      fatPct: 30,
    })!;

    // 600 kcal protein / 4 = 150g, 800 / 4 = 200g, 600 / 9 = 66.7 -> 67g
    expect(resolved.grams).toEqual({ protein: 150, carbs: 200, fat: 67 });
    expect(resolved.percent).toEqual({ protein: 30, carbs: 40, fat: 30 });
  });

  it("moves the gram targets when the calorie target changes, in percent mode", () => {
    const base = { macroMode: "percent" as const, proteinPct: 30, carbsPct: 40, fatPct: 30 };
    const small = resolveMacroTargets({ ...base, dailyCalorieTarget: 2000 })!;
    const large = resolveMacroTargets({ ...base, dailyCalorieTarget: 3000 })!;
    // The whole reason percentages are stored as percentages rather than as
    // pre-computed grams: a bigger day means proportionally more of each.
    expect(large.grams.protein).toBeGreaterThan(small.grams.protein);
    expect(large.grams.protein).toBe(225);
  });

  it("refuses percent mode with no calorie target to divide up", () => {
    expect(
      resolveMacroTargets({ macroMode: "percent", proteinPct: 30, carbsPct: 40, fatPct: 30 }),
    ).toBeNull();
  });

  it("treats all-zero targets as not set", () => {
    expect(
      resolveMacroTargets({ macroMode: "grams", proteinTargetG: 0, carbsTargetG: 0, fatTargetG: 0 }),
    ).toBeNull();
  });
});

describe("sumMacros", () => {
  it("adds up entries that have macros", () => {
    const totals = sumMacros([
      { proteinG: 30, carbsG: 40, fatG: 10 },
      { proteinG: 20, carbsG: 5, fatG: 2.5 },
    ]);
    expect(totals).toMatchObject({ protein: 50, carbs: 45, fat: 12.5, knownEntries: 2, unknownEntries: 0 });
  });

  it("counts entries with no macros at all rather than treating them as zero", () => {
    const totals = sumMacros([
      { proteinG: 30, carbsG: 40, fatG: 10 },
      // Every row logged before macros existed looks like this.
      { proteinG: null, carbsG: null, fatG: null },
      {},
    ]);
    expect(totals.protein).toBe(30);
    expect(totals.unknownEntries).toBe(2);
    expect(totals.knownEntries).toBe(1);
  });

  it("counts a genuine all-zero entry as known", () => {
    // Black coffee really is 0/0/0, and flagging it as missing would leave a
    // complete day permanently marked partial.
    const totals = sumMacros([{ proteinG: 0, carbsG: 0, fatG: 0 }]);
    expect(totals.unknownEntries).toBe(0);
    expect(totals.knownEntries).toBe(1);
  });

  it("counts a partially-filled entry as known and treats its gaps as zero", () => {
    const totals = sumMacros([{ proteinG: 25, carbsG: null, fatG: null }]);
    expect(totals).toMatchObject({ protein: 25, carbs: 0, fat: 0, knownEntries: 1, unknownEntries: 0 });
  });
});

describe("clampMacrosToKcal", () => {
  it("caps a macro that claims more energy than the item contains", () => {
    // 90g of protein is 360 kcal, which won't fit in a 300 kcal item.
    const capped = clampMacrosToKcal({ protein: 90, carbs: 10, fat: 5 }, 300);
    expect(capped.protein).toBe(75);
    // The others were already plausible and are left alone.
    expect(capped.carbs).toBe(10);
    expect(capped.fat).toBe(5);
  });

  it("leaves a sensible set untouched", () => {
    expect(clampMacrosToKcal({ protein: 40, carbs: 70, fat: 18 }, 650)).toEqual({
      protein: 40,
      carbs: 70,
      fat: 18,
    });
  });

  it("does nothing without a calorie figure to cap against", () => {
    expect(clampMacrosToKcal({ protein: 900, carbs: null, fat: 5 }, null)).toEqual({
      protein: 900,
      carbs: null,
      fat: 5,
    });
  });
});

describe("scaleMacros", () => {
  it("scales figures and keeps nulls null", () => {
    expect(scaleMacros({ proteinG: 20, carbsG: null, fatG: 7 }, 2)).toEqual({
      proteinG: 40,
      carbsG: null,
      fatG: 14,
    });
  });

  it("handles fractional quantities to one decimal", () => {
    expect(scaleMacros({ proteinG: 25, carbsG: 30, fatG: 8 }, 0.5)).toEqual({
      proteinG: 12.5,
      carbsG: 15,
      fatG: 4,
    });
  });
});

describe("kcalOf", () => {
  it("uses 4/4/9", () => {
    expect(kcalOf({ protein: 100, carbs: 100, fat: 100 })).toBe(1700);
  });
});
