/**
 * Which side of the clock someone is on: eating, or fasting.
 *
 * The Today screen has had an eating-window countdown for a while, and it only
 * ever counted down — "3h left to eat", then "window closed 4h ago". That is
 * half the picture, and the less useful half: the number someone doing 16:8
 * actually watches is how long they have been fasting and how much of the fast
 * is left, which the card never showed.
 *
 * Both halves come off the same setting. An 8-hour eating window IS a 16-hour
 * fast — the protocol names in Settings say so — so nothing new has to be
 * configured for the fast to have a target.
 *
 * The fast is measured from the last thing eaten, not from when the window
 * closed. Those differ whenever someone eats past their window, and measuring
 * from the last meal is both the honest figure and the one that restarts
 * correctly when they do.
 *
 * Pure and clock-injected so the states can be tested without waiting for
 * time to pass.
 */

const HOUR_MS = 3600_000;
const MIN_MS = 60_000;

export interface FastingInput {
  /** The eating-window target in hours, as set in Settings. */
  windowHours: number;
  /** Now, in ms. */
  now: number;
  /** Every entry logged on the day being shown, in ms. Order doesn't matter. */
  entryTimes: number[];
  /**
   * The most recent entry strictly before that day began, in ms.
   *
   * Without it a fast could never be longer than the time since midnight,
   * which is exactly the fast nobody needs a timer for.
   */
  lastEntryBefore: number | null;
}

/**
 * The instants the card runs its clock against.
 *
 * Split out from the state below because the state has to tick and the
 * anchors don't: the browser gets these once with the rest of the Today
 * payload and then only has to compare them to its own clock, so the rules
 * about which meal opens the window and which one starts the fast live here,
 * on the server, in one place.
 */
export interface FastingAnchors {
  windowHours: number;
  fastTargetMin: number;
  /** The first thing eaten on the day being shown, which opens the window. */
  openedAt: number | null;
  /** When that window closes. Null when it never opened. */
  closesAt: number | null;
  /** The last thing eaten, whenever that was — where the fast counts from. */
  lastMealAt: number | null;
}

export type FastingState =
  /** Nothing has ever been logged, so there is no clock to run yet. */
  | { phase: "waiting"; fastTargetMin: number }
  /** The window is open: how long is left to eat. */
  | { phase: "eating"; openedAt: number; closesAt: number; leftMin: number; progress: number }
  /** The window has closed: how long since the last thing eaten. */
  | {
      phase: "fasting";
      /** The last thing eaten, which is when the fast began. */
      since: number;
      elapsedMin: number;
      fastTargetMin: number;
      /** Minutes still to go, floored at zero. */
      remainingMin: number;
      metTarget: boolean;
      progress: number;
    };

/** 0–1, clamped, for a progress bar's width. */
function fraction(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return Math.max(0, Math.min(1, part / whole));
}

export function fastingAnchors(
  input: Omit<FastingInput, "now">,
): FastingAnchors {
  const { windowHours, entryTimes, lastEntryBefore } = input;
  const today = entryTimes.filter((t) => Number.isFinite(t)).sort((a, b) => a - b);
  const openedAt = today[0] ?? null;

  return {
    windowHours,
    // A 24-hour window is "no fast at all", and the arithmetic would make its
    // target zero — a bar that is always full rather than a state worth
    // showing. Settings tops out at 12, so this is belt and braces.
    fastTargetMin: Math.max(0, (24 - windowHours) * 60),
    openedAt,
    closesAt: openedAt === null ? null : openedAt + windowHours * HOUR_MS,
    lastMealAt: today.length > 0 ? today[today.length - 1]! : lastEntryBefore,
  };
}

export function fastingState(input: FastingInput): FastingState {
  const { now } = input;
  const anchors = fastingAnchors(input);
  const { fastTargetMin, openedAt, closesAt, lastMealAt } = anchors;

  if (lastMealAt === null) return { phase: "waiting", fastTargetMin };

  if (openedAt !== null && closesAt !== null && now < closesAt) {
    return {
      phase: "eating",
      openedAt,
      closesAt,
      leftMin: (closesAt - now) / MIN_MS,
      progress: fraction(now - openedAt, closesAt - openedAt),
    };
  }

  const elapsedMin = Math.max(0, (now - lastMealAt) / MIN_MS);
  return {
    phase: "fasting",
    since: lastMealAt,
    elapsedMin,
    fastTargetMin,
    remainingMin: Math.max(0, fastTargetMin - elapsedMin),
    metTarget: elapsedMin >= fastTargetMin,
    progress: fraction(elapsedMin, fastTargetMin),
  };
}
