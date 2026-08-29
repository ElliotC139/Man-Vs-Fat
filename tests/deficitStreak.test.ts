import { describe, expect, it } from "vitest";
import { computeDeficitStreak, type DayVerdict } from "../src/deficitStreak";

/** "2026-08-01:1 2026-08-02:0 2026-08-03:?" → verdicts, for readability. */
function days(spec: string): DayVerdict[] {
  return spec
    .trim()
    .split(/\s+/)
    .map((token) => {
      const [date, mark] = token.split(":");
      return { date: date!, deficit: mark === "?" ? null : mark === "1" };
    });
}

/** A run of consecutive dates from 2026-08-01, one char per day. */
function fromMarks(marks: string): DayVerdict[] {
  return [...marks].map((mark, i) => ({
    date: `2026-08-${String(i + 1).padStart(2, "0")}`,
    deficit: mark === "?" ? null : mark === "1",
  }));
}

describe("computeDeficitStreak", () => {
  it("reports nothing at all with no days", () => {
    const result = computeDeficitStreak([]);
    expect(result).toEqual({ current: 0, currentStartDate: null, best: null, judgedDays: 0 });
  });

  it("counts a run that is still going as the current streak", () => {
    const result = computeDeficitStreak(fromMarks("00111"));
    expect(result.current).toBe(3);
    expect(result.currentStartDate).toBe("2026-08-03");
    expect(result.best).toEqual({ days: 3, startDate: "2026-08-03", endDate: "2026-08-05" });
  });

  it("reports no current streak when the last day went over", () => {
    const result = computeDeficitStreak(fromMarks("11110"));
    expect(result.current).toBe(0);
    expect(result.currentStartDate).toBeNull();
    // The record still stands even though it has ended.
    expect(result.best).toEqual({ days: 4, startDate: "2026-08-01", endDate: "2026-08-04" });
  });

  it("keeps the longest earlier run as the best when a later one is shorter", () => {
    const result = computeDeficitStreak(fromMarks("111110011"));
    expect(result.best).toEqual({ days: 5, startDate: "2026-08-01", endDate: "2026-08-05" });
    expect(result.current).toBe(2);
  });

  it("extends the record's end date while the record run is still growing", () => {
    const result = computeDeficitStreak(fromMarks("0111"));
    expect(result.best).toEqual({ days: 3, startDate: "2026-08-02", endDate: "2026-08-04" });
  });

  it("breaks the run on a day it can't judge, rather than skipping it", () => {
    // Otherwise a fortnight of not logging would silently weld the runs
    // either side of it into one long streak.
    const result = computeDeficitStreak(fromMarks("111?111"));
    expect(result.best!.days).toBe(3);
    expect(result.current).toBe(3);
    expect(result.currentStartDate).toBe("2026-08-05");
  });

  it("counts only the days it could actually judge", () => {
    expect(computeDeficitStreak(fromMarks("1?0?1")).judgedDays).toBe(3);
  });

  it("treats a whole history of deficits as one unbroken run", () => {
    const result = computeDeficitStreak(fromMarks("1111111"));
    expect(result.current).toBe(7);
    expect(result.best).toEqual({ days: 7, startDate: "2026-08-01", endDate: "2026-08-07" });
  });

  it("counts a Monday once, not once per half of the match week it straddles", () => {
    // A match week runs Monday evening to Monday evening, so the same
    // Monday closes one week and opens the next. Verdicts arrive already
    // keyed by calendar day, so the Monday appears once — this guards the
    // contract that callers must not pass it twice.
    const monday = "2026-08-03";
    const verdicts = days(`2026-08-01:1 2026-08-02:1 ${monday}:1 2026-08-04:1`);
    const result = computeDeficitStreak(verdicts);
    expect(result.current).toBe(4);
    expect(result.best!.days).toBe(4);
  });

  it("doesn't let a half-day Monday logged twice inflate the count", () => {
    // The failure this protects against: iterating match weeks yields the
    // boundary Monday in both, and the morning half — breakfast only —
    // reads as a deficit while the evening half reads as one too, turning
    // one real day into two.
    const doubleCounted = days("2026-08-03:1 2026-08-03:1 2026-08-04:1");
    const deduped = Array.from(
      new Map(doubleCounted.map((d) => [d.date, d])).values(),
    );
    expect(computeDeficitStreak(deduped).current).toBe(2);
    expect(computeDeficitStreak(doubleCounted).current).toBe(3);
  });
});
