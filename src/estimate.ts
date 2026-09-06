import Anthropic from "@anthropic-ai/sdk";
import { config } from "./config";
import { recordError } from "./errorLog";
import { clampMacrosToKcal } from "./macros";
import { statesExplicitQuantity } from "./quantity";
import { bufferMultiplier, resolveBuffer, type BufferSettings, type ResolvedBuffer } from "./kcalBuffer";
import type { EstimateReference } from "./estimateGrounding";

function round1(value: number | null): number | null {
  return value === null ? null : Math.round(value * 10) / 10;
}

const client = new Anthropic({ apiKey: config.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You help someone keep a deliberately rough, low-friction food diary. \
Given a short free-text description and/or a photo, identify each distinct \
food/meal/snack/drink being logged and give each one its own best-guess \
figures: calories, and grams of protein, carbohydrate and fat.

You estimate, you do not advise. No health commentary, no warnings, no \
guilt-tripping, no ranges, no comment on whether the numbers are good or bad. \
Return figures and nothing else.

Rules:
- Treat the components of a single dish as ONE item — "chicken stir fry with \
  rice" is one item, not three. Only split into multiple items when the \
  input clearly describes separate, distinct things eaten (separate dishes, \
  snacks, or drinks), however they're separated: commas, "and", "also", \
  newlines, or just listed one after another. Most entries are a single item.
- Always give exactly one whole-number kcal guess per item, even for vague \
  input ("just a sandwich", "some crisps").
- WORK OUT THE AMOUNT BEFORE THE CALORIES. When the description states how \
  much — a weight or volume ("200g", "330ml"), or a count of countable units \
  ("10 pieces", "3 slices", "2 eggs") — that is the amount eaten. Never \
  substitute a typical portion, a standard serving, a whole packet or a whole \
  bag for an amount you were given.
- For a stated count, work from the packet's own serving where the reference \
  figures give one: "15 pieces (30 g)" means ten pieces is ten fifteenths of \
  that serving, with no unit weight guessed at all. Failing that, get to a \
  weight first — the weight of ONE unit multiplied by the number of units — \
  then apply the food's per-100g figures to that weight. Small confectionery and snack units are only a few grams each — a \
  chocolate button, a square of chocolate, a crisp, a sweet, a cracker — so a \
  stated count of them is tens of grams, not a sharing bag. Ten small units of \
  something is almost never a whole pack.
- Set "quantified" to true on an item whose amount the description states that \
  way, and false when you had to assume a typical portion. Judge each item \
  separately: in "200g chicken and some chips" the chicken is quantified and \
  the chips are not.
- Some entries carry REFERENCE FIGURES: real published nutrition for products \
  whose names matched the description, from a food database. Where one of them \
  is the food being described, compute from ITS figures rather than from \
  memory — work out the weight eaten, then scale its per-100g figures to that \
  weight. Rows that are a different food, or a different product, are there to \
  be ignored; do not average across them and do not force a match.
- Give protein, carbs and fat in grams for every item, to the nearest gram. \
  Guess them for vague input the same way you guess the calories — a typical \
  example of that food is the right basis. Use 0 where a macro genuinely \
  isn't present (black coffee is 0/0/0); never omit a field or return null.
- Keep the macros roughly consistent with the calories you gave, at 4 kcal \
  per gram of protein and carbs and 9 per gram of fat. They will not \
  reconcile exactly and that is fine — but they should not imply far more \
  energy than the item contains.
- If there's a photo but no text, estimate from the photo alone — split into \
  multiple items only if the photo clearly shows separate distinct foods.
- Each label should be short (max 6 words), plain, and human-readable, e.g. \
  "Chicken stir fry with rice" or "Small handful of crisps".
- Respond with ONLY a JSON object, no markdown fences, no commentary: \
  {"items": [{"label": "...", "kcal": 000, "protein": 00, "carbs": 00, \
  "fat": 00, "quantified": true}]}`;

export interface EstimateInput {
  text?: string;
  imageBase64?: string;
  imageMediaType?: string;
  /**
   * Published figures for products whose names matched the text, from the same
   * databases food search uses. Optional in every sense: absent, empty, or
   * matching nothing all behave the way the estimate did before grounding
   * existed (see src/estimateGrounding.ts).
   */
  references?: EstimateReference[];
  /**
   * The account's under-reporting buffer settings. Absent reads as the fixed
   * 12% the diary applied to everyone before this was a choice.
   */
  buffer?: BufferSettings | null;
}

export interface EstimateItem {
  label: string;
  kcal: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
}

export type EstimateResult = EstimateItem[];

function buildUserContent(input: EstimateInput): Anthropic.MessageParam["content"] {
  const content: Anthropic.MessageParam["content"] = [];

  if (input.imageBase64) {
    content.push({
      type: "image",
      source: {
        type: "base64",
        media_type: (input.imageMediaType as "image/jpeg" | "image/png" | "image/webp" | "image/gif") ?? "image/jpeg",
        data: input.imageBase64,
      },
    });
  }

  const text = input.text?.trim();
  content.push({
    type: "text",
    text: text ? `Meal description: ${text}` : "No text was given, only the photo. Estimate from the photo.",
  });

  const references = input.references ?? [];
  if (references.length > 0) {
    content.push({ type: "text", text: referenceBlock(references) });
  }

  return content;
}

/**
 * The database rows, as lines the model can do arithmetic against.
 *
 * Written as plain text rather than JSON because the figures are the point and
 * the shape is not, and headed with what they are and are not: candidates that
 * matched on name, one of which may be the food, none of which has been
 * verified as the food.
 */
function referenceBlock(references: EstimateReference[]): string {
  const lines = references.map((reference) => {
    const name = [reference.brand, reference.name].filter(Boolean).join(" — ");
    const parts: string[] = [];
    if (reference.per100g) {
      const { kcal, protein, carbs, fat } = reference.per100g;
      const macros = [
        protein === null ? null : `protein ${protein}g`,
        carbs === null ? null : `carbs ${carbs}g`,
        fat === null ? null : `fat ${fat}g`,
      ].filter(Boolean);
      parts.push(`per 100g: ${kcal} kcal${macros.length ? `, ${macros.join(", ")}` : ""}`);
    }
    // The packet's own words first — "15 pieces (30 g)" says how many units
    // make a serving, which the gram figure alone cannot.
    if (reference.servingLabel) parts.push(`stated serving: ${reference.servingLabel}`);
    else if (reference.servingGrams) parts.push(`stated serving: ${reference.servingGrams}g`);
    if (reference.portion) parts.push(`one ${reference.portion.label}: ${reference.portion.kcal} kcal`);
    return `- ${name} (${parts.join("; ")})`;
  });

  return [
    "REFERENCE FIGURES — real published nutrition for products whose names",
    "matched the description. One of these may be the food described, or none",
    "of them may be. Use the figures of the one that IS the food, scaled to the",
    "amount actually eaten; ignore the rest.",
    ...lines,
  ].join("\n");
}

// Self-reported, casual food descriptions tend to skew low (portions rounded
// down, sauces/oils/extras left unmentioned), so a buffer is applied on top of
// the model's raw guess rather than trusting it as a tight estimate. How big
// that buffer is, and whether it varies per item, is the user's own setting —
// see kcalBuffer.ts.
//
// The same multiplier goes on the macros, not just the calories: the
// under-reporting it corrects for is under-reported *food*, so the protein
// and fat in that unmentioned splash of oil are missing too. Applying it to
// one and not the other would also leave every entry's macros disagreeing
// with its own calorie figure.

// ...but only where there is under-reporting to correct. "10 pieces" and
// "200g" are not portions rounded down, they are the amount, stated. Inflating
// those isn't a correction for vagueness — it's an error on the one kind of
// entry the diary has no excuse for getting wrong, and it compounds with any
// over-estimate the model has already made.
const NO_BUFFER = 1;

/**
 * The multiplier for one item.
 *
 * Two things have to agree before the buffer comes off: the model says this
 * item's amount was stated, and the text contains an amount that could have
 * been stated. Either alone is too weak — the model flag is a judgement made
 * inside a black box, and the text check can't tell which item of several the
 * amount belonged to. Together they mean an entry only escapes the buffer when
 * a real quantity was written down and the model attached it to this item.
 *
 * Drawn per call rather than once per entry, so random mode gives three items
 * logged together three different figures — which is the whole point of it.
 */
function bufferFor(quantified: unknown, textHasQuantity: boolean, buffer: ResolvedBuffer): number {
  return quantified === true && textHasQuantity ? NO_BUFFER : bufferMultiplier(buffer);
}

function parseEstimateResponse(raw: string, textHasQuantity: boolean, bufferSettings: ResolvedBuffer): EstimateResult {
  const cleaned = raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const parsed = JSON.parse(cleaned) as { items?: unknown };

  const rawItems = Array.isArray(parsed.items) ? parsed.items : [];
  const items = rawItems.map((rawItem): EstimateItem => {
    const candidate = rawItem as {
      label?: unknown;
      kcal?: unknown;
      protein?: unknown;
      carbs?: unknown;
      fat?: unknown;
      quantified?: unknown;
    };
    const label = typeof candidate.label === "string" && candidate.label.trim() ? candidate.label.trim() : "Unlabelled meal";
    const buffer = bufferFor(candidate.quantified, textHasQuantity, bufferSettings);
    const kcalNumber = typeof candidate.kcal === "number" ? candidate.kcal : Number(candidate.kcal);
    const kcal = Number.isFinite(kcalNumber) ? Math.round(kcalNumber * buffer) : null;

    // A missing or unparsable macro stays null rather than becoming 0: the
    // diary distinguishes "no protein in it" from "nobody worked it out",
    // and a silent zero would quietly drag a day's total down.
    const macro = (value: unknown): number | null => {
      const n = typeof value === "number" ? value : Number(value);
      if (!Number.isFinite(n) || n < 0) return null;
      return Math.round(n * buffer * 10) / 10;
    };

    const clamped = clampMacrosToKcal(
      { protein: macro(candidate.protein), carbs: macro(candidate.carbs), fat: macro(candidate.fat) },
      kcal,
    );

    return {
      label,
      kcal,
      proteinG: round1(clamped.protein),
      carbsG: round1(clamped.carbs),
      fatG: round1(clamped.fat),
    };
  });

  if (items.length === 0) {
    throw new Error("Model response had no items");
  }
  return items;
}

// Anthropic occasionally returns transient 5xx/overload errors that clear up
// within a few seconds; a longer, multi-attempt backoff rides those out
// instead of giving up and falling back to a manual-entry placeholder.
const ESTIMATE_RETRY_DELAYS_MS = [800, 2000, 4000];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function estimateMeal(input: EstimateInput): Promise<EstimateResult> {
  if (!input.text?.trim() && !input.imageBase64) {
    throw new Error("estimateMeal requires text and/or an image");
  }

  const attempts = ESTIMATE_RETRY_DELAYS_MS.length + 1;
  const textHasQuantity = statesExplicitQuantity(input.text);
  const bufferSettings = resolveBuffer(input.buffer);
  let lastError: unknown;

  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const message = await client.messages.create({
        model: config.ANTHROPIC_MODEL,
        // Room for the extra per-item field and for the handful of items a
        // grounded entry can legitimately split into.
        max_tokens: 500,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: buildUserContent(input) }],
      });

      const textBlock = message.content.find((block) => block.type === "text");
      if (!textBlock || textBlock.type !== "text") {
        throw new Error("No text in model response");
      }
      return parseEstimateResponse(textBlock.text, textHasQuantity, bufferSettings);
    } catch (error) {
      lastError = error;
      console.error(`Estimate attempt ${attempt + 1}/${attempts} failed:`, error);
      const delay = ESTIMATE_RETRY_DELAYS_MS[attempt];
      if (delay !== undefined) {
        await sleep(delay);
      }
    }
  }

  // Only the final give-up is recorded: a retried blip that then succeeded
  // isn't a fault worth waking anyone for, whereas an entry that reached the
  // user with no calorie figure is.
  void recordError("estimate", lastError);
  return [
    {
      label: input.text?.trim()?.slice(0, 60) || "Unestimated meal (tap to add kcal)",
      kcal: null,
      proteinG: null,
      carbsG: null,
      fatG: null,
    },
  ];
}
