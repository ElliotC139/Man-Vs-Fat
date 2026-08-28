/**
 * Trend weight — an exponentially-weighted moving average over weigh-ins.
 *
 * Day-to-day scale readings swing by a kilo or more on water, salt, glycogen
 * and gut contents, which has nothing to do with fat gained or lost. Reading
 * the raw number as progress is both misleading and demoralising, so every
 * calculation that cares about "what does this person actually weigh now"
 * (progress, pace, projections, and the adaptive TDEE energy balance) works
 * off this smoothed series rather than the last thing the scale said.
 */

/** Smoothing factor per day. 0.1 is the long-standing Hacker's Diet value: responsive over ~2 weeks, but flat against a single heavy day. */
export const DEFAULT_ALPHA = 0.1;

export interface WeighInPoint {
  /** Local calendar day, YYYY-MM-DD. */
  date: string;
  weightKg: number;
}

export interface TrendPoint extends WeighInPoint {
  trendKg: number;
}

function daysBetween(aDate: string, bDate: string): number {
  return Math.max(0, Math.round((Date.parse(bDate) - Date.parse(aDate)) / 86_400_000));
}

/**
 * Trend value alongside each weigh-in, oldest first.
 *
 * Weigh-ins are irregular — someone might weigh daily for a week then skip
 * ten days — so the smoothing factor is compounded across the gap
 * (1-(1-alpha)^gap) rather than applied once per reading. Without that, a
 * reading after a long break would be damped as if it were the very next
 * day, and the trend would lag reality by weeks.
 */
export function trendWeightSeries(weighIns: WeighInPoint[], alpha = DEFAULT_ALPHA): TrendPoint[] {
  const sorted = [...weighIns].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  if (sorted.length === 0) return [];

  const out: TrendPoint[] = [{ ...sorted[0]!, trendKg: sorted[0]!.weightKg }];
  for (let i = 1; i < sorted.length; i++) {
    const point = sorted[i]!;
    const gap = Math.max(1, daysBetween(sorted[i - 1]!.date, point.date));
    const effectiveAlpha = 1 - Math.pow(1 - alpha, gap);
    const previousTrend = out[i - 1]!.trendKg;
    out.push({ ...point, trendKg: previousTrend + effectiveAlpha * (point.weightKg - previousTrend) });
  }
  return out;
}

/** Most recent trend value, or null with no weigh-ins. */
export function latestTrendWeight(weighIns: WeighInPoint[], alpha = DEFAULT_ALPHA): number | null {
  const series = trendWeightSeries(weighIns, alpha);
  return series.length ? series[series.length - 1]!.trendKg : null;
}

export interface TrendRate {
  /** Negative = losing. */
  kgPerWeek: number;
  /** Fitted weight at the start of the span — use instead of the raw first reading. */
  fromKg: number;
  /** Fitted weight at the end of the span. */
  toKg: number;
  spanDays: number;
}

/**
 * Rate of weight change, as a least-squares fit through every weigh-in in
 * the series.
 *
 * Two other approaches are tempting and both are worse. Raw first-to-last
 * lets a single bloated morning at either end swing the answer by a kilo a
 * week. Differencing the EMA endpoints fixes the noise but introduces lag:
 * the EMA is deliberately slow to move, so early on — when there are only a
 * handful of readings and it hasn't converged — it systematically understates
 * how fast someone is actually losing. A regression uses every reading, is
 * unbiased, and is well-defined from two points onward, which is why it's
 * what the energy-balance maths in adaptiveTdee.ts uses for Δweight too.
 */
export function trendRate(weighIns: WeighInPoint[]): TrendRate | null {
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
