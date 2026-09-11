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

/**
 * Is this a unit you weigh, rather than one you count?
 *
 * The distinction decides what a bare number in front of a food means. "2
 * hobnobs" is two biscuits; "2 chicken", where the chicken was last logged as
 * 200 g, is not two grams of chicken — it is two of what you had. A unit you
 * count can be multiplied directly; a unit you weigh can only scale the whole
 * amount. Getting this backwards logs 3 kcal where 660 belonged.
 */
export function isMeasuredByWeight(unit: string | null | undefined): boolean {
  const clean = normalizeUnit(unit);
  return clean !== null && MASS_UNITS.has(clean);
}

/**
 * "rashers" and "rasher" are the same unit.
 *
 * Only ever used to compare two units for sameness, never to store one, so a
 * crude trailing-s strip is the right amount of cleverness: the cost of
 * getting an irregular plural wrong is one model call that would otherwise
 * have been free, not a wrong figure in the diary.
 */
export function sameUnit(a: string | null | undefined, b: string | null | undefined): boolean {
  const left = stems(a);
  const right = stems(b);
  return [...left].some((stem) => right.has(stem));
}

/**
 * Every singular a unit word might be, rather than one guess at it.
 *
 * Guessing once gets "slices" wrong in both directions: strip two letters and
 * it is "slic", strip one and "glasses" is "glasse". Since these are only ever
 * compared for overlap, offering all the plausible stems costs nothing and
 * means the awkward endings a food database actually uses — glasses, patties,
 * slices — all meet their own singular.
 */
function stems(value: string | null | undefined): Set<string> {
  const clean = normalizeUnit(value);
  if (!clean) return new Set();
  const out = new Set([clean]);
  if (clean.endsWith("ies")) out.add(`${clean.slice(0, -3)}y`);
  if (clean.endsWith("es")) out.add(clean.slice(0, -2));
  if (clean.endsWith("s")) out.add(clean.slice(0, -1));
  return out;
}

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

/**
 * Units that make sense for a particular food.
 *
 * The picker on the edit form has to offer something, and a fixed list is the
 * wrong something: nobody measures pizza in millilitres or milk in slices. So
 * the food's own name picks the list. "Two slices of pizza" and "200 ml of
 * milk" are both one tap, and neither screen offers the other's units first.
 *
 * Keyword matching rather than a model call, deliberately. This runs on every
 * keystroke in an offline-capable app, the estimator is metered by a spend
 * ceiling, and a wrong guess here costs one scroll — the free-text option is
 * always there. A list that is instant, free and offline beats one that is
 * cleverer and sometimes absent.
 */

/** Offered for everything, because they apply to everything. */
const UNIVERSAL_UNITS = ["g", "ml", "serving", "portion"];

/**
 * Words in a food's name and what people actually measure that food in.
 *
 * Ordered: the first pattern that matches leads the list, so "pizza" offers
 * slices before grams. Word-boundary matched so "grape" doesn't match
 * "grapefruit juice" and pull in the drinks units.
 */
const UNIT_HINTS: { pattern: RegExp; units: string[] }[] = [
  { pattern: /\b(pizza|garlic bread)\b/, units: ["slice", "piece"] },
  {
    pattern: /\b(bread|toast|loaf|sourdough|baguette|bap|bagel|cake|pie|flan|quiche|lasagne|melon|pineapple)\b/,
    units: ["slice", "piece"],
  },
  {
    pattern: /\b(milk|juice|squash|smoothie|shake|coffee|tea|water|cola|lemonade|beer|lager|cider|wine|soup|broth|stock)\b/,
    units: ["ml", "glass", "mug", "can", "bottle", "pint"],
  },
  { pattern: /\b(biscuit|cookie|cracker|oatcake|digestive)\b/, units: ["biscuit", "pack"] },
  { pattern: /\b(chocolate|choc)\b/, units: ["square", "bar", "piece"] },
  { pattern: /\b(crisps|chips|nuts|popcorn|raisins|seeds|granola|cereal|oats|porridge|rice|pasta|couscous|quinoa|flour|sugar)\b/, units: ["g", "handful", "bowl", "pack"] },
  { pattern: /\b(banana|apple|orange|pear|peach|plum|kiwi|egg|sausage|burger|patty|fillet|steak|chop|wing|drumstick|scallop|prawn|meatball|samosa|spring roll|nugget)\b/, units: ["piece"] },
  { pattern: /\b(oil|butter|ghee|mayo|mayonnaise|ketchup|sauce|dressing|syrup|honey|jam|peanut butter|hummus|cream|yoghurt|yogurt)\b/, units: ["tbsp", "tsp", "g"] },
  { pattern: /\b(salad|veg|vegetables|greens|broccoli|spinach|beans|peas|lentils|chickpeas)\b/, units: ["g", "handful", "bowl", "portion"] },
  { pattern: /\b(sandwich|wrap|roll|burrito|taco|pasty|pastie|croissant|muffin|scone|doughnut|donut|bar|pot|tub|packet|bag)\b/, units: ["piece", "pack"] },
  { pattern: /\b(curry|stew|chilli|casserole|risotto|stir fry|stirfry)\b/, units: ["portion", "bowl", "g"] },
];

/** Nothing sensible can be derived from a blank or one-letter name. */
const MIN_LABEL_LENGTH = 2;

/**
 * The unit list to offer for a food, best guesses first, de-duplicated.
 *
 * `current` is whatever the entry already carries; it always leads, because a
 * picker that doesn't offer the value it is currently showing is a picker that
 * silently changes it.
 */
export function suggestUnits(label: string | null | undefined, current?: string | null): string[] {
  const out: string[] = [];
  const push = (unit: string) => {
    const clean = unit.trim().toLowerCase();
    if (clean && !out.includes(clean)) out.push(clean);
  };

  // normalizeUnit drops "serving" (a bare multiplier says the same thing), so
  // it can't be used to clean the current value here — the picker does have a
  // "serving" row and has to be able to show it as selected.
  if (typeof current === "string" && current.trim()) push(current);

  const text = typeof label === "string" ? label.trim().toLowerCase() : "";
  if (text.length >= MIN_LABEL_LENGTH) {
    for (const hint of UNIT_HINTS) {
      if (hint.pattern.test(text)) for (const unit of hint.units) push(unit);
    }
  }

  for (const unit of UNIVERSAL_UNITS) push(unit);
  return out;
}
