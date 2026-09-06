/**
 * The under-reporting buffer, and how much of it to apply.
 *
 * Casual food descriptions skew low — portions rounded down, the oil and the
 * sauce left unmentioned — so a guessed estimate gets a percentage added on
 * top rather than being trusted as a tight figure. 12% was the number, hard
 * coded, for everyone.
 *
 * It is a setting now, because how far anyone's own logging runs low is a
 * thing only they can know, and two people can honestly want different
 * answers:
 *
 *   fixed  — the same percentage every time, which is what it always did.
 *            Set it to 0 to turn the buffer off entirely.
 *   random — a different percentage per item, drawn uniformly from a range.
 *            Closer to how the error actually behaves: some meals are guessed
 *            almost right and some are miles under, and a fixed figure pretends
 *            the miss is the same size every time.
 *
 * Either way it applies only where there is under-reporting to correct. An
 * entry that stated its own amount ("200g", "10 pieces") is never buffered —
 * see quantity.ts.
 */

export const BUFFER_MODES = ["fixed", "random"] as const;
export type BufferMode = (typeof BUFFER_MODES)[number];

/** What the buffer did for everyone before it was a choice. */
export const DEFAULT_BUFFER_PCT = 12;
export const DEFAULT_BUFFER_MIN_PCT = 0;
export const DEFAULT_BUFFER_MAX_PCT = 15;

/** Nobody's logging is 80% out; a ceiling keeps a typo from wrecking a diary. */
export const MAX_BUFFER_PCT = 50;

export interface BufferSettings {
  kcalBufferMode?: string | null;
  kcalBufferPct?: number | null;
  kcalBufferMinPct?: number | null;
  kcalBufferMaxPct?: number | null;
}

export interface ResolvedBuffer {
  mode: BufferMode;
  pct: number;
  minPct: number;
  maxPct: number;
}

function clampPct(value: number | null | undefined, fallback: number): number {
  if (value === null || value === undefined || !Number.isFinite(value)) return fallback;
  return Math.min(MAX_BUFFER_PCT, Math.max(0, Math.round(value)));
}

/**
 * The stored columns as a usable set of figures.
 *
 * A row holding nothing, or nonsense, reads as the old fixed 12% rather than
 * as an error: the buffer is a refinement on a guess, and no value of it is
 * worth failing an estimate over.
 */
export function resolveBuffer(settings: BufferSettings | null | undefined): ResolvedBuffer {
  const mode: BufferMode = settings?.kcalBufferMode === "random" ? "random" : "fixed";
  const minPct = clampPct(settings?.kcalBufferMinPct, DEFAULT_BUFFER_MIN_PCT);
  const maxPct = clampPct(settings?.kcalBufferMaxPct, DEFAULT_BUFFER_MAX_PCT);
  return {
    mode,
    pct: clampPct(settings?.kcalBufferPct, DEFAULT_BUFFER_PCT),
    minPct: Math.min(minPct, maxPct),
    // A range entered backwards is read as a range, not rejected — the two
    // boxes are next to each other and nobody means "at least 15, at most 0".
    maxPct: Math.max(minPct, maxPct),
  };
}

/**
 * One multiplier, for one item.
 *
 * Drawn per item in random mode rather than per entry, so logging three things
 * at once doesn't apply one roll of the dice to all three — the whole point of
 * the mode is that the miss varies between them.
 */
export function bufferMultiplier(buffer: ResolvedBuffer, random: () => number = Math.random): number {
  if (buffer.mode === "random") {
    const span = buffer.maxPct - buffer.minPct;
    return 1 + (buffer.minPct + random() * span) / 100;
  }
  return 1 + buffer.pct / 100;
}
