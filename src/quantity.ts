/**
 * Did the person say how much they ate?
 *
 * This is the difference between "some crisps" and "10 pieces", and the diary
 * treats those two entries differently in two places:
 *
 *   - the estimate itself, because a stated count has to be worked out from a
 *     unit weight rather than rounded off to a typical portion;
 *   - the under-reporting buffer in estimate.ts, which exists to correct for
 *     portions guessed low and extras left unmentioned. Someone who wrote
 *     "200g" or "10 pieces" has not guessed low — they have told us — so
 *     inflating that figure by 12% is not a correction, it is an error.
 *
 * Deliberately conservative: only an amount pinned to a real unit counts. A
 * "handful", a "portion" and a "serving" name no amount at all, so they stay
 * on the vague side of the line where the buffer still applies.
 */

/** Digits, or the number words people actually type in a food diary. */
const NUMBER = String.raw`(?:\d+(?:[.,]\d+)?|half|quarter|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|dozen)`;

/** Anything that pins an amount by weight or volume. */
const MASS_VOLUME = String.raw`(?:mg|g|gs|grams?|kg|kgs|kilos?|kilograms?|oz|ounces?|lb|lbs|pounds?|ml|millilitres?|milliliters?|cl|l|litres?|liters?|pints?)`;

/**
 * Things that come in countable units, where "10 of them" is a real amount.
 *
 * "Handful", "portion" and "serving" are pointedly absent: they are how people
 * describe an amount they have not measured.
 */
const COUNT_NOUN = String.raw`(?:pieces?|slices?|buttons?|squares?|biscuits?|cookies?|eggs?|cubes?|bars?|cans?|bottles?|glasses?|mugs?|tbsps?|tablespoons?|tsps?|teaspoons?|scoops?|rashers?|sausages?|nuggets?|wings?|crackers?|chunks?|balls?|fillets?|breasts?|thighs?|packs?|packets?|bags?|tins?|sachets?|sticks?|rolls?|wraps?|pots?|tubs?|triangles?|fingers?|bites?|sweets?|crisps?|chips?|nuts?|shots?|units?)`;

const PATTERNS = [
  // "200g", "1.5 kg", "330ml", "2 oz", "1 pint"
  new RegExp(String.raw`\b${NUMBER}\s*${MASS_VOLUME}\b`, "i"),
  // "10 pieces", "3 slices", "two eggs", "6 buttons" — and the same with the
  // food described in between, which is how people actually write it:
  // "6 chicken nuggets", "10 white chocolate buttons", "2 pork sausages".
  new RegExp(String.raw`\b${NUMBER}\s+(?:[a-z'’-]+\s+){0,3}${COUNT_NOUN}\b`, "i"),
  // A count of something plural that no list could enumerate: "3 jaffa cakes",
  // "2 sausage rolls", "4 fish fingers". Deliberately loose, because this
  // check only ever PERMITS the model's judgement — being too strict here
  // silently leaves the buffer on entries that stated their amount, which is
  // the failure this whole check exists to stop.
  new RegExp(String.raw`\b${NUMBER}\s+(?:[a-z'’-]+\s+){0,2}[a-z'’-]+s\b`, "i"),
  // "2 x 25g", "3x bar" — the multiplier form
  new RegExp(String.raw`\b\d+\s*[x×]\s*\d`, "i"),
];

/**
 * True when the text states an amount in a unit that pins it down.
 *
 * Used as a check on the model rather than a replacement for it: the model
 * decides which item in a multi-item entry was quantified, and this decides
 * whether the entry could contain such an amount at all.
 */
export function statesExplicitQuantity(text: string | null | undefined): boolean {
  const value = text?.trim();
  if (!value) return false;
  return PATTERNS.some((pattern) => pattern.test(value));
}
