import { beforeEach, describe, expect, it, vi } from "vitest";

const createMock = vi.hoisted(() => vi.fn());

vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = { create: createMock };
  },
}));

vi.mock("../src/config", () => ({
  config: { ANTHROPIC_API_KEY: "test-key", ANTHROPIC_MODEL: "test-model" },
}));

import { generateWeekInsights } from "../src/insights";

function textResponse(json: unknown) {
  return { content: [{ type: "text", text: JSON.stringify(json) }] };
}

const baseInput = {
  entries: [
    { label: "Chicken stir fry", kcal: 728, timestamp: new Date("2026-06-23T18:00:00Z"), mealType: "dinner" },
  ],
  totalKcal: 728,
  dailyAverage: 728,
  daysLogged: 1,
  timeZone: "Europe/London",
};

beforeEach(() => {
  createMock.mockReset();
});

describe("generateWeekInsights", () => {
  it("returns null without calling the model when there are no entries", async () => {
    const result = await generateWeekInsights({ ...baseInput, entries: [] });
    expect(result).toBeNull();
    expect(createMock).not.toHaveBeenCalled();
  });

  it("parses a well-formed response into the four sections", async () => {
    createMock.mockResolvedValueOnce(
      textResponse({
        wentWell: ["Logged dinner every day"],
        couldImprove: ["Breakfast was skipped most days"],
        noticed: ["All entries logged in the evening"],
        easyWins: ["Add a quick breakfast log to even things out"],
      }),
    );

    const result = await generateWeekInsights(baseInput);

    expect(result).toEqual({
      wentWell: ["Logged dinner every day"],
      couldImprove: ["Breakfast was skipped most days"],
      noticed: ["All entries logged in the evening"],
      easyWins: ["Add a quick breakfast log to even things out"],
    });
  });

  it("drops non-string entries from a section's list", async () => {
    createMock.mockResolvedValueOnce(
      textResponse({
        wentWell: ["Good variety", 42, null],
        couldImprove: [],
        noticed: [],
        easyWins: [],
      }),
    );

    const result = await generateWeekInsights(baseInput);

    expect(result).toEqual({ wentWell: ["Good variety"], couldImprove: [], noticed: [], easyWins: [] });
  });

  it("returns null if every section in the response is empty", async () => {
    createMock.mockResolvedValueOnce(textResponse({ wentWell: [], couldImprove: [], noticed: [], easyWins: [] }));

    const result = await generateWeekInsights(baseInput);
    expect(result).toBeNull();
  });

  it("returns null instead of throwing when the model call fails", async () => {
    createMock.mockRejectedValueOnce(new Error("boom"));

    const result = await generateWeekInsights(baseInput);
    expect(result).toBeNull();
  });

  it("returns null when the response isn't valid JSON", async () => {
    createMock.mockResolvedValueOnce({ content: [{ type: "text", text: "not json" }] });

    const result = await generateWeekInsights(baseInput);
    expect(result).toBeNull();
  });
});
