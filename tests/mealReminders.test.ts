import { describe, expect, it } from "vitest";
import {
  anyDueAt,
  readMealReminders,
  slotsDueAt,
  writeMealReminders,
} from "../src/mealReminders";

describe("reading the stored hours", () => {
  it("reads nothing from an account that has never set one", () => {
    expect(readMealReminders(null)).toEqual({});
    expect(readMealReminders(undefined)).toEqual({});
    expect(readMealReminders("")).toEqual({});
  });

  it("reads the hours that are set and leaves the rest out", () => {
    expect(readMealReminders(JSON.stringify({ breakfast: 8, dinner: 19 }))).toEqual({
      breakfast: 8,
      dinner: 19,
    });
  });

  it("treats an unreadable column as no reminders rather than throwing", () => {
    // The worst a bad row should cost is a nudge that doesn't arrive — never a
    // failed request, and never a job that stops for everyone else too.
    expect(readMealReminders("not json")).toEqual({});
    expect(readMealReminders("[8, 13]")).toEqual({});
    expect(readMealReminders("null")).toEqual({});
  });

  it("drops a value that isn't an hour of the day", () => {
    const stored = JSON.stringify({ breakfast: 24, lunch: -1, dinner: 12.5, snack: "19" });
    expect(readMealReminders(stored)).toEqual({});
  });

  it("keeps midnight, which is a real hour", () => {
    // 0 is falsy, and a naive truthiness check would silently lose it.
    expect(readMealReminders(JSON.stringify({ snack: 0 }))).toEqual({ snack: 0 });
  });

  it("ignores a key that isn't one of the four slots", () => {
    expect(readMealReminders(JSON.stringify({ brunch: 11, lunch: 13 }))).toEqual({ lunch: 13 });
  });
});

describe("writing them back", () => {
  it("stores null when every slot is off", () => {
    // An account that turns them all off is stored the same way as one that
    // never set any; there is no third state worth keeping.
    expect(writeMealReminders({})).toBeNull();
    expect(writeMealReminders({ lunch: null, dinner: null })).toBeNull();
    expect(writeMealReminders(null)).toBeNull();
  });

  it("round-trips what was set", () => {
    const stored = writeMealReminders({ breakfast: 8, lunch: null, dinner: 19 });
    expect(readMealReminders(stored)).toEqual({ breakfast: 8, dinner: 19 });
  });

  it("refuses to store an hour that isn't one", () => {
    expect(writeMealReminders({ lunch: 25 })).toBeNull();
  });
});

describe("what is due", () => {
  it("finds the slot set to this hour", () => {
    expect(slotsDueAt({ breakfast: 8, lunch: 13 }, 13)).toEqual(["lunch"]);
  });

  it("finds nothing at an hour nobody chose", () => {
    expect(slotsDueAt({ breakfast: 8, lunch: 13 }, 15)).toEqual([]);
  });

  it("finds both when two slots share an hour", () => {
    // Rare, but "dinner at 19:00, snack at 19:00" is a thing someone can set,
    // and silently dropping one would be worse than sending two.
    expect(slotsDueAt({ dinner: 19, snack: 19 }, 19)).toEqual(["dinner", "snack"]);
  });

  it("answers the cheap question straight off the column", () => {
    expect(anyDueAt(JSON.stringify({ lunch: 13 }), 13)).toBe(true);
    expect(anyDueAt(JSON.stringify({ lunch: 13 }), 14)).toBe(false);
    expect(anyDueAt(null, 13)).toBe(false);
  });
});
