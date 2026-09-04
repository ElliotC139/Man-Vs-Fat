import { describe, expect, it, vi } from "vitest";

vi.mock("../src/config", () => ({ config: { TIMEZONE: "Europe/London" } }));
vi.mock("../src/db", () => ({ prisma: {} }));
vi.mock("../src/whoop/client", () => ({}));
vi.mock("../src/errorLog", () => ({ recordError: vi.fn() }));

import { recoveryDate } from "../src/whoop/sync";

/**
 * The bug this pins: today's recovery scores the cycle that is still running,
 * and a cycle the API hasn't handed over yet used to make the recovery get
 * dropped — so today showed sleep and no recovery, all day, every day.
 */
describe("which day a recovery belongs to", () => {
  const cycleStart = new Date("2026-09-04T05:30:00Z");
  const created = new Date("2026-09-04T05:31:00Z");

  it("uses the cycle's own start when the cycle has been synced", () => {
    expect(recoveryDate(cycleStart, null)).toBe("2026-09-04");
  });

  it("falls back to when WHOOP created the record, rather than dropping it", () => {
    expect(recoveryDate(null, created)).toBe("2026-09-04");
  });

  it("prefers the cycle when both are there, since that is the real answer", () => {
    // A record created just after midnight for a cycle that began the evening
    // before belongs to the cycle's day.
    expect(recoveryDate(new Date("2026-09-03T21:00:00Z"), new Date("2026-09-04T00:05:00Z"))).toBe("2026-09-03");
  });

  it("still gives up when there is nothing at all to date it by", () => {
    expect(recoveryDate(null, null)).toBeNull();
  });

  it("uses the local day, not the UTC one", () => {
    // 23:40 UTC in September is 00:40 the next day in London.
    expect(recoveryDate(null, new Date("2026-09-04T23:40:00Z"))).toBe("2026-09-05");
  });
});
