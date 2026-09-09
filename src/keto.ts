/**
 * Keto, as one switch rather than four settings to find.
 *
 * Everything keto needs already existed: net carbs, a carb ceiling, fibre on
 * the entry rows. What didn't exist was any way to arrive at them without
 * knowing that "count carbs as net", "carbs at most 20g", "show fibre" and
 * "show net carbs" are the four controls that add up to keto — which is a lot
 * to ask of someone who just wants the app to count the right number.
 *
 * So turning it on sets those together. Turning it off leaves them alone: the
 * switch is a way in, not a mode the rest of the app branches on, and wiping
 * someone's carb ceiling because they stopped calling it keto would throw away
 * a setting they may well still want.
 *
 * The one thing the flag itself changes is what Today leads with. Under keto
 * the number that matters is net carbs against the day's ceiling — not a third
 * macro bar of equal weight — which is why the flag is stored rather than
 * inferred from the settings it sets. Those can be edited afterwards without
 * meaning the person has stopped doing keto.
 */

import { netCarbsOf } from "./nutrients";

/**
 * The usual starting point for induction, and what every keto app defaults to.
 * A starting point, not a rule — it is written into the ordinary carb target,
 * where it can be changed like any other.
 */
export const DEFAULT_KETO_NET_CARB_LIMIT_G = 20;

/** The figures Today needs to lead with net carbs. */
export interface KetoDay {
  /** The ceiling in grams, from the ordinary carb target. */
  limitG: number | null;
  /** Net carbs logged so far, or null when nothing logged has a carb figure. */
  eatenG: number | null;
  /** Grams left before the ceiling, floored at zero. Null without both. */
  remainingG: number | null;
  over: boolean;
  /** How many of the day's entries have no carb figure to count. */
  unknownEntries: number;
}

export function ketoDay(input: {
  carbsG: number | null;
  fibreG: number | null;
  limitG: number | null;
  unknownEntries: number;
}): KetoDay {
  const eatenG = netCarbsOf(input.carbsG, input.fibreG);
  const limitG = input.limitG !== null && input.limitG > 0 ? input.limitG : null;
  return {
    limitG,
    eatenG,
    remainingG: limitG === null || eatenG === null ? null : Math.max(0, Math.round((limitG - eatenG) * 10) / 10),
    over: limitG !== null && eatenG !== null && eatenG > limitG,
    unknownEntries: input.unknownEntries,
  };
}

/**
 * The settings changes turning keto on implies.
 *
 * Only fills in what is missing, so someone who already keeps a 25g ceiling
 * keeps it. The two that are set outright are the two that would make the
 * count wrong rather than merely different: carbs read as total rather than
 * net is the wrong number, and a carb target read as a floor is the wrong
 * direction.
 */
export function ketoSettings(current: { carbsTargetG?: number | null }): Record<string, unknown> {
  return {
    carbMode: "net",
    carbsOp: "max",
    // Grams rather than percentages, because a percentage split cannot express
    // "under 20g whatever else happens", which is the one rule keto has.
    macroMode: "grams",
    carbsTargetG: current.carbsTargetG && current.carbsTargetG > 0
      ? current.carbsTargetG
      : DEFAULT_KETO_NET_CARB_LIMIT_G,
  };
}

/**
 * The figures to show under an entry once keto is on.
 *
 * Net carbs because that is the count, and fibre because it is what the count
 * subtracts — a net figure you can't check against the fibre it came from is
 * a number you have to take on trust. Anything already chosen is kept.
 */
export function ketoDiaryFields(chosen: readonly string[]): string[] {
  const wanted = ["netCarbs", "fibre"];
  return [...chosen, ...wanted.filter((field) => !chosen.includes(field))];
}
