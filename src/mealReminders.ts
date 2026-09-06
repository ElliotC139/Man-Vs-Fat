/**
 * Nudging at the meal rather than at the end of the day.
 *
 * The app has had one reminder since it had any: a single hour, and a push
 * that says "nothing logged today". That is the right nudge for someone who
 * has forgotten the app exists, and the wrong one for the much more common
 * failure, which is logging breakfast and lunch and then reconstructing dinner
 * from memory at eleven at night.
 *
 * These are four independent hours, one per meal slot, each of which asks a
 * narrower question: is there anything filed under lunch today? A slot with no
 * hour set never nudges, which is the default for all four.
 *
 * Deliberately not gated on meal tags being switched on. Every entry already
 * carries a slot inferred from its time of day, so "have you logged a lunch"
 * is answerable whether or not the user has ever been asked to tag anything —
 * and wanting a nudge at one o'clock is a different wish from wanting to
 * categorise your diary.
 */

import { MEAL_TYPES, type MealType } from "./mealType";

export type MealReminderHours = Partial<Record<MealType, number>>;

/**
 * What arrives from the settings form, where turning a slot off sends an
 * explicit null rather than dropping the key. Both mean the same thing here —
 * isHour rejects either — but the type has to admit it.
 */
export type MealReminderInput = Partial<Record<MealType, number | null>>;

function isHour(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 23;
}

/**
 * The hours this account has set, ignoring anything unreadable.
 *
 * A malformed column reads as no reminders rather than throwing: the worst
 * outcome of a bad row here should be a nudge that doesn't arrive, never a
 * failed request or a job that stops for every other user too.
 */
export function readMealReminders(stored: string | null | undefined): MealReminderHours {
  if (!stored) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(stored);
  } catch {
    return {};
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};

  const out: MealReminderHours = {};
  for (const slot of MEAL_TYPES) {
    const value = (parsed as Record<string, unknown>)[slot];
    if (isHour(value)) out[slot] = value;
  }
  return out;
}

/**
 * Serialises back to the column, dropping the slots that aren't set.
 *
 * Returns null rather than "{}" when nothing is set, so an account that turns
 * every reminder off is stored the same way as one that never set any —
 * there is no third state worth keeping.
 */
export function writeMealReminders(hours: MealReminderInput | null | undefined): string | null {
  if (!hours) return null;
  const kept: MealReminderHours = {};
  for (const slot of MEAL_TYPES) {
    const value = hours[slot];
    if (isHour(value)) kept[slot] = value;
  }
  return Object.keys(kept).length === 0 ? null : JSON.stringify(kept);
}

/** The slots due at this hour. Usually none, occasionally one, rarely two. */
export function slotsDueAt(hours: MealReminderHours, hour: number): MealType[] {
  return MEAL_TYPES.filter((slot) => hours[slot] === hour);
}

/** Whether any slot is set to this hour — the cheap check the job runs first. */
export function anyDueAt(stored: string | null | undefined, hour: number): boolean {
  return slotsDueAt(readMealReminders(stored), hour).length > 0;
}
