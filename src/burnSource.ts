/**
 * What the Today card calls the day's burn.
 *
 * Three different figures have a claim on that slot, and which one is right
 * depends on the person rather than on the app:
 *
 *   measured — what a connected tracker has recorded so far today. The truest
 *              figure, and the only one that is genuinely "so far": it grows
 *              through the day.
 *   target   — the daily calorie target from Settings. Not a burn at all, but
 *              for someone aiming at a number it is the figure they want the
 *              day measured against.
 *   estimate — Mifflin-St Jeor from height, weight, age and activity. A whole
 *              day's worth, available to anyone who has filled those in.
 *
 * Two rules keep this honest. The caption on the card always names the figure
 * actually used, so a whole-day estimate is never labelled "burned so far".
 * And a choice that can't be produced — measured with no tracker, target with
 * no target set — falls through to one that can, with the response saying
 * which, rather than showing a blank where a number should be.
 */

export const BURN_SOURCES = ["measured", "target", "estimate"] as const;
export type BurnSource = (typeof BURN_SOURCES)[number];

/** What the card shows when none of the three can be produced. */
export type ResolvedBurnSource = BurnSource | "none";

export function readBurnSource(value: string | null | undefined): BurnSource {
  return BURN_SOURCES.includes(value as BurnSource) ? (value as BurnSource) : "measured";
}

export interface BurnCandidates {
  /** Measured so far today, when a tracker has scored any of it. */
  measured: number | null;
  /** The user's own daily calorie target. */
  target: number | null;
  /** Mifflin-St Jeor for a whole day. */
  estimate: number | null;
}

export interface ResolvedBurn {
  kcal: number | null;
  source: ResolvedBurnSource;
  /** True when the choice couldn't be produced and something else was used. */
  fellBack: boolean;
}

/**
 * The chosen figure, or the best one that exists.
 *
 * The fallback order after the choice is measured, then target, then estimate —
 * most direct first, same as it was before this became a choice.
 */
export function resolveBurn(choice: BurnSource, candidates: BurnCandidates): ResolvedBurn {
  const order: BurnSource[] = [choice, ...BURN_SOURCES.filter((s) => s !== choice)];

  for (const source of order) {
    const kcal = candidates[source];
    if (kcal !== null && kcal > 0) {
      return { kcal: Math.round(kcal), source, fellBack: source !== choice };
    }
  }

  return { kcal: null, source: "none", fellBack: true };
}

/**
 * What the figure is called under it. Only "measured" is a running total, so
 * only it says "so far".
 */
export function burnCaption(source: ResolvedBurnSource): string {
  switch (source) {
    case "measured":
      return "burned so far";
    case "target":
      return "daily target";
    case "estimate":
      return "estimated burn";
    default:
      return "burn (nothing to go on)";
  }
}

/** What the net line beneath it is called, which follows the same logic. */
export function netCaption(source: ResolvedBurnSource): string {
  switch (source) {
    case "measured":
      return "net so far";
    case "target":
      return "vs target";
    case "estimate":
      return "vs estimate";
    default:
      return "net";
  }
}
