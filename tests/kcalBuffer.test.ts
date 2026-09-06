import { describe, expect, it } from "vitest";

import { bufferMultiplier, resolveBuffer } from "../src/kcalBuffer";

describe("resolveBuffer", () => {
  it("reads an untouched account as the flat 12% it always had", () => {
    // Nobody's diary should change the day this setting ships.
    expect(resolveBuffer(null)).toEqual({ mode: "fixed", pct: 12, minPct: 0, maxPct: 15 });
    expect(resolveBuffer({})).toEqual({ mode: "fixed", pct: 12, minPct: 0, maxPct: 15 });
  });

  it("clamps anything a typo could produce", () => {
    // A buffer is a refinement on a guess; no value of it is worth failing an
    // estimate over, so junk lands on something sane rather than throwing.
    expect(resolveBuffer({ kcalBufferPct: -40 }).pct).toBe(0);
    expect(resolveBuffer({ kcalBufferPct: 900 }).pct).toBe(50);
    expect(resolveBuffer({ kcalBufferPct: Number.NaN }).pct).toBe(12);
  });

  it("reads a range entered backwards as a range", () => {
    // The two boxes sit next to each other and nobody means "at least 15, at
    // most 0" — that is a mis-tap, not an instruction.
    const buffer = resolveBuffer({ kcalBufferMode: "random", kcalBufferMinPct: 15, kcalBufferMaxPct: 0 });
    expect(buffer.minPct).toBe(0);
    expect(buffer.maxPct).toBe(15);
  });

  it("treats an unknown mode as fixed", () => {
    expect(resolveBuffer({ kcalBufferMode: "chaos" }).mode).toBe("fixed");
  });
});

describe("bufferMultiplier", () => {
  it("adds the fixed percentage", () => {
    expect(bufferMultiplier(resolveBuffer({ kcalBufferPct: 12 }))).toBeCloseTo(1.12);
    expect(bufferMultiplier(resolveBuffer({ kcalBufferPct: 0 }))).toBe(1);
  });

  it("stays inside the range in random mode, at both ends", () => {
    const buffer = resolveBuffer({ kcalBufferMode: "random", kcalBufferMinPct: 0, kcalBufferMaxPct: 15 });
    expect(bufferMultiplier(buffer, () => 0)).toBeCloseTo(1.0);
    expect(bufferMultiplier(buffer, () => 1)).toBeCloseTo(1.15);
    expect(bufferMultiplier(buffer, () => 0.5)).toBeCloseTo(1.075);
  });

  it("varies between draws, which is the whole point of the mode", () => {
    // A fixed figure pretends every meal is guessed low by the same amount.
    const buffer = resolveBuffer({ kcalBufferMode: "random", kcalBufferMinPct: 0, kcalBufferMaxPct: 15 });
    const draws = [0.1, 0.9].map((value) => bufferMultiplier(buffer, () => value));
    expect(draws[0]).not.toBeCloseTo(draws[1]!);
  });

  it("collapses to a fixed figure when the range has no width", () => {
    const buffer = resolveBuffer({ kcalBufferMode: "random", kcalBufferMinPct: 10, kcalBufferMaxPct: 10 });
    expect(bufferMultiplier(buffer, () => 0.42)).toBeCloseTo(1.1);
  });
});
