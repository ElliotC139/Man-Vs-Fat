import { describe, expect, it } from "vitest";
import {
  getMatchWeekBoundaries,
  getMatchWeekBoundariesForWeeksAgo,
  isWholeDayWeek,
  localDayKey,
  matchWeekCalendarDays,
  weightedDaysLogged,
} from "../src/matchWeek";

const TZ = "Europe/London";

// Helper: build a UTC instant from explicit London wall-clock components by
// asserting on the round trip via Intl rather than hardcoding offsets, so
// these tests stay correct across the BST/GMT transition.
function londonTime(iso: string): Date {
  return new Date(iso);
}

describe("getMatchWeekBoundaries", () => {
  it("keeps a Tuesday afternoon entry in the week that started the prior Monday", () => {
    // 2026-06-23 is a Tuesday.
    const { start, end } = getMatchWeekBoundaries(londonTime("2026-06-23T12:00:00Z"), TZ);
    expect(start.toISOString()).toBe(new Date("2026-06-22T17:00:00+01:00").toISOString());
    expect(end.toISOString()).toBe(new Date("2026-06-29T17:00:00+01:00").toISOString());
  });

  it("puts a Monday 16:59 entry in the closing week, not the new one", () => {
    // 2026-06-22 is a Monday.
    const { start, end } = getMatchWeekBoundaries(londonTime("2026-06-22T15:59:00Z"), TZ); // 16:59 BST
    expect(start.toISOString()).toBe(new Date("2026-06-15T17:00:00+01:00").toISOString());
    expect(end.toISOString()).toBe(new Date("2026-06-22T17:00:00+01:00").toISOString());
  });

  it("puts a Monday 17:00 entry in the new week", () => {
    const { start, end } = getMatchWeekBoundaries(londonTime("2026-06-22T16:00:00Z"), TZ); // 17:00 BST exactly
    expect(start.toISOString()).toBe(new Date("2026-06-22T17:00:00+01:00").toISOString());
    expect(end.toISOString()).toBe(new Date("2026-06-29T17:00:00+01:00").toISOString());
  });

  it("puts a Monday 17:01 entry in the new week", () => {
    const { start } = getMatchWeekBoundaries(londonTime("2026-06-22T16:01:00Z"), TZ);
    expect(start.toISOString()).toBe(new Date("2026-06-22T17:00:00+01:00").toISOString());
  });

  it("handles a Sunday correctly (last day of the closing week)", () => {
    // 2026-06-28 is a Sunday, in the week that started 2026-06-22.
    const { start, end } = getMatchWeekBoundaries(londonTime("2026-06-28T10:00:00Z"), TZ);
    expect(start.toISOString()).toBe(new Date("2026-06-22T17:00:00+01:00").toISOString());
    expect(end.toISOString()).toBe(new Date("2026-06-29T17:00:00+01:00").toISOString());
  });

  it("is stable across the GMT/BST spring-forward transition (29 Mar 2026)", () => {
    // 2026-03-30 is a Monday; clocks went forward on 2026-03-29.
    const before = getMatchWeekBoundaries(londonTime("2026-03-30T15:00:00Z"), TZ); // 16:00 BST, before boundary
    const after = getMatchWeekBoundaries(londonTime("2026-03-30T16:30:00Z"), TZ); // 17:30 BST, after boundary
    // Still-closing week started the previous Monday while GMT was in effect.
    expect(before.start.toISOString()).toBe(new Date("2026-03-23T17:00:00+00:00").toISOString());
    expect(before.end.toISOString()).toBe(new Date("2026-03-30T17:00:00+01:00").toISOString());
    // New week starts this Monday, now under BST.
    expect(after.start.toISOString()).toBe(new Date("2026-03-30T17:00:00+01:00").toISOString());
    expect(after.end.toISOString()).toBe(new Date("2026-04-06T17:00:00+01:00").toISOString());
  });

  it("is stable across the GMT/BST autumn-back transition (25 Oct 2026)", () => {
    // 2026-10-26 is a Monday; clocks go back 2026-10-25, so this Monday is GMT (+00:00).
    const { start, end } = getMatchWeekBoundaries(londonTime("2026-10-26T17:30:00Z"), TZ); // 17:30 GMT, after boundary
    expect(start.toISOString()).toBe(new Date("2026-10-26T17:00:00+00:00").toISOString());
    expect(end.toISOString()).toBe(new Date("2026-11-02T17:00:00+00:00").toISOString());
  });

  it("produces consecutive, non-overlapping weeks", () => {
    const weekOne = getMatchWeekBoundaries(londonTime("2026-06-23T12:00:00Z"), TZ);
    const weekTwo = getMatchWeekBoundaries(londonTime("2026-06-30T12:00:00Z"), TZ);
    expect(weekOne.end.toISOString()).toBe(weekTwo.start.toISOString());
  });
});

describe("getMatchWeekBoundaries with a custom week start", () => {
  // weekday 2 = Wednesday (0 = Monday), 09:00.
  const WED_9AM = { weekday: 2, hour: 9, minute: 0 };

  it("keeps a Thursday entry in the week that started the prior Wednesday", () => {
    // 2026-06-25 is a Thursday.
    const { start, end } = getMatchWeekBoundaries(londonTime("2026-06-25T12:00:00Z"), TZ, WED_9AM);
    expect(start.toISOString()).toBe(new Date("2026-06-24T09:00:00+01:00").toISOString());
    expect(end.toISOString()).toBe(new Date("2026-07-01T09:00:00+01:00").toISOString());
  });

  it("puts a Wednesday 08:59 entry in the closing week, not the new one", () => {
    const { start, end } = getMatchWeekBoundaries(londonTime("2026-06-24T07:59:00Z"), TZ, WED_9AM); // 08:59 BST
    expect(start.toISOString()).toBe(new Date("2026-06-17T09:00:00+01:00").toISOString());
    expect(end.toISOString()).toBe(new Date("2026-06-24T09:00:00+01:00").toISOString());
  });

  it("puts a Wednesday 09:00 entry in the new week", () => {
    const { start, end } = getMatchWeekBoundaries(londonTime("2026-06-24T08:00:00Z"), TZ, WED_9AM); // 09:00 BST exactly
    expect(start.toISOString()).toBe(new Date("2026-06-24T09:00:00+01:00").toISOString());
    expect(end.toISOString()).toBe(new Date("2026-07-01T09:00:00+01:00").toISOString());
  });

  it("doesn't affect the default Monday 17:00 boundaries for a different user", () => {
    const customResult = getMatchWeekBoundaries(londonTime("2026-06-23T12:00:00Z"), TZ, WED_9AM);
    const defaultResult = getMatchWeekBoundaries(londonTime("2026-06-23T12:00:00Z"), TZ);
    expect(customResult.start.toISOString()).not.toBe(defaultResult.start.toISOString());
  });

  it("steps back whole weeks for getMatchWeekBoundariesForWeeksAgo too", () => {
    const reference = londonTime("2026-06-25T12:00:00Z"); // Thursday, in the week starting 2026-06-24
    const oneWeekAgo = getMatchWeekBoundariesForWeeksAgo(reference, 1, TZ, WED_9AM);
    expect(oneWeekAgo.start.toISOString()).toBe(new Date("2026-06-17T09:00:00+01:00").toISOString());
    expect(oneWeekAgo.end.toISOString()).toBe(new Date("2026-06-24T09:00:00+01:00").toISOString());
  });
});

describe("localDayKey", () => {
  it("groups by the local calendar date, not the UTC one", () => {
    // 23:30 UTC on 21 June 2026 is past midnight (00:30) on 22 June in London (BST, +1h).
    expect(localDayKey(londonTime("2026-06-21T23:30:00Z"), TZ)).toBe("2026-06-22");
  });
});

describe("getMatchWeekBoundariesForWeeksAgo", () => {
  const reference = londonTime("2026-06-23T12:00:00Z"); // Tuesday, in the week starting 2026-06-22

  it("returns the same boundaries as the current week when weeksAgo is 0", () => {
    const current = getMatchWeekBoundaries(reference, TZ);
    const result = getMatchWeekBoundariesForWeeksAgo(reference, 0, TZ);
    expect(result.start.toISOString()).toBe(current.start.toISOString());
    expect(result.end.toISOString()).toBe(current.end.toISOString());
  });

  it("steps back whole weeks", () => {
    const oneWeekAgo = getMatchWeekBoundariesForWeeksAgo(reference, 1, TZ);
    expect(oneWeekAgo.start.toISOString()).toBe(new Date("2026-06-15T17:00:00+01:00").toISOString());
    expect(oneWeekAgo.end.toISOString()).toBe(new Date("2026-06-22T17:00:00+01:00").toISOString());

    const twoWeeksAgo = getMatchWeekBoundariesForWeeksAgo(reference, 2, TZ);
    expect(twoWeeksAgo.start.toISOString()).toBe(new Date("2026-06-08T17:00:00+01:00").toISOString());
    expect(twoWeeksAgo.end.toISOString()).toBe(new Date("2026-06-15T17:00:00+01:00").toISOString());
  });

  it("treats negative weeksAgo the same as 0 (no peeking into the future)", () => {
    const current = getMatchWeekBoundaries(reference, TZ);
    const result = getMatchWeekBoundariesForWeeksAgo(reference, -3, TZ);
    expect(result.start.toISOString()).toBe(current.start.toISOString());
    expect(result.end.toISOString()).toBe(current.end.toISOString());
  });

  it("stays correct stepping back across the GMT/BST autumn transition", () => {
    // Week of 2026-11-02 (GMT) stepped back one week lands on 2026-10-26, which
    // opens under GMT too but the clocks went back inside the *prior* week.
    const lateReference = londonTime("2026-11-04T12:00:00Z");
    const oneWeekAgo = getMatchWeekBoundariesForWeeksAgo(lateReference, 1, TZ);
    expect(oneWeekAgo.start.toISOString()).toBe(new Date("2026-10-26T17:00:00+00:00").toISOString());
    expect(oneWeekAgo.end.toISOString()).toBe(new Date("2026-11-02T17:00:00+00:00").toISOString());
  });
});

describe("matchWeekCalendarDays", () => {
  it("lists the 8 calendar dates a Mon 17:00 -> Mon 17:00 week touches", () => {
    const { start } = getMatchWeekBoundaries(londonTime("2026-06-23T12:00:00Z"), TZ);
    expect(matchWeekCalendarDays(start, TZ)).toEqual([
      "2026-06-22",
      "2026-06-23",
      "2026-06-24",
      "2026-06-25",
      "2026-06-26",
      "2026-06-27",
      "2026-06-28",
      "2026-06-29",
    ]);
  });
});

describe("weightedDaysLogged", () => {
  const { start } = getMatchWeekBoundaries(londonTime("2026-06-23T12:00:00Z"), TZ);
  // matchWeekCalendarDays(start, TZ) = [2026-06-22 (opening Mon), ...06-23..06-28, 2026-06-29 (closing Mon)]

  it("counts a full mid-week day as 1", () => {
    expect(weightedDaysLogged(["2026-06-24"], start, TZ)).toBe(1);
  });

  it("counts the opening Monday as half a day", () => {
    expect(weightedDaysLogged(["2026-06-22"], start, TZ)).toBe(0.5);
  });

  it("counts the closing Monday as half a day", () => {
    expect(weightedDaysLogged(["2026-06-29"], start, TZ)).toBe(0.5);
  });

  it("sums the two Monday halves to a single day when both are logged", () => {
    expect(weightedDaysLogged(["2026-06-22", "2026-06-29"], start, TZ)).toBe(1);
  });

  it("sums to 7 (not 8) when every day of the week is logged", () => {
    const allDays = matchWeekCalendarDays(start, TZ);
    expect(weightedDaysLogged(allDays, start, TZ)).toBe(7);
  });
});

describe("whole-day weeks", () => {
  // A week starting at local midnight runs Mon 00:00 -> Mon 00:00, which is
  // Monday to Sunday inclusive: seven whole days, no split ones.
  const WHOLE_DAY_START = { weekday: 0, hour: 0, minute: 0 };

  it("spans exactly seven calendar days", () => {
    const { start, end } = getMatchWeekBoundaries(
      new Date("2026-08-26T12:00:00Z"),
      TZ,
      WHOLE_DAY_START,
    );
    const days = matchWeekCalendarDays(start, TZ);

    expect(days).toHaveLength(7);
    expect(days[0]).toBe("2026-08-24");
    expect(days[6]).toBe("2026-08-30");
    // The following Monday belongs entirely to the next week.
    expect(days).not.toContain("2026-08-31");
    expect(localDayKey(new Date(end.getTime() - 1000), TZ)).toBe("2026-08-30");
  });

  it("counts every logged day as a whole one", () => {
    const { start } = getMatchWeekBoundaries(new Date("2026-08-26T12:00:00Z"), TZ, WHOLE_DAY_START);
    const days = matchWeekCalendarDays(start, TZ);

    // Halving the edges here would report a fully logged week as 6.
    expect(weightedDaysLogged(days, start, TZ)).toBe(7);
    expect(weightedDaysLogged([days[0]!], start, TZ)).toBe(1);
    expect(weightedDaysLogged([days[6]!], start, TZ)).toBe(1);
  });

  it("puts midnight itself in the opening day, not the closing one", () => {
    const { start, end } = getMatchWeekBoundaries(
      new Date("2026-08-24T00:00:00+01:00"),
      TZ,
      WHOLE_DAY_START,
    );
    // 00:00 on the Monday opens the week rather than closing the one before.
    expect(start.toISOString()).toBe("2026-08-23T23:00:00.000Z");
    expect(localDayKey(start, TZ)).toBe("2026-08-24");
    expect(end.toISOString()).toBe("2026-08-30T23:00:00.000Z");
  });

  it("leaves a mid-day week counting eight dates and two half days", () => {
    // The existing behaviour has to be untouched — this is an added option,
    // not a replacement.
    const { start } = getMatchWeekBoundaries(new Date("2026-08-26T12:00:00Z"), TZ, { weekday: 0, hour: 17, minute: 0 });
    const days = matchWeekCalendarDays(start, TZ);

    expect(days).toHaveLength(8);
    expect(weightedDaysLogged(days, start, TZ)).toBe(7);
    expect(weightedDaysLogged([days[0]!], start, TZ)).toBe(0.5);
  });

  it("identifies which kind of week a start instant belongs to", () => {
    const whole = getMatchWeekBoundaries(new Date("2026-08-26T12:00:00Z"), TZ, WHOLE_DAY_START);
    const midDay = getMatchWeekBoundaries(new Date("2026-08-26T12:00:00Z"), TZ, { weekday: 0, hour: 17, minute: 0 });
    expect(isWholeDayWeek(whole.start, TZ)).toBe(true);
    expect(isWholeDayWeek(midDay.start, TZ)).toBe(false);
  });
});
