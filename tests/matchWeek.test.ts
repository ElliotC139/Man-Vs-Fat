import { describe, expect, it } from "vitest";
import {
  getMatchWeekBoundaries,
  getMatchWeekBoundariesForWeeksAgo,
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
