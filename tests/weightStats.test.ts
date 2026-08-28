import { describe, expect, it } from "vitest";
import { latestWeightKg, weightRate } from "../src/weightStats";

function series(start: string, weights: number[], stepDays = 1) {
  const base = Date.parse(`${start}T00:00:00Z`);
  return weights.map((weightKg, i) => ({
    date: new Date(base + i * stepDays * 86_400_000).toISOString().slice(0, 10),
    weightKg,
  }));
}

describe("weightRate", () => {
  it("recovers a clean linear rate exactly", () => {
    // 1kg down over 14 days = 0.5 kg/week.
    const rate = weightRate(series("2026-01-01", [92, 91], 14));
    expect(rate!.kgPerWeek).toBeCloseTo(-0.5, 4);
  });

  it("still reports a loss when the final reading is a water spike", () => {
    // A steady week of losing, then one 2kg water-heavy morning at the end —
    // the single worst case, since the last point has the most leverage.
    const steady = series("2026-01-01", [100, 99.8, 99.6, 99.4, 99.2, 99.0, 98.8, 98.6]);
    const spiked = [...steady.slice(0, -1), { date: steady[steady.length - 1]!.date, weightKg: 100.6 }];

    const naiveFirstToLast = ((spiked[spiked.length - 1]!.weightKg - spiked[0]!.weightKg) / 7) * 7;
    const fitted = weightRate(spiked)!.kgPerWeek;

    // Reading first-to-last would turn a genuine week of loss into an
    // apparent gain; the fit through every point keeps it a loss.
    expect(naiveFirstToLast).toBeGreaterThan(0);
    expect(fitted).toBeLessThan(0);
  });

  it("reports a positive rate when gaining", () => {
    expect(weightRate(series("2026-01-01", [90, 91], 14))!.kgPerWeek).toBeGreaterThan(0);
  });

  it("returns the latest actual reading, unsmoothed", () => {
    expect(latestWeightKg([])).toBeNull();
    expect(latestWeightKg(series("2026-01-01", [100, 97, 103]))).toBe(103);
  });

  it("returns null with fewer than two readings or no elapsed time", () => {
    expect(weightRate([])).toBeNull();
    expect(weightRate(series("2026-01-01", [90]))).toBeNull();
    expect(weightRate([
      { date: "2026-01-01", weightKg: 90 },
      { date: "2026-01-01", weightKg: 91 },
    ])).toBeNull();
  });

  it("gives fitted endpoints that sit inside the raw range", () => {
    const rate = weightRate(series("2026-01-01", [100, 97, 99, 96, 98, 95], 3))!;
    expect(rate.fromKg).toBeLessThanOrEqual(100);
    expect(rate.toKg).toBeGreaterThanOrEqual(95);
    expect(rate.kgPerWeek).toBeLessThan(0);
  });
});
