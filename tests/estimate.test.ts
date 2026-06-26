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

import { estimateMeal } from "../src/estimate";

function textResponse(json: unknown) {
  return { content: [{ type: "text", text: JSON.stringify(json) }] };
}

beforeEach(() => {
  createMock.mockReset();
});

describe("estimateMeal", () => {
  it("returns a single item for a single dish described with multiple ingredients, with the buffer applied", async () => {
    createMock.mockResolvedValueOnce(
      textResponse({ items: [{ label: "Chicken stir fry with rice", kcal: 650 }] }),
    );

    const result = await estimateMeal({ text: "chicken stir fry with rice" });

    // 650 * 1.12 = 728
    expect(result).toEqual([{ label: "Chicken stir fry with rice", kcal: 728 }]);
    expect(createMock).toHaveBeenCalledTimes(1);
  });

  it("splits multiple distinct foods in one entry into separate items, buffering each", async () => {
    createMock.mockResolvedValueOnce(
      textResponse({
        items: [
          { label: "Chicken stir fry with rice", kcal: 650 },
          { label: "Small handful of crisps", kcal: 120 },
        ],
      }),
    );

    const result = await estimateMeal({
      text: "chicken stir fry with rice, small handful of crisps",
    });

    // 650 * 1.12 = 728, 120 * 1.12 = 134.4 -> rounds to 134
    expect(result).toEqual([
      { label: "Chicken stir fry with rice", kcal: 728 },
      { label: "Small handful of crisps", kcal: 134 },
    ]);
  });

  it("retries a transient stream failure and still returns a real, buffered estimate", async () => {
    createMock
      .mockRejectedValueOnce(new Error("ERR_STREAM_PREMATURE_CLOSE"))
      .mockResolvedValueOnce(textResponse({ items: [{ label: "Sandwich", kcal: 400 }] }));

    const result = await estimateMeal({ text: "a sandwich" });

    // 400 * 1.12 = 448
    expect(result).toEqual([{ label: "Sandwich", kcal: 448 }]);
    expect(createMock).toHaveBeenCalledTimes(2);
  });

  it("only falls back to a manual-entry placeholder once every retry has failed", async () => {
    createMock.mockRejectedValue(new Error("ERR_STREAM_PREMATURE_CLOSE"));

    const result = await estimateMeal({ text: "mystery meal" });

    expect(createMock).toHaveBeenCalledTimes(4);
    expect(result).toEqual([{ label: "mystery meal", kcal: null }]);
  }, 15000);
});
