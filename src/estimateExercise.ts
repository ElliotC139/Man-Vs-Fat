import Anthropic from "@anthropic-ai/sdk";
import { config } from "./config";
import { recordError } from "./errorLog";

const client = new Anthropic({ apiKey: config.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You estimate calories burned during exercise. Given a text description \
and/or a screenshot from a fitness tracker or activity app, return the kcal burned and a \
short description.

Rules:
- If the input is a screenshot from a fitness app that already shows calories burned, read \
  that number directly — do not re-estimate.
- For text descriptions, estimate kcal burned based on the activity, duration, and any \
  intensity cues given. Where body stats are supplied below, use them; otherwise use \
  sensible averages for an adult of unspecified sex rather than assuming one.
- description: 6 words max, plain English (e.g. "30 min run", "45 min cycling", "1 hr gym")
- kcalBurned: whole number best estimate; null only if it genuinely cannot be estimated at all
- Respond with ONLY a JSON object, no markdown fences, no commentary: \
  {"description": "...", "kcalBurned": 000}`;

export interface ExerciseEstimate {
  description: string;
  kcalBurned: number | null;
}

function buildContent(text?: string, imageBase64?: string, imageMediaType?: string): Anthropic.MessageParam["content"] {
  const content: Anthropic.MessageParam["content"] = [];
  if (imageBase64) {
    content.push({
      type: "image",
      source: {
        type: "base64",
        media_type: (imageMediaType as "image/jpeg" | "image/png" | "image/webp" | "image/gif") ?? "image/jpeg",
        data: imageBase64,
      },
    });
  }
  const trimmed = text?.trim();
  content.push({
    type: "text",
    text: trimmed
      ? `Exercise description: ${trimmed}`
      : "No text was given, only the screenshot. Read the calories from the screenshot.",
  });
  return content;
}

function parseResponse(raw: string): ExerciseEstimate {
  const cleaned = raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const parsed = JSON.parse(cleaned) as { description?: unknown; kcalBurned?: unknown };
  const description =
    typeof parsed.description === "string" && parsed.description.trim()
      ? parsed.description.trim()
      : "Exercise";
  const kcalRaw = typeof parsed.kcalBurned === "number" ? parsed.kcalBurned : Number(parsed.kcalBurned);
  const kcalBurned = Number.isFinite(kcalRaw) && kcalRaw > 0 ? Math.round(kcalRaw) : null;
  return { description, kcalBurned };
}

export async function estimateExercise(
  text?: string,
  imageBase64?: string,
  imageMediaType?: string,
): Promise<ExerciseEstimate> {
  if (!text?.trim() && !imageBase64) {
    throw new Error("estimateExercise requires text and/or an image");
  }

  try {
    const message = await client.messages.create({
      model: config.ANTHROPIC_MODEL,
      max_tokens: 100,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildContent(text, imageBase64, imageMediaType) }],
    });
    const textBlock = message.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") throw new Error("No text in response");
    return parseResponse(textBlock.text);
  } catch (error) {
    void recordError("estimateExercise", error);
    const fallbackDescription = text?.trim()?.slice(0, 50) || "Exercise";
    return { description: fallbackDescription, kcalBurned: null };
  }
}
