import Anthropic from "@anthropic-ai/sdk";
import { config } from "./config";
import { recordError } from "./errorLog";
import { clampMacrosToKcal } from "./macros";

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
  {"items": [{"label": "...", "kcal": 000, "protein": 00, "carbs": 00, "fat": 00}]}`;

export interface EstimateInput {
  text?: string;
  imageBase64?: string;
  imageMediaType?: string;
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

  return content;
}

// Self-reported, casual food descriptions tend to skew low (portions rounded
// down, sauces/oils/extras left unmentioned), so a fixed buffer is applied on
// top of the model's raw guess rather than trusting it as a tight estimate.
//
// The same multiplier goes on the macros, not just the calories: the
// under-reporting it corrects for is under-reported *food*, so the protein
// and fat in that unmentioned splash of oil are missing too. Applying it to
// one and not the other would also leave every entry's macros disagreeing
// with its own calorie figure by 12%.
const KCAL_BUFFER_MULTIPLIER = 1.12;

function parseEstimateResponse(raw: string): EstimateResult {
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
    };
    const label = typeof candidate.label === "string" && candidate.label.trim() ? candidate.label.trim() : "Unlabelled meal";
    const kcalNumber = typeof candidate.kcal === "number" ? candidate.kcal : Number(candidate.kcal);
    const kcal = Number.isFinite(kcalNumber) ? Math.round(kcalNumber * KCAL_BUFFER_MULTIPLIER) : null;

    // A missing or unparsable macro stays null rather than becoming 0: the
    // diary distinguishes "no protein in it" from "nobody worked it out",
    // and a silent zero would quietly drag a day's total down.
    const macro = (value: unknown): number | null => {
      const n = typeof value === "number" ? value : Number(value);
      if (!Number.isFinite(n) || n < 0) return null;
      return Math.round(n * KCAL_BUFFER_MULTIPLIER * 10) / 10;
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
  let lastError: unknown;

  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const message = await client.messages.create({
        model: config.ANTHROPIC_MODEL,
        max_tokens: 300,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: buildUserContent(input) }],
      });

      const textBlock = message.content.find((block) => block.type === "text");
      if (!textBlock || textBlock.type !== "text") {
        throw new Error("No text in model response");
      }
      return parseEstimateResponse(textBlock.text);
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
