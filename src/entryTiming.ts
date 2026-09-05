import { config } from "./config";
import { getLocalParts, zonedTimeToUtc } from "./matchWeek";
import { MEAL_TYPE_DEFAULT_HOUR, type MealType } from "./mealType";

/**
 * Moves a timestamp onto a chosen local day, keeping a sensible time of day.
 *
 * Logging while looking back at Tuesday should write to Tuesday, but a bare
 * date is midnight — and midnight is both the wrong meal slot and, on a
 * rollover day, the wrong match week. So the clock time comes from the moment
 * the entry is actually made, unless a meal slot was picked, in which case
 * that slot's representative hour is the honest answer.
 */
export function timestampOnLocalDay(date: string, now: Date, meal?: MealType | null): Date {
  const [year, month, day] = date.split("-").map(Number);
  if (!year || !month || !day) return now;

  const local = getLocalParts(now, config.TIMEZONE);
  const hour = meal ? MEAL_TYPE_DEFAULT_HOUR[meal] : local.hour;
  const minute = meal ? 0 : local.minute;
  return zonedTimeToUtc(year, month, day, hour, minute, config.TIMEZONE);
}

