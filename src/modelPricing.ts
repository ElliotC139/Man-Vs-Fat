/**
 * What a model call actually cost.
 *
 * The whole pricing structure rests on this file: a plan can only be
 * guaranteed profitable if the spend behind it is measured rather than
 * assumed, so every call records what the API says it used and this converts
 * that to money. Nothing here estimates — the token counts come back from the
 * API on the response.
 *
 * Money is kept in **micros**: millionths of a pound, as integers. A typical
 * text estimate costs a few thousand of them. Integers because these are
 * summed thousands of times to decide whether someone has hit a spending
 * ceiling, and a float that drifts is a ceiling that leaks.
 */

import { config } from "./config";

/** Dollars per million tokens, as published. */
interface ModelRate {
  input: number;
  output: number;
}

/**
 * The rates the app prices against.
 *
 * Cache reads are a tenth of the input rate and cache writes a quarter more
 * than it, on every model — so those are derived rather than listed, and a
 * model added here needs two numbers, not four.
 *
 * A model that isn't listed falls back to the most expensive rate rather than
 * to zero. Costing an unknown model at nothing is how a spend ceiling silently
 * stops working; costing it high fails towards refusing service, which is
 * recoverable.
 */
const RATES: Record<string, ModelRate> = {
  "claude-opus-5": { input: 5, output: 25 },
  "claude-sonnet-5": { input: 2, output: 10 },
  "claude-sonnet-4-5-20250929": { input: 3, output: 15 },
  "claude-haiku-4-5": { input: 1, output: 5 },
  "claude-haiku-4-5-20251001": { input: 1, output: 5 },
};

const CACHE_READ_MULTIPLIER = 0.1;
const CACHE_WRITE_MULTIPLIER = 1.25;

/** The dearest rate on the list, for a model this file has never heard of. */
function fallbackRate(): ModelRate {
  return Object.values(RATES).reduce(
    (worst, rate) => ({ input: Math.max(worst.input, rate.input), output: Math.max(worst.output, rate.output) }),
    { input: 0, output: 0 },
  );
}

export function rateFor(model: string): ModelRate {
  return RATES[model] ?? fallbackRate();
}

/** True when the model is one this file prices explicitly. */
export function isPricedModel(model: string): boolean {
  return model in RATES;
}

/** What the API reported using. Every field is tokens. */
export interface ModelUsage {
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
}

/**
 * Float dust, not money.
 *
 * The rates are dollars per million tokens, so the sum below is already in
 * millionths of a dollar and needs no divide — but multiplying by an exchange
 * rate that has no exact binary form leaves results like 3520.0000000000005,
 * and rounding those up costs a micro that was never spent. A billionth is
 * far below the smallest real fraction and far above the error.
 */
const FLOAT_DUST = 1e-9;

/** Millionths of a pound, rounded up — a ceiling must never under-count. */
export function costMicros(usage: ModelUsage): number {
  const rate = rateFor(usage.model);
  // Each term is tokens x (dollars per million tokens), which is millionths
  // of a dollar. Converting to pounds keeps the same unit.
  const microDollars =
    usage.inputTokens * rate.input
    + usage.outputTokens * rate.output
    + (usage.cacheReadTokens ?? 0) * rate.input * CACHE_READ_MULTIPLIER
    + (usage.cacheWriteTokens ?? 0) * rate.input * CACHE_WRITE_MULTIPLIER;

  return Math.ceil(microDollars * config.GBP_PER_USD - FLOAT_DUST);
}

/**
 * Micros as money, for anywhere a person reads it.
 *
 * The pence-or-pounds choice is made on the rounded figure rather than the
 * raw one. Deciding it on the raw value put 999,999 micros — a hair under a
 * pound — through the pence branch, where rounding to one decimal turned it
 * into "100.0p": correct to the penny and nonsense to read.
 */
export function formatMicros(micros: number): string {
  const pence = Math.round(micros / 10_000 * 10) / 10;
  return pence < 100 ? `${pence.toFixed(1)}p` : `£${(pence / 100).toFixed(2)}`;
}
