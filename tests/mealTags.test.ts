import { describe, expect, it } from "vitest";

import { DEFAULT_MEAL_TAG_NAMES, readMealTagNames, writeMealTagNames } from "../src/mealTags";

describe("readMealTagNames", () => {
  it("falls back to the built-in names when nothing is stored", () => {
    expect(readMealTagNames(null)).toEqual(DEFAULT_MEAL_TAG_NAMES);
    expect(readMealTagNames("")).toEqual(DEFAULT_MEAL_TAG_NAMES);
  });

  it("overlays only the slots that were renamed", () => {
    expect(readMealTagNames('{"dinner":"Tea"}')).toEqual({
      ...DEFAULT_MEAL_TAG_NAMES,
      dinner: "Tea",
    });
  });

  it("never fails on junk, because a label is not worth an error", () => {
    // Each of these has been a real shape in a text column at some point:
    // truncated JSON, the wrong type, an array, a key nobody knows.
    for (const stored of ['{"dinner"', '"just a string"', "[1,2,3]", '{"brunch":"Brunch"}', "null"]) {
      expect(readMealTagNames(stored)).toEqual(DEFAULT_MEAL_TAG_NAMES);
    }
  });

  it("ignores a blank rename rather than leaving a button with no words on it", () => {
    expect(readMealTagNames('{"lunch":"   "}').lunch).toBe("Lunch");
  });

  it("trims a name that would overflow the button", () => {
    const long = "x".repeat(60);
    expect(readMealTagNames(JSON.stringify({ snack: long })).snack).toHaveLength(20);
  });
});

describe("writeMealTagNames", () => {
  it("stores only what differs from the built-in name", () => {
    expect(writeMealTagNames({ breakfast: "Breakfast", dinner: "Tea" })).toBe('{"dinner":"Tea"}');
  });

  it("stores nothing at all when every slot is back to its default", () => {
    // Renaming a slot and changing your mind should leave a clean row, not a
    // frozen copy of whatever the defaults were on the day.
    expect(writeMealTagNames(DEFAULT_MEAL_TAG_NAMES)).toBeNull();
    expect(writeMealTagNames({})).toBeNull();
    expect(writeMealTagNames(null)).toBeNull();
  });

  it("round-trips through the reader", () => {
    const names = { ...DEFAULT_MEAL_TAG_NAMES, dinner: "Tea", snack: "Nibbles" };
    expect(readMealTagNames(writeMealTagNames(names))).toEqual(names);
  });
});
