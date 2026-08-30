/**
 * A small in-memory sliding-window limiter.
 *
 * Every food entry and every exercise logged with a description calls the
 * Anthropic API, and nothing in the stack stopped a signed-in session — or a
 * cookie copied off a lost phone — from calling those endpoints in a loop.
 * The bill for that lands on the operator, not the caller, so the ceiling has
 * to sit in front of the model call rather than being a nicety.
 *
 * In-memory is the right shape here: the app runs as a single Fly machine
 * (min_machines_running = 1, auto_stop_machines = false), and a limiter that
 * resets on deploy is still a limiter — the failure it exists to stop is a
 * runaway loop within one process lifetime, not a patient attacker pacing
 * requests across restarts.
 */

interface Window {
  /** Timestamps (ms) of calls still inside the window, oldest first. */
  hits: number[];
}

export interface RateLimitRule {
  /** How many calls are allowed inside the window. */
  limit: number;
  windowMs: number;
}

export interface RateLimitVerdict {
  allowed: boolean;
  /** Seconds until the oldest call falls out of the window. */
  retryAfterSec: number;
  remaining: number;
}

const buckets = new Map<string, Window>();

// Two ceilings per rule set: a burst window that catches a hot loop within
// seconds, and a daily window that caps total spend even for usage that stays
// under the burst limit all day.
export const AI_BURST: RateLimitRule = { limit: 12, windowMs: 60 * 1000 };
export const AI_DAILY: RateLimitRule = { limit: 300, windowMs: 24 * 60 * 60 * 1000 };
export const SEARCH_BURST: RateLimitRule = { limit: 40, windowMs: 60 * 1000 };
export const LOGIN_BURST: RateLimitRule = { limit: 8, windowMs: 15 * 60 * 1000 };
export const RESET_BURST: RateLimitRule = { limit: 5, windowMs: 60 * 60 * 1000 };

function prune(window: Window, now: number, windowMs: number): void {
  const cutoff = now - windowMs;
  while (window.hits.length > 0 && window.hits[0]! <= cutoff) {
    window.hits.shift();
  }
}

/**
 * Records a call against `key` and says whether it is allowed. A rejected
 * call is *not* recorded, so being over the limit doesn't extend the
 * cool-off every time the caller retries.
 */
export function consume(key: string, rule: RateLimitRule, now = Date.now()): RateLimitVerdict {
  const bucketKey = `${key}:${rule.windowMs}`;
  const window = buckets.get(bucketKey) ?? { hits: [] };
  prune(window, now, rule.windowMs);

  if (window.hits.length >= rule.limit) {
    const oldest = window.hits[0]!;
    buckets.set(bucketKey, window);
    return {
      allowed: false,
      retryAfterSec: Math.max(1, Math.ceil((oldest + rule.windowMs - now) / 1000)),
      remaining: 0,
    };
  }

  window.hits.push(now);
  buckets.set(bucketKey, window);
  return { allowed: true, retryAfterSec: 0, remaining: rule.limit - window.hits.length };
}

/** Checks several rules at once, returning the first that rejects. */
export function consumeAll(key: string, rules: RateLimitRule[], now = Date.now()): RateLimitVerdict {
  for (const rule of rules) {
    const verdict = consume(key, rule, now);
    if (!verdict.allowed) return verdict;
  }
  return { allowed: true, retryAfterSec: 0, remaining: 0 };
}

/** Forgets everything recorded for a key — used after a successful login. */
export function reset(key: string): void {
  for (const bucketKey of buckets.keys()) {
    if (bucketKey.startsWith(`${key}:`)) buckets.delete(bucketKey);
  }
}

/** Test seam: drops all recorded calls. */
export function resetAll(): void {
  buckets.clear();
}
