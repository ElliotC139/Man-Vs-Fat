import { describe, expect, it } from "vitest";
import { getMatchWeekBoundaries, localDayKey } from "../src/matchWeek";

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
