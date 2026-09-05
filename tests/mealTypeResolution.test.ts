import { describe, expect, it } from "vitest";

import { MEAL_TYPES, inferMealType } from "../src/mealType";
import { readMealTagNames } from "../src/mealTags";

/**
 * The meal slot has three states on the wire and they mean different things.
 * Collapsing any two of them is what made the tag meaningless: a blank choice
 * fell through to the clock, so picking "no meal" filed the entry under
 * whatever hour it happened to be.
 *
 *   undefined — nobody was asked; infer it from the time of day
 *   null      — asked, and the answer was none; keep that
 *   a slot    — asked, and that is the answer
 *
 * The routes all share the same shape, so this pins the rule itself.
 */
function resolve(chosen: string | null | undefined, hour: number): string | null {
  if (chosen === undefined) return inferMealType(hour);
  return chosen;
}

describe("resolving a meal slot", () => {
  it("infers from the clock when nobody was asked", () => {
    // Meal tags off: unchanged from how the diary has always behaved.
    expect(resolve(undefined, 8)).toBe("breakfast");
    expect(resolve(undefined, 13)).toBe("lunch");
    expect(resolve(undefined, 19)).toBe("dinner");
    expect(resolve(undefined, 23)).toBe("snack");
  });

  it("keeps an explicit none instead of falling back to the clock", () => {
    // The bug this exists to stop: a 4pm coffee tagged "no meal" coming back
    // as a snack because the column had to hold something.
    expect(resolve(null, 16)).toBeNull();
    expect(resolve(null, 8)).toBeNull();
  });

  it("keeps a chosen slot even when the clock disagrees", () => {
    // Logging last night's dinner this morning must stay dinner.
    expect(resolve("dinner", 9)).toBe("dinner");
    expect(resolve("breakfast", 22)).toBe("breakfast");
  });
});

describe("the tag a row displays", () => {
  it("uses the renamed label for every slot", () => {
    const names = readMealTagNames('{"dinner":"Tea","snack":"Nibbles"}');
    expect(MEAL_TYPES.map((slot) => names[slot])).toEqual([
      "Breakfast",
      "Lunch",
      "Tea",
      "Nibbles",
    ]);
  });
});
