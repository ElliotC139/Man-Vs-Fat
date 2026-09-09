import { describe, expect, it } from "vitest";
import { SCORED, shouldWriteScore } from "../src/whoop/scoreState";

/**
 * The rule that stops a hand-edited sleep wiping a day's recovery and burn:
 * WHOOP returns PENDING_SCORE with null figures while it recalculates an
 * edited night, and those nulls must not land on top of a good score.
 */
describe("shouldWriteScore", () => {
  it("writes a scored record over anything", () => {
    expect(shouldWriteScore(SCORED, SCORED)).toBe(true);
    expect(shouldWriteScore("PENDING_SCORE", SCORED)).toBe(true);
    expect(shouldWriteScore(null, SCORED)).toBe(true);
    expect(shouldWriteScore(undefined, SCORED)).toBe(true);
  });

  it("refuses to write an unscored record over a scored one", () => {
    // This is the bug: editing sleep times in WHOOP re-scores the night, and
    // the pending record used to overwrite the figures with nulls.
    expect(shouldWriteScore(SCORED, "PENDING_SCORE")).toBe(false);
    expect(shouldWriteScore(SCORED, "UNSCORABLE")).toBe(false);
  });

  it("writes an unscored record when nothing better is stored", () => {
    // A first sync, or a night WHOOP has never managed to score — the row
    // still wants to exist, it just has no figures yet.
    expect(shouldWriteScore(null, "PENDING_SCORE")).toBe(true);
    expect(shouldWriteScore(undefined, "UNSCORABLE")).toBe(true);
    expect(shouldWriteScore("PENDING_SCORE", "UNSCORABLE")).toBe(true);
    expect(shouldWriteScore("UNSCORABLE", "PENDING_SCORE")).toBe(true);
  });
});
