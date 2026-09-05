import { describe, expect, it, vi } from "vitest";

vi.mock("../src/config", () => ({
  config: { TIMEZONE: "Europe/London" },
}));

import { timestampOnLocalDay } from "../src/entryTiming";
import { getLocalParts } from "../src/matchWeek";

const TZ = "Europe/London";

describe("timestampOnLocalDay", () => {
  it("moves the entry to the chosen day and keeps the current time of day", () => {
    // Logged at 14:30 today while looking back at the 2nd: it belongs to the
    // 2nd, at 14:30 — not at midnight, which is both the wrong meal slot and,
    // on a rollover day, the wrong match week.
    const now = new Date("2026-09-05T13:30:00Z"); // 14:30 London
    const moved = timestampOnLocalDay("2026-09-02", now);
    const parts = getLocalParts(moved, TZ);

    expect([parts.year, parts.month, parts.day]).toEqual([2026, 9, 2]);
    expect([parts.hour, parts.minute]).toEqual([14, 30]);
  });

  it("uses the meal's own hour when a meal was picked", () => {
    // Tagging it breakfast means breakfast time, not whenever it was typed —
    // otherwise a breakfast logged at 11pm lands in the evening.
    const now = new Date("2026-09-05T22:00:00Z");
    const parts = getLocalParts(timestampOnLocalDay("2026-09-02", now, "breakfast"), TZ);

    expect([parts.year, parts.month, parts.day]).toEqual([2026, 9, 2]);
    expect(parts.hour).toBe(8);
    expect(parts.minute).toBe(0);
  });

  it("keeps the local day across the BST/GMT boundary", () => {
    // A naive UTC offset puts a 00:30 London entry on the previous day. The
    // clocks go back on 25 October 2026, so a day either side of it is where
    // that goes wrong.
    const now = new Date("2026-10-20T23:30:00Z"); // 00:30 London, the 21st
    const parts = getLocalParts(timestampOnLocalDay("2026-10-26", now), TZ);

    expect([parts.year, parts.month, parts.day]).toEqual([2026, 10, 26]);
    expect([parts.hour, parts.minute]).toEqual([0, 30]);
  });

  it("hands back the original moment rather than guessing at a malformed date", () => {
    const now = new Date("2026-09-05T13:30:00Z");
    expect(timestampOnLocalDay("not-a-date", now)).toBe(now);
  });
});
