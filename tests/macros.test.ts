import { describe, expect, it } from "vitest";
import {
  clampMacrosToKcal,
  describeTarget,
  kcalOf,
  macroProgress,
  resolveMacroTargets,
  scaleMacros,
  sumMacros,
} from "../src/macros";

describe("resolveMacroTargets", () => {
  it("returns null when macros are switched off", () => {
    expect(resolveMacroTargets({ macroMode: null })).toBeNull();
    expect(resolveMacroTargets({})).toBeNull();
  });

  it("uses gram targets directly, defaulting an unset operator to 'about'", () => {
    const resolved = resolveMacroTargets({
      macroMode: "grams",
      dailyCalorieTarget: 2200,
      proteinTargetG: 180,
      carbsTargetG: 200,
      fatTargetG: 60,
    })!;

    // Every target set before operators existed meant "about", so a null
    // operator has to keep reading that way.
    expect(resolved.targets.protein).toEqual({ grams: 180, op: "eq" });
    expect(resolved.targets.carbs).toEqual({ grams: 200, op: "eq" });
    expect(resolved.targets.fat).toEqual({ grams: 60, op: "eq" });
    // 720 + 800 + 540, deliberately allowed to differ from the 2200 target.
    expect(resolved.kcalFromMacros).toBe(2060);
  });

  it("carries each macro's own operator", () => {
    const resolved = resolveMacroTargets({
      macroMode: "grams",
      proteinTargetG: 180,
      proteinOp: "min",
      carbsTargetG: 200,
      carbsOp: "max",
      fatTargetG: 60,
      fatOp: "eq",
    })!;

    expect(resolved.targets.protein).toEqual({ grams: 180, op: "min" });
    expect(resolved.targets.carbs).toEqual({ grams: 200, op: "max" });
    expect(resolved.targets.fat).toEqual({ grams: 60, op: "eq" });
  });

  it("leaves a blank macro untracked rather than targeting zero", () => {
    const resolved = resolveMacroTargets({
      macroMode: "grams",
      proteinTargetG: 180,
      proteinOp: "min",
      carbsTargetG: null,
      // A stored 0 is the same thing: a 0g target means nothing, and reading
      // it as one would put a row on the diary that can only read "0g over".
      fatTargetG: 0,
    })!;

    expect(resolved.targets.protein).toEqual({ grams: 180, op: "min" });
    expect(resolved.targets.carbs).toBeNull();
    expect(resolved.targets.fat).toBeNull();
  });

  it("gives no kcal total once a target is a floor or a ceiling", () => {
    const resolved = resolveMacroTargets({
      macroMode: "grams",
      proteinTargetG: 180,
      proteinOp: "min",
      carbsTargetG: 200,
      carbsOp: "eq",
      fatTargetG: 60,
      fatOp: "eq",
    })!;

    // "At least 180g protein" describes a range, not a day, so there is no
    // honest single kcal figure to report.
    expect(resolved.kcalFromMacros).toBeNull();
  });

  it("tracking protein alone is a valid setup", () => {
    const resolved = resolveMacroTargets({
      macroMode: "grams",
      proteinTargetG: 180,
      proteinOp: "min",
    })!;
    expect(resolved.targets.protein).not.toBeNull();
    expect(resolved.targets.carbs).toBeNull();
    expect(resolved.kcalFromMacros).toBeNull();
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
    expect(resolved.targets.protein).toEqual({ grams: 150, op: "eq" });
    expect(resolved.targets.carbs).toEqual({ grams: 200, op: "eq" });
    expect(resolved.targets.fat).toEqual({ grams: 67, op: "eq" });
    // Percentages have to sum to 100, so they're always "about" — "at least
    // 40% protein" can't be satisfied without saying what gives way.
    expect(resolved.kcalFromMacros).toBe(2003);
  });

  it("moves the gram targets when the calorie target changes, in percent mode", () => {
    const base = { macroMode: "percent" as const, proteinPct: 30, carbsPct: 40, fatPct: 30 };
    const small = resolveMacroTargets({ ...base, dailyCalorieTarget: 2000 })!;
    const large = resolveMacroTargets({ ...base, dailyCalorieTarget: 3000 })!;
    // The whole reason percentages are stored as percentages rather than as
    // pre-computed grams: a bigger day means proportionally more of each.
    expect(large.targets.protein!.grams).toBeGreaterThan(small.targets.protein!.grams);
    expect(large.targets.protein!.grams).toBe(225);
  });

  it("refuses percent mode with no calorie target to divide up", () => {
    expect(
      resolveMacroTargets({ macroMode: "percent", proteinPct: 30, carbsPct: 40, fatPct: 30 }),
    ).toBeNull();
  });

  it("treats every macro blank as macros being off", () => {
    expect(
      resolveMacroTargets({ macroMode: "grams", proteinTargetG: 0, carbsTargetG: null, fatTargetG: 0 }),
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

describe("macroProgress", () => {
  describe("a floor (at least)", () => {
    const target = { grams: 180, op: "min" as const };

    it("counts down while short of it", () => {
      const p = macroProgress("protein", target, 125);
      expect(p.verdict).toBe("under");
      expect(p.isGood).toBe(false);
      expect(p.remaining).toBe(55);
      expect(p.percentOfTarget).toBeCloseTo(69.4, 0);
    });

    it("is met exactly on the line", () => {
      const p = macroProgress("protein", target, 180);
      expect(p.verdict).toBe("met");
      expect(p.isGood).toBe(true);
    });

    it("stays good past it — clearing a floor is the point", () => {
      const p = macroProgress("protein", target, 210);
      expect(p.verdict).toBe("met");
      expect(p.isGood).toBe(true);
      // The bar stops at full rather than overflowing.
      expect(p.percentOfTarget).toBe(100);
    });
  });

  describe("a ceiling (at most)", () => {
    const target = { grams: 200, op: "max" as const };

    it("is fine with room to spare", () => {
      const p = macroProgress("carbs", target, 150);
      expect(p.verdict).toBe("under");
      expect(p.isGood).toBe(true);
      expect(p.remaining).toBe(50);
    });

    it("is still fine exactly on the line", () => {
      const p = macroProgress("carbs", target, 200);
      expect(p.verdict).toBe("under");
      expect(p.isGood).toBe(true);
    });

    it("goes bad the moment it's passed", () => {
      const p = macroProgress("carbs", target, 215);
      expect(p.verdict).toBe("over");
      expect(p.isGood).toBe(false);
      expect(p.remaining).toBe(-15);
    });
  });

  describe("an about figure", () => {
    const target = { grams: 60, op: "eq" as const };

    it("counts a near miss as met — nobody lands a diary on the gram", () => {
      expect(macroProgress("fat", target, 58).verdict).toBe("met");
      expect(macroProgress("fat", target, 62).verdict).toBe("met");
    });

    it("is under when short of the margin", () => {
      const p = macroProgress("fat", target, 40);
      expect(p.verdict).toBe("under");
      expect(p.isGood).toBe(false);
    });

    it("is over when past the margin", () => {
      const p = macroProgress("fat", target, 80);
      expect(p.verdict).toBe("over");
      expect(p.isGood).toBe(false);
    });
  });

  it("the same intake reads differently depending on the operator", () => {
    // The whole point of the feature: 210g against a target of 180 is a good
    // day for a protein floor and a bad one for a carb ceiling.
    expect(macroProgress("protein", { grams: 180, op: "min" }, 210).isGood).toBe(true);
    expect(macroProgress("carbs", { grams: 180, op: "max" }, 210).isGood).toBe(false);
  });
});

describe("describeTarget", () => {
  it("reads each operator back in plain English", () => {
    expect(describeTarget("protein", { grams: 180, op: "min" })).toBe("protein at least 180g");
    expect(describeTarget("carbs", { grams: 200, op: "max" })).toBe("carbs at most 200g");
    expect(describeTarget("fat", { grams: 60, op: "eq" })).toBe("fat about 60g");
  });
});
