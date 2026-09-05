/**
 * Grouping foods by meaning rather than exact text.
 *
 * Lives on its own rather than in the foods route because it is a pure string
 * function that half the app needs — food search, the recovery insights, the
 * macro backfill, the stats screen — and reaching into a route module for it
 * dragged the database and the environment config in behind it. Importing a
 * string function should not require a configured deployment.
 */

// Filler words that don't distinguish one food from another — stripped so
// e.g. "a bowl of chicken and rice" and "chicken and rice" group together.
const STOPWORDS = new Set([
  "a", "an", "the", "and", "or", "with", "of", "some", "few", "little", "bit",
  "handful", "plate", "bowl", "cup", "glass", "portion", "serving", "piece", "pieces",
  "small", "medium", "large", "extra",
]);

// Groups entries by meaning rather than exact text: lowercases, strips
// punctuation and filler words, crudely singularizes, then sorts the
// remaining significant words — so word order ("rice and chicken" vs
// "chicken and rice") and minor phrasing differences collapse to the same
// key without needing another AI call. Conservative on purpose (no
// stemming/synonyms beyond a trailing-s check) to avoid merging genuinely
// different foods.
export function normalizeLabel(label: string): string {
  const words = label
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .filter((w) => !STOPWORDS.has(w) && !/^\d+$/.test(w))
    .map((w) => (w.length > 3 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w));

  return words.sort().join(" ");
}
