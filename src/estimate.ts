import Anthropic from "@anthropic-ai/sdk";
import { config } from "./config";

const client = new Anthropic({ apiKey: config.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You help someone keep a deliberately rough, low-friction food diary. \
You are not a calorie-counting app and must not behave like one: no macro \
breakdowns, no health commentary, no warnings, no guilt-tripping, no ranges. \
Given a short free-text description of a meal and/or a photo of it, respond \
with a single best-guess estimate.

Rules:
- Always give exactly one whole-number kcal guess, even for vague input \
  ("just a sandwich", "some crisps") or multiple items in one entry (sum \
  them into one number).
- If there's a photo but no text, estimate from the photo alone.
- The label should be short (max 6 words), plain, and human-readable, e.g. \
  "Chicken stir fry with rice" or "Sandwich and crisps".
- Respond with ONLY a JSON object, no markdown fences, no commentary: \
  {"label": "...", "kcal": 000}`;

export interface EstimateInput {
  text?: string;
  imageBase64?: string;
  imageMediaType?: string;
}

export interface EstimateResult {
  label: string;
  kcal: number | null;
}

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

function parseEstimateResponse(raw: string): EstimateResult {
  const cleaned = raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const parsed = JSON.parse(cleaned) as { label?: unknown; kcal?: unknown };

  const label = typeof parsed.label === "string" && parsed.label.trim() ? parsed.label.trim() : "Unlabelled meal";
  const kcalNumber = typeof parsed.kcal === "number" ? parsed.kcal : Number(parsed.kcal);
  const kcal = Number.isFinite(kcalNumber) ? Math.round(kcalNumber) : null;

  return { label, kcal };
}

export async function estimateMeal(input: EstimateInput): Promise<EstimateResult> {
  if (!input.text?.trim() && !input.imageBase64) {
    throw new Error("estimateMeal requires text and/or an image");
  }

  try {
    const message = await client.messages.create({
      model: config.ANTHROPIC_MODEL,
      max_tokens: 200,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildUserContent(input) }],
    });

    const textBlock = message.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("No text in model response");
    }
    return parseEstimateResponse(textBlock.text);
  } catch (error) {
    console.error("Estimate failed, falling back to a manual-entry placeholder:", error);
    return {
      label: input.text?.trim()?.slice(0, 60) || "Unestimated meal (tap to add kcal)",
      kcal: null,
    };
  }
}
