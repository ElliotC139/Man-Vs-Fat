/**
 * What one of something is.
 *
 * `Entry.quantity` has always been a bare multiplier: kcal is the total for the
 * whole entry, and quantity is what you divide by to rescale it. That is enough
 * arithmetic to answer "I had two of those" and not enough to answer "make that
 * 40g instead of 30g", because a quantity with nothing attached to it can't say
 * what the 30 was.
 *
 * A unit label is the missing half. With one, the same quantity that used to
 * read "x2" reads "30 g" or "2 slices", and the edit form can offer a figure a
 * person recognises from the packet instead of a multiplier they have to work
 * out in their head.
 *
 * Deliberately a free label rather than an enum. The sources this app reads
 * describe servings in their own words — Open Food Facts says "2 biscuits (30
 * g)", Nutritionix says "1 medium" — and forcing that into a fixed list would
 * either lose the information or invent a conversion nobody asked for.
 */

/** Units a fractional amount reads naturally in. */
const MASS_UNITS = new Set(["g", "kg", "ml", "l", "oz", "fl oz"]);

const MAX_UNIT_LENGTH = 20;

/**
 * Cleans a unit label from a food database into something short enough to sit
 * on a diary row, or null if there is nothing usable in it.
 */
export function normalizeUnit(raw: string | null | undefined): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed) return null;
  // A "serving" says nothing a bare multiplier didn't already say, and a row
  // reading "1 serving" is noise where "x1" was silence.
  if (trimmed === "serving" || trimmed === "servings") return null;
  return trimmed.slice(0, MAX_UNIT_LENGTH);
}

/** 2 rather than 2.0, but 1.5 keeps its half and 32.5 g keeps its point. */
export function formatQuantity(quantity: number): string {
  return Number.isInteger(quantity) ? String(quantity) : String(Number(quantity.toFixed(2)));
}

/**
 * How an entry's amount reads on a row.
 *
 * Three shapes, because the three mean genuinely different things:
 *
 *   - No unit, one of them  — nothing. "x1" is a fact about arithmetic, not
 *     about food, and it was never shown.
 *   - No unit, several      — "x2", exactly as before.
 *   - A unit                — "30 g", "2 slices". Pluralised only for counted
 *     things: 30 gs is not a word anyone has written down.
 */
export function describeAmount(quantity: number, unitLabel: string | null | undefined): string | null {
  const unit = normalizeUnit(unitLabel);
  if (!unit) return quantity === 1 ? null : `×${formatQuantity(quantity)}`;

  const amount = formatQuantity(quantity);
  if (MASS_UNITS.has(unit)) return `${amount}${unit === "fl oz" ? " " : ""}${unit}`;
  return `${amount} ${quantity === 1 ? unit : pluralize(unit)}`;
}

/**
 * Good enough for the handful of words a food database uses for a countable
 * serving — slice, biscuit, piece, square, patty. Not a general pluralizer,
 * and not trying to be: a unit it gets wrong is a cosmetic wrongness on one
 * row, which is a much smaller cost than a table of irregular nouns.
 */
function pluralize(unit: string): string {
  if (unit.endsWith("s") || unit.endsWith("ch") || unit.endsWith("sh")) return `${unit}es`;
  if (unit.endsWith("y") && !"aeiou".includes(unit[unit.length - 2] ?? "")) {
    return `${unit.slice(0, -1)}ies`;
  }
  return `${unit}s`;
}
