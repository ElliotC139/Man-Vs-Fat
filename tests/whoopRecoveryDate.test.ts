import { describe, expect, it, vi } from "vitest";

vi.mock("../src/config", () => ({
  // reconcileAdmin and toPublicUser both read this on every sign-in.
  adminUsernames: [], config: { TIMEZONE: "Europe/London" } }));
vi.mock("../src/db", () => ({ prisma: {} }));
vi.mock("../src/whoop/client", () => ({}));
vi.mock("../src/errorLog", () => ({ recordError: vi.fn() }));

import { recoveryDate } from "../src/whoop/sync";
import { localDayKey } from "../src/matchWeek";

/**
 * Two bugs live here, and the second one is why this file grew.
 *
 * The first: today's recovery scores the cycle that is still running, and a
 * cycle the API hadn't handed over yet used to make the recovery get dropped
 * — so today showed sleep and no recovery, all day, every day.
 *
 * The second: the date came from the calendar day the *cycle* started, while
 * sleep is filed under the day it *ended*. A WHOOP cycle begins at sleep
 * onset, so anyone who falls asleep before midnight had their recovery filed
 * a day before the sleep that produced it, and the two never appeared side by
 * side. Editing sleep times in the WHOOP app is the usual way to notice,
 * because pulling a bedtime back across midnight moves a night from the
 * working case to the broken one.
 *
 * The answers below all reduce to one rule: a recovery belongs to the day you
 * woke up.
 */
describe("which day a recovery belongs to", () => {
  const created = new Date("2026-09-04T05:31:00Z");

  it("takes the day from the sleep that opened the cycle, above all else", () => {
    // The whole fix. Sleep is bucketed by when it ended, so taking the date
    // from the same instant means the two cannot land on different days.
    const cycleStart = new Date("2026-09-03T22:15:00Z"); // 23:15 London, the 3rd
    const wokeAt = new Date("2026-09-04T06:30:00Z"); // 07:30 London, the 4th
    expect(recoveryDate(cycleStart, created, wokeAt)).toBe("2026-09-04");
  });

  it("puts an evening cycle start on the day it wakes into, not the day it began", () => {
    // The regression that was reported twice. Without a sleep row to go on,
    // an evening start still means "you wake tomorrow".
    expect(recoveryDate(new Date("2026-09-03T21:00:00Z"), new Date("2026-09-04T00:05:00Z"))).toBe("2026-09-04");
  });

  it("leaves a morning cycle start on its own day", () => {
    // A cycle starting at 06:30 is somebody who slept through midnight; the
    // day they woke into is the day the cycle started.
    expect(recoveryDate(new Date("2026-09-04T05:30:00Z"), null)).toBe("2026-09-04");
  });

  it("falls back to when WHOOP created the record, rather than dropping it", () => {
    expect(recoveryDate(null, created)).toBe("2026-09-04");
  });

  it("still gives up when there is nothing at all to date it by", () => {
    expect(recoveryDate(null, null)).toBeNull();
  });

  it("uses the local day, not the UTC one", () => {
    // 23:40 UTC in September is 00:40 the next day in London — and 00:40 is a
    // morning, so it stays put rather than rolling on again.
    expect(recoveryDate(null, new Date("2026-09-04T23:40:00Z"))).toBe("2026-09-05");
  });

  it("rolls across a month end without inventing a 32nd", () => {
    // Built through the timezone helpers rather than by adding 24h.
    expect(recoveryDate(new Date("2026-09-30T21:30:00Z"), null)).toBe("2026-10-01");
  });

  it("agrees with the day sleep would be filed under, which is the point", () => {
    // Stated as the invariant rather than as two numbers: whatever the cycle
    // did, a recovery dated from a night's sleep lands where that sleep lands.
    for (const [cycleStart, wokeAt] of [
      ["2026-09-03T22:15:00Z", "2026-09-04T06:30:00Z"], // asleep before midnight
      ["2026-09-04T01:10:00Z", "2026-09-04T08:00:00Z"], // asleep after midnight
      ["2026-09-04T23:50:00Z", "2026-09-05T07:05:00Z"], // asleep at the very end of the day
    ] as const) {
      const woke = new Date(wokeAt);
      expect(recoveryDate(new Date(cycleStart), null, woke)).toBe(localDayKey(woke, "Europe/London"));
    }
  });
});
