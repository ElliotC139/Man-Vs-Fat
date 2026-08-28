import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  entries: [] as { timestamp: Date; kcal: number }[],
  weighIns: [] as { date: string; weightKg: number }[],
  cycles: [] as { start: Date; kcalBurned: number }[],
}));

vi.mock("../src/config", () => ({ config: { TIMEZONE: "Europe/London" } }));

vi.mock("../src/db", () => ({
  prisma: {
    entry: { findMany: vi.fn(async () => state.entries) },
    weighIn: { findMany: vi.fn(async () => [...state.weighIns].sort((a, b) => (a.date < b.date ? -1 : 1))) },
    whoopCycle: { findMany: vi.fn(async () => state.cycles) },
  },
}));

import { estimateAdaptiveTdee, isAdaptiveTdeeAvailable } from "../src/adaptiveTdee";

const DAY = 86_400_000;

function dayKey(offsetDays: number): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(new Date(Date.now() - offsetDays * DAY));
}

/** Logs `kcal` every day from `days` ago up to today. */
function logIntake(days: number, kcal: number, opts: { skip?: number[] } = {}) {
  for (let d = days; d >= 0; d--) {
    if (opts.skip?.includes(d)) continue;
    // Midday local, so the entry can't drift into an adjacent day.
    const t = new Date(Date.now() - d * DAY);
    t.setHours(12, 0, 0, 0);
    state.entries.push({ timestamp: t, kcal });
  }
}

/** Weigh-ins every `everyDays` from `days` ago to today, moving linearly from `startKg` to `endKg`. */
function logWeighIns(days: number, startKg: number, endKg: number, everyDays = 2) {
  for (let d = days; d >= 0; d -= everyDays) {
    const progress = (days - d) / days;
    state.weighIns.push({ date: dayKey(d), weightKg: startKg + (endKg - startKg) * progress });
  }
}

beforeEach(() => {
  state.entries.length = 0;
  state.weighIns.length = 0;
  state.cycles.length = 0;
});

describe("estimateAdaptiveTdee", () => {
  it("says what's missing rather than guessing, with no weigh-ins", async () => {
    logIntake(28, 2000);
    const result = await estimateAdaptiveTdee(1);
    expect(result.kcalPerDay).toBeNull();
    expect(isAdaptiveTdeeAvailable(result) ? null : result.reason).toBe("no-weigh-ins");
  });

  it("holds off until the weigh-ins span enough time", async () => {
    logIntake(28, 2000);
    logWeighIns(6, 90, 89.5, 2);
    const result = await estimateAdaptiveTdee(1);
    expect(isAdaptiveTdeeAvailable(result) ? null : result.reason).toBe("too-short-a-span");
  });

  it("refuses to invert the equation when too many days are unlogged", async () => {
    // Only ~40% of the span has any food logged.
    const skip = Array.from({ length: 17 }, (_, i) => i + 1);
    logIntake(28, 2000, { skip });
    logWeighIns(28, 90, 89, 2);
    const result = await estimateAdaptiveTdee(1);
    expect(isAdaptiveTdeeAvailable(result) ? null : result.reason).toBe("not-enough-logging");
  });

  it("recovers a known TDEE from intake and weight change", async () => {
    // Eat 2000/day for 28 days while losing exactly 1kg.
    // TDEE = (2000*29 − (−1 × 7700)) / 29 = 2000 + 7700/29 ≈ 2266.
    logIntake(28, 2000);
    logWeighIns(28, 90, 89, 2);

    const result = await estimateAdaptiveTdee(1);
    expect(isAdaptiveTdeeAvailable(result)).toBe(true);
    if (!isAdaptiveTdeeAvailable(result)) return;
    expect(result.kcalPerDay).toBeGreaterThan(2200);
    expect(result.kcalPerDay).toBeLessThan(2330);
    expect(result.trendChangeKg).toBeCloseTo(-1, 1);
    expect(result.completeness).toBe(1);
  });

  it("returns a TDEE above intake when losing and below intake when gaining", async () => {
    logIntake(28, 2500);
    logWeighIns(28, 90, 88, 2);
    const losing = await estimateAdaptiveTdee(1);
    expect(isAdaptiveTdeeAvailable(losing) && losing.kcalPerDay > 2500).toBe(true);

    state.entries.length = 0;
    state.weighIns.length = 0;
    logIntake(28, 2500);
    logWeighIns(28, 88, 90, 2);
    const gaining = await estimateAdaptiveTdee(1);
    expect(isAdaptiveTdeeAvailable(gaining) && gaining.kcalPerDay < 2500).toBe(true);
  });

  it("withholds a physiologically absurd result instead of reporting it", async () => {
    // A scale left in pounds: an apparent 40kg "loss" in a month would imply
    // a five-figure TDEE, which is worse than saying nothing.
    logIntake(28, 2000);
    logWeighIns(28, 130, 90, 2);
    const result = await estimateAdaptiveTdee(1);
    expect(result.kcalPerDay).toBeNull();
  });

  it("earns higher confidence from more complete data", async () => {
    logIntake(28, 2000);
    logWeighIns(28, 90, 89, 2);
    const dense = await estimateAdaptiveTdee(1);
    expect(isAdaptiveTdeeAvailable(dense) && dense.confidence).toBe("high");

    state.entries.length = 0;
    state.weighIns.length = 0;
    logIntake(20, 2000, { skip: [3, 7, 11] });
    logWeighIns(20, 90, 89.5, 6);
    const sparse = await estimateAdaptiveTdee(1);
    expect(isAdaptiveTdeeAvailable(sparse) && sparse.confidence).not.toBe("high");
  });

  it("flags likely under-logging when WHOOP measures a much higher burn", async () => {
    logIntake(28, 2000);
    logWeighIns(28, 90, 89, 2);
    // Implied TDEE is ~2266; WHOOP says 3000, a ~730 gap.
    for (let d = 28; d >= 0; d--) {
      const t = new Date(Date.now() - d * DAY);
      t.setHours(6, 0, 0, 0);
      state.cycles.push({ start: t, kcalBurned: 3000 });
    }

    const result = await estimateAdaptiveTdee(1);
    expect(isAdaptiveTdeeAvailable(result)).toBe(true);
    if (!isAdaptiveTdeeAvailable(result)) return;
    expect(result.whoopKcalPerDay).toBe(3000);
    expect(result.underLoggingKcalPerDay).toBeGreaterThan(600);
  });

  it("stays quiet about under-logging when the two estimates roughly agree", async () => {
    logIntake(28, 2000);
    logWeighIns(28, 90, 89, 2);
    for (let d = 28; d >= 0; d--) {
      const t = new Date(Date.now() - d * DAY);
      t.setHours(6, 0, 0, 0);
      state.cycles.push({ start: t, kcalBurned: 2300 });
    }

    const result = await estimateAdaptiveTdee(1);
    expect(isAdaptiveTdeeAvailable(result) ? result.underLoggingKcalPerDay : "n/a").toBeNull();
  });
});
