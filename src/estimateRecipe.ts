/**
 * Reading a recipe off a photograph.
 *
 * Typing a recipe in is the reason most people never save one: a dozen
 * ingredients, each with a figure to look up. A photo of the page — a book, a
 * packet, a screenshot, something handwritten — is the whole thing in one tap.
 *
 * What comes back is a draft, never a saved recipe. It goes into the editor
 * the user already knows so they can check it, fix the portions and decide
 * whether to keep it — the app's standing rule that nothing it guessed reaches
 * the diary before somebody has looked at it.
 */

import Anthropic from "@anthropic-ai/sdk";
import { config } from "./config";
import { recordError } from "./errorLog";

const client = new Anthropic({ apiKey: config.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You read a photograph of a recipe and turn it into a list \
of ingredients with calorie and macro figures.

Rules:
- Read the recipe as written. The ingredients are the ones on the page, in the \
  amounts on the page — do not substitute, do not round a quantity to a nicer \
  number, and do not add an ingredient the recipe doesn't list.
- Give each ingredient its own line, with the amount in the label as the \
  recipe states it ("400g tinned tomatoes", "2 tbsp olive oil").
- Every line gets whole-number kcal and grams of protein, carbohydrate and fat \
  FOR THE AMOUNT IN THE LABEL, not per 100g. Two tablespoons of oil is the \
  figure for two tablespoons.
- Work out the amount before the calories, exactly as you would for a meal: \
  the weight or volume stated, times the food's per-100g figures.
- "servings" is how many portions the whole recipe makes, as the page states \
  it. If it doesn't say, judge it from the quantities and say so by giving \
  your best number — never 0, never null.
- "name" is what the recipe is called, short and plain. If the page has no \
  title, name it after what it obviously is ("Chicken and chorizo stew").
- Ignore the method, cooking times, equipment and any commentary. Only the \
  ingredients matter.
- If the photo is not a recipe, or nothing legible can be read from it, return \
  {"items": []} and nothing else. Do not invent a recipe to fill the gap.
- Respond with ONLY a JSON object, no markdown fences, no commentary: \
  {"name": "...", "servings": 4, "items": [{"label": "...", "kcal": 000, \
  "protein": 00, "carbs": 00, "fat": 00}]}`;

export interface RecipeDraftItem {
  label: string;
  kcal: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
}

export interface RecipeDraft {
  name: string;
  servings: number;
  items: RecipeDraftItem[];
}

/** A recipe photo is a page of text, so it needs more room than a meal guess. */
const MAX_TOKENS = 2000;

const RETRY_DELAYS_MS = [800, 2000];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function num(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function parseDraft(raw: string): RecipeDraft {
  const cleaned = raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const parsed = JSON.parse(cleaned) as { name?: unknown; servings?: unknown; items?: unknown };

  const rawItems = Array.isArray(parsed.items) ? parsed.items : [];
  const items = rawItems
    .map((rawItem): RecipeDraftItem | null => {
      const candidate = rawItem as Record<string, unknown>;
      const label = typeof candidate.label === "string" ? candidate.label.trim() : "";
      // A line with no name is not an ingredient, whatever figures came with
      // it — dropped rather than shown as "Unlabelled" for the user to decode.
      if (!label) return null;
      return {
        label: label.slice(0, 200),
        kcal: num(candidate.kcal) === null ? null : Math.round(num(candidate.kcal)!),
        proteinG: num(candidate.protein),
        carbsG: num(candidate.carbs),
        fatG: num(candidate.fat),
      };
    })
    .filter((item): item is RecipeDraftItem => item !== null)
    .slice(0, 50);

  const servings = num(parsed.servings);
  return {
    name: typeof parsed.name === "string" && parsed.name.trim() ? parsed.name.trim().slice(0, 80) : "",
    // A recipe that makes no portions divides by zero downstream, so an absent
    // or nonsense figure lands on one rather than on nothing.
    servings: servings && servings > 0 ? Math.min(100, Math.round(servings * 2) / 2) : 1,
    items,
  };
}

/**
 * Reads a recipe photo into a draft, or throws.
 *
 * Throws rather than returning an empty draft on failure, because the caller
 * has a person waiting on a screen: "couldn't read that photo" is a different
 * thing from "that photo has no recipe in it", and they deserve to be told
 * which happened.
 */
export async function estimateRecipeFromPhoto(
  imageBase64: string,
  imageMediaType = "image/jpeg",
): Promise<RecipeDraft> {
  const attempts = RETRY_DELAYS_MS.length + 1;
  let lastError: unknown;

  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const message = await client.messages.create({
        model: config.ANTHROPIC_MODEL,
        max_tokens: MAX_TOKENS,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: imageMediaType as "image/jpeg" | "image/png" | "image/webp" | "image/gif",
                  data: imageBase64,
                },
              },
              { type: "text", text: "Read this recipe." },
            ],
          },
        ],
      });

      const textBlock = message.content.find((block) => block.type === "text");
      if (!textBlock || textBlock.type !== "text") throw new Error("No text in model response");
      return parseDraft(textBlock.text);
    } catch (error) {
      lastError = error;
      console.error(`Recipe scan attempt ${attempt + 1}/${attempts} failed:`, error);
      const delay = RETRY_DELAYS_MS[attempt];
      if (delay !== undefined) await sleep(delay);
    }
  }

  void recordError("estimateRecipe", lastError);
  throw new Error("Couldn't read that photo — try again, or add the recipe by hand.");
}
