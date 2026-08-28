/**
 * Weight maths over actual weigh-ins.
 *
 * Nothing here smooths or replaces a reading: what the scale said is what
 * gets stored and shown. The one derived figure is the rate of change, which
 * has to come from somewhere, and taking it as a straight line fitted through
 * every real reading is both the most faithful to the actual data and the
 * most stable — see `weightRate`.
 */

export interface WeighInPoint {
  /** Local calendar day, YYYY-MM-DD. */
  date: string;
  weightKg: number;
}

export interface WeightRate {
  /** Negative = losing. */
  kgPerWeek: number;
  /** Fitted weight at the start of the span. */
  fromKg: number;
  /** Fitted weight at the end of the span. */
  toKg: number;
  spanDays: number;
}

/**
 * Rate of weight change, as a least-squares line through every weigh-in.
 *
 * The obvious alternative — comparing the first reading to the last — uses
 * only two of the readings and is at the mercy of both. A single water-heavy
 * morning at either end can flip a genuine week of loss into an apparent
 * gain, which is exactly the kind of wrong number that makes someone give up.
 * Fitting a line uses every reading the person actually recorded, so no one
 * of them can dominate, and the answer is still purely a function of their
 * real data.
 *
 * The fitted endpoints are also what the energy-balance maths in
 * adaptiveTdee.ts uses for Δweight, for the same reason: there, a 2kg water
 * swing on the final morning would shift the implied burn by several hundred
 * kcal a day.
 */
export function weightRate(weighIns: WeighInPoint[]): WeightRate | null {
  const sorted = [...weighIns].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  if (sorted.length < 2) return null;

  const originMs = Date.parse(sorted[0]!.date);
  const points = sorted.map((p) => ({ x: (Date.parse(p.date) - originMs) / 86_400_000, y: p.weightKg }));
  const spanDays = points[points.length - 1]!.x;
  if (spanDays < 1) return null;

  const n = points.length;
  const meanX = points.reduce((s, p) => s + p.x, 0) / n;
  const meanY = points.reduce((s, p) => s + p.y, 0) / n;
  let num = 0;
  let den = 0;
  for (const p of points) {
    num += (p.x - meanX) * (p.y - meanY);
    den += (p.x - meanX) ** 2;
  }
  if (den === 0) return null;

  const slopePerDay = num / den;
  const intercept = meanY - slopePerDay * meanX;
  return {
    kgPerWeek: slopePerDay * 7,
    fromKg: intercept,
    toKg: intercept + slopePerDay * spanDays,
    spanDays,
  };
}

/** The most recent actual weigh-in, or null if there are none. */
export function latestWeightKg(weighIns: WeighInPoint[]): number | null {
  if (weighIns.length === 0) return null;
  const sorted = [...weighIns].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return sorted[sorted.length - 1]!.weightKg;
}
