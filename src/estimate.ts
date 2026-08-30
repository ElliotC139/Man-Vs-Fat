import Anthropic from "@anthropic-ai/sdk";
import { config } from "./config";
import { recordError } from "./errorLog";

const client = new Anthropic({ apiKey: config.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You help someone keep a deliberately rough, low-friction food diary. \
You are not a calorie-counting app and must not behave like one: no macro \
breakdowns, no health commentary, no warnings, no guilt-tripping, no ranges. \
Given a short free-text description and/or a photo, identify each distinct \
food/meal/snack/drink being logged and give each one its own best-guess kcal \
estimate.

Rules:
- Treat the components of a single dish as ONE item — "chicken stir fry with \
  rice" is one item, not three. Only split into multiple items when the \
  input clearly describes separate, distinct things eaten (separate dishes, \
  snacks, or drinks), however they're separated: commas, "and", "also", \
  newlines, or just listed one after another. Most entries are a single item.
- Always give exactly one whole-number kcal guess per item, even for vague \
  input ("just a sandwich", "some crisps").
- If there's a photo but no text, estimate from the photo alone — split into \
  multiple items only if the photo clearly shows separate distinct foods.
- Each label should be short (max 6 words), plain, and human-readable, e.g. \
  "Chicken stir fry with rice" or "Small handful of crisps".
- Respond with ONLY a JSON object, no markdown fences, no commentary: \
  {"items": [{"label": "...", "kcal": 000}]}`;

export interface EstimateInput {
  text?: string;
  imageBase64?: string;
  imageMediaType?: string;
}

export interface EstimateItem {
  label: string;
  kcal: number | null;
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
const KCAL_BUFFER_MULTIPLIER = 1.12;

function parseEstimateResponse(raw: string): EstimateResult {
  const cleaned = raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const parsed = JSON.parse(cleaned) as { items?: unknown };

  const rawItems = Array.isArray(parsed.items) ? parsed.items : [];
  const items = rawItems.map((rawItem): EstimateItem => {
    const candidate = rawItem as { label?: unknown; kcal?: unknown };
    const label = typeof candidate.label === "string" && candidate.label.trim() ? candidate.label.trim() : "Unlabelled meal";
    const kcalNumber = typeof candidate.kcal === "number" ? candidate.kcal : Number(candidate.kcal);
    const kcal = Number.isFinite(kcalNumber) ? Math.round(kcalNumber * KCAL_BUFFER_MULTIPLIER) : null;
    return { label, kcal };
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
    },
  ];
}
