import Anthropic from "@anthropic-ai/sdk";
import { config } from "./config";
import { localDayLabel } from "./matchWeek";
import { recordError } from "./errorLog";

const client = new Anthropic({ apiKey: config.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You are a supportive coach writing a short end-of-week review of \
someone's food diary. Ground everything in the specific foods, times and \
patterns actually logged — never generic advice that could apply to anyone. \
Do not assume the reader's sex, age or body: write to the person whose diary \
this is, from what is in it.

Write four short sections:
- wentWell: what they did well this week
- couldImprove: specific things that could have gone better
- noticed: patterns about their own week they likely weren't consciously aware of (repetition, portion drift, calorie spread across days, food choices, etc.)
- easyWins: small, concrete changes that would compound into a bigger impact over time

Rules:
- Each section: 2-3 bullet points, each a single plain sentence, specific and \
  concrete (reference actual foods and days where it helps). Never preachy, \
  never guilt-tripping, no macro breakdowns, no calorie-counting-app tone.
- The diary timestamps are when entries were LOGGED, not when the food was eaten. \
  Never comment on meal timing, eating times, or time of day.
- Some days may come with a note the member wrote about what was going on \
  (illness, travel, an occasion). Take those at face value and let them \
  explain the week — never second-guess them or treat them as excuses.
- If a week is too sparse to say something specific and genuine for a section, \
  it's fine for that section to have fewer points, or even none, rather than \
  inventing detail.
- Respond with ONLY JSON, no markdown fences, no commentary: \
  {"wentWell": ["..."], "couldImprove": ["..."], "noticed": ["..."], "easyWins": ["..."]}`;

export interface WeekInsights {
  wentWell: string[];
  couldImprove: string[];
  noticed: string[];
  easyWins: string[];
}

export interface InsightsEntry {
  label: string;
  kcal: number | null;
  timestamp: Date;
  // Null for an entry the user deliberately left untagged.
  mealType: string | null;
}

export interface InsightsInput {
  entries: InsightsEntry[];
  totalKcal: number;
  dailyAverage: number;
  daysLogged: number;
  timeZone: string;
  /**
   * What the user wrote about particular days — "food poisoning", "stag do".
   * Without these the review could only guess at why a week looked odd, and
   * a guess about someone's bad week reads badly.
   */
  dayNotes?: { date: string; note: string }[];
}

function buildPrompt(input: InsightsInput): string {
  const lines = input.entries.map((entry) => {
    const day = localDayLabel(entry.timestamp, input.timeZone);
    const kcal = entry.kcal === null ? "kcal unknown" : `${entry.kcal} kcal`;
    return `- ${day}: ${entry.label} — ${kcal}`;
  });

  const noteLines = (input.dayNotes ?? []).map((note) => `- ${note.date}: ${note.note}`);

  return [
    `Week total: ${input.totalKcal} kcal`,
    `Daily average: ${input.dailyAverage} kcal over ${input.daysLogged} day${input.daysLogged === 1 ? "" : "s"} logged`,
    "",
    "Entries:",
    ...lines,
    ...(noteLines.length > 0 ? ["", "What they said was going on those days:", ...noteLines] : []),
  ].join("\n");
}

function parseInsightsResponse(raw: string): WeekInsights {
  const cleaned = raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const parsed = JSON.parse(cleaned) as Record<string, unknown>;

  const toList = (value: unknown): string[] =>
    Array.isArray(value)
      ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
      : [];

  return {
    wentWell: toList(parsed.wentWell),
    couldImprove: toList(parsed.couldImprove),
    noticed: toList(parsed.noticed),
    easyWins: toList(parsed.easyWins),
  };
}

/**
 * Best-effort: report export must never fail just because the review couldn't
 * be generated, so failures and empty results both resolve to null and the
 * PDF simply skips the summary section.
 */
export async function generateWeekInsights(input: InsightsInput): Promise<WeekInsights | null> {
  if (input.entries.length === 0) return null;

  try {
    const message = await client.messages.create({
      model: config.ANTHROPIC_MODEL,
      max_tokens: 600,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildPrompt(input) }],
    });

    const textBlock = message.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("No text in model response");
    }

    const insights = parseInsightsResponse(textBlock.text);
    const isEmpty = Object.values(insights).every((list) => list.length === 0);
    return isEmpty ? null : insights;
  } catch (error) {
    void recordError("insights", error);
    return null;
  }
}
