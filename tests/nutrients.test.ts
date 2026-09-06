import { describe, expect, it } from "vitest";
import {
  clampNutrients,
  isNetCarbs,
  netCarbsOf,
  readDiaryFields,
  resolveNutrientTargets,
  scaleNutrients,
  sumNutrients,
  writeDiaryFields,
} from "../src/nutrients";

describe("which figures the diary shows", () => {
  it("shows the three it always has when nothing has been chosen", () => {
    expect(readDiaryFields(null)).toEqual(["protein", "carbs", "fat"]);
    expect(readDiaryFields({})).toEqual(["protein", "carbs", "fat"]);
    expect(readDiaryFields({ nutrientsShown: null })).toEqual(["protein", "carbs", "fat"]);
  });

  it("keeps the canonical order rather than the order they were picked in", () => {
    // Carbs sits before fat on every label, and a row that reordered itself
    // to match the sequence of taps in a settings screen would be unreadable.
    expect(readDiaryFields({ nutrientsShown: '["salt","protein","fat"]' })).toEqual([
      "protein",
      "fat",
      "salt",
    ]);
  });

  it("drops a field it doesn't recognise instead of rejecting the whole choice", () => {
    // A field removed in a later version must not cost someone the rest of
    // their settings.
    expect(readDiaryFields({ nutrientsShown: '["protein","selenium","salt"]' })).toEqual([
      "protein",
      "salt",
    ]);
  });

  it("falls back to the default rather than showing nothing at all", () => {
    // A diary with no figures under an entry is a bug, not a preference.
    expect(readDiaryFields({ nutrientsShown: "[]" })).toEqual(["protein", "carbs", "fat"]);
    expect(readDiaryFields({ nutrientsShown: "not json" })).toEqual(["protein", "carbs", "fat"]);
    expect(readDiaryFields({ nutrientsShown: '{"protein":true}' })).toEqual(["protein", "carbs", "fat"]);
  });

  it("round-trips a chosen set through the column", () => {
    const stored = writeDiaryFields(["fibre", "protein", "netCarbs"]);
    expect(readDiaryFields({ nutrientsShown: stored })).toEqual(["protein", "netCarbs", "fibre"]);
  });

  it("stores the default rather than an empty list", () => {
    expect(JSON.parse(writeDiaryFields([]))).toEqual(["protein", "carbs", "fat"]);
  });
});

describe("net carbs", () => {
  it("is off unless asked for, so the diary keeps meaning the label's figure", () => {
    expect(isNetCarbs(null)).toBe(false);
    expect(isNetCarbs({ carbMode: null })).toBe(false);
    expect(isNetCarbs({ carbMode: "total" })).toBe(false);
    expect(isNetCarbs({ carbMode: "net" })).toBe(true);
  });

  it("subtracts fibre from carbohydrate", () => {
    expect(netCarbsOf(30, 8)).toBe(22);
  });

  it("leaves the carbs alone when no fibre figure was ever worked out", () => {
    // The alternative — treating an absent fibre figure as zero — would make
    // every entry logged before fibre existed look like pure net carbs, which
    // for a bowl of lentils is wrong in the direction that discourages
    // eating them.
    expect(netCarbsOf(30, null)).toBe(30);
    expect(netCarbsOf(30, undefined)).toBe(30);
  });

  it("is unknown when the carbs are", () => {
    expect(netCarbsOf(null, 8)).toBeNull();
  });

  it("never goes below zero on a food whose fibre figure exceeds its carbs", () => {
    // Rounding on a label can do this, and negative carbohydrate is not a
    // thing that can be eaten.
    expect(netCarbsOf(5, 7)).toBe(0);
  });
});

describe("nutrient targets", () => {
  it("reads fibre as a floor and the other three as ceilings by default", () => {
    // They are genuinely wanted opposite ways round: fibre is the one you're
    // trying to reach.
    const targets = resolveNutrientTargets({
      fibreTargetG: 30,
      sugarTargetG: 30,
      satFatTargetG: 20,
      saltTargetG: 6,
    });
    expect(targets.fibre).toEqual({ grams: 30, op: "min" });
    expect(targets.sugar).toEqual({ grams: 30, op: "max" });
    expect(targets.satFat).toEqual({ grams: 20, op: "max" });
    expect(targets.salt).toEqual({ grams: 6, op: "max" });
  });

  it("honours a comparison that was set explicitly", () => {
    expect(resolveNutrientTargets({ saltTargetG: 6, saltOp: "eq" }).salt).toEqual({
      grams: 6,
      op: "eq",
    });
  });

  it("treats zero and absent alike as untracked", () => {
    // A 0g target can only ever read "over", which is a row worth nobody's
    // attention.
    const targets = resolveNutrientTargets({ fibreTargetG: 0 });
    expect(targets.fibre).toBeNull();
    expect(targets.salt).toBeNull();
  });
});

describe("adding up a day", () => {
  it("counts a genuine zero as known", () => {
    // Water is legitimately 0/0/0/0, and calling that missing would flag a
    // complete day forever.
    const totals = sumNutrients([{ fibreG: 0, sugarG: 0, satFatG: 0, saltG: 0 }]);
    expect(totals.knownEntries).toBe(1);
    expect(totals.unknownEntries).toBe(0);
  });

  it("counts an entry with none of the four as unknown, and leaves it out", () => {
    const totals = sumNutrients([
      { fibreG: 4, sugarG: 10, satFatG: 2, saltG: 0.8 },
      { proteinG: 20 } as never,
    ]);
    expect(totals.fibre).toBe(4);
    expect(totals.unknownEntries).toBe(1);
    expect(totals.knownEntries).toBe(1);
  });

  it("counts a partly-filled entry as known, since one figure is still a figure", () => {
    const totals = sumNutrients([{ saltG: 1.2 }]);
    expect(totals.knownEntries).toBe(1);
    expect(totals.salt).toBe(1.2);
    expect(totals.fibre).toBe(0);
  });

  it("keeps the totals to one decimal rather than accumulating float noise", () => {
    const totals = sumNutrients([{ saltG: 0.1 }, { saltG: 0.2 }]);
    expect(totals.salt).toBe(0.3);
  });
});

describe("scaling with the quantity", () => {
  it("scales every figure that has one and leaves the rest unknown", () => {
    expect(scaleNutrients({ fibreG: 3, sugarG: 10, satFatG: null, saltG: 0.4 }, 2)).toEqual({
      fibreG: 6,
      sugarG: 20,
      satFatG: null,
      saltG: 0.8,
    });
  });
});

describe("keeping a breakdown inside the figure it breaks down", () => {
  it("caps saturated fat at the fat it is part of", () => {
    // A model asked for eight numbers at once will occasionally return more
    // saturated fat than fat, which is not a thing a food can contain.
    const capped = clampNutrients({ satFatG: 20 }, { carbs: null, fat: 12 });
    expect(capped.satFatG).toBe(12);
  });

  it("caps sugar and fibre at the carbohydrate", () => {
    const capped = clampNutrients({ sugarG: 40, fibreG: 30 }, { carbs: 25, fat: null });
    expect(capped.sugarG).toBe(25);
    expect(capped.fibreG).toBe(25);
  });

  it("leaves a figure alone when its parent is unknown", () => {
    // No ceiling to cap against is not the same as a ceiling of zero.
    const capped = clampNutrients({ satFatG: 9 }, { carbs: null, fat: null });
    expect(capped.satFatG).toBe(9);
  });

  it("leaves salt alone, since nothing on the label contains it", () => {
    const capped = clampNutrients({ saltG: 2.4 }, { carbs: 0, fat: 0 });
    expect(capped.saltG).toBe(2.4);
  });

  it("passes an absent figure through as absent rather than as zero", () => {
    expect(clampNutrients({}, { carbs: 50, fat: 20 })).toEqual({
      fibreG: null,
      sugarG: null,
      satFatG: null,
      saltG: null,
    });
  });
});
