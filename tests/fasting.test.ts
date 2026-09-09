import { describe, expect, it } from "vitest";
import { fastingState } from "../src/fasting";

/**
 * All times are ms since epoch on a fixed day, so the states can be checked
 * without waiting for a clock. 16:8 throughout — an 8-hour window is a
 * 16-hour fast, which is the whole point of deriving one from the other.
 */
const DAY = Date.UTC(2026, 8, 9);
const at = (hour: number, minute = 0) => DAY + hour * 3600_000 + minute * 60_000;
const yesterday = (hour: number) => at(hour) - 24 * 3600_000;

describe("fastingState", () => {
  it("waits when nothing has ever been logged", () => {
    const state = fastingState({ windowHours: 8, now: at(9), entryTimes: [], lastEntryBefore: null });
    expect(state).toEqual({ phase: "waiting", fastTargetMin: 960 });
  });

  it("counts down the window while it is open", () => {
    const state = fastingState({ windowHours: 8, now: at(14), entryTimes: [at(12)], lastEntryBefore: null });
    expect(state).toMatchObject({ phase: "eating", leftMin: 360, progress: 0.25 });
  });

  it("keeps the window open on the first meal, not the latest one", () => {
    // Eating again at 15:00 must not push the close from 20:00 to 23:00.
    const state = fastingState({ windowHours: 8, now: at(16), entryTimes: [at(12), at(15)], lastEntryBefore: null });
    expect(state).toMatchObject({ phase: "eating", closesAt: at(20) });
  });

  it("switches to the fast once the window has closed", () => {
    const state = fastingState({ windowHours: 8, now: at(22), entryTimes: [at(12), at(19)], lastEntryBefore: null });
    // Measured from the last thing eaten (19:00), not from when the window
    // closed (20:00) — three hours, not two.
    expect(state).toMatchObject({ phase: "fasting", since: at(19), elapsedMin: 180, remainingMin: 780, metTarget: false });
  });

  it("carries a fast across midnight", () => {
    // The case the old card could not show at all: nothing logged today, so
    // the fast has to be measured from yesterday evening.
    const state = fastingState({ windowHours: 8, now: at(9), entryTimes: [], lastEntryBefore: yesterday(20) });
    expect(state).toMatchObject({ phase: "fasting", elapsedMin: 780, remainingMin: 180 });
    expect(state).toMatchObject({ progress: 780 / 960 });
  });

  it("says when the target has been reached", () => {
    const state = fastingState({ windowHours: 8, now: at(13), entryTimes: [], lastEntryBefore: yesterday(20) });
    expect(state).toMatchObject({ phase: "fasting", metTarget: true, remainingMin: 0, progress: 1 });
  });

  it("restarts the fast from a meal eaten after the window closed", () => {
    const state = fastingState({ windowHours: 8, now: at(23), entryTimes: [at(10), at(22)], lastEntryBefore: null });
    expect(state).toMatchObject({ phase: "fasting", since: at(22), elapsedMin: 60 });
  });

  it("never reports a negative or over-full fast", () => {
    const state = fastingState({ windowHours: 8, now: at(9), entryTimes: [], lastEntryBefore: at(10) });
    expect(state).toMatchObject({ phase: "fasting", elapsedMin: 0, progress: 0 });
  });
});
