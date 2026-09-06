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

import { estimateRecipeFromPhoto } from "../src/estimateRecipe";

/** What the rest of the label reads as when the photo's reply omits it. */
const NO_NUTRIENTS = { fibreG: null, sugarG: null, satFatG: null, saltG: null };

function textResponse(json: unknown) {
  return { content: [{ type: "text", text: JSON.stringify(json) }] };
}

beforeEach(() => {
  createMock.mockReset();
});

describe("estimateRecipeFromPhoto", () => {
  it("reads a photographed recipe into a draft", async () => {
    createMock.mockResolvedValueOnce(
      textResponse({
        name: "Chilli con carne",
        servings: 4,
        items: [
          { label: "500g beef mince", kcal: 1150, protein: 100, carbs: 0, fat: 82 },
          { label: "400g tinned tomatoes", kcal: 76, protein: 4, carbs: 12, fat: 1 },
        ],
      }),
    );

    const draft = await estimateRecipeFromPhoto("base64data");

    expect(draft.name).toBe("Chilli con carne");
    expect(draft.servings).toBe(4);
    expect(draft.items).toEqual([
      { label: "500g beef mince", kcal: 1150, proteinG: 100, carbsG: 0, fatG: 82, ...NO_NUTRIENTS },
      { label: "400g tinned tomatoes", kcal: 76, proteinG: 4, carbsG: 12, fatG: 1, ...NO_NUTRIENTS },
    ]);
  });

  it("never returns zero servings, which would divide by nothing downstream", async () => {
    createMock.mockResolvedValueOnce(
      textResponse({ name: "Soup", servings: 0, items: [{ label: "Stock", kcal: 20 }] }),
    );
    expect((await estimateRecipeFromPhoto("x")).servings).toBe(1);

    createMock.mockResolvedValueOnce(
      textResponse({ name: "Soup", items: [{ label: "Stock", kcal: 20 }] }),
    );
    expect((await estimateRecipeFromPhoto("x")).servings).toBe(1);
  });

  it("drops a line with no name rather than showing it as 'Unlabelled'", async () => {
    // A row with figures and no ingredient is nothing the user can act on.
    createMock.mockResolvedValueOnce(
      textResponse({
        name: "Stew",
        servings: 2,
        items: [{ label: "", kcal: 300 }, { label: "Carrots", kcal: 40 }],
      }),
    );

    const draft = await estimateRecipeFromPhoto("x");
    expect(draft.items.map((i) => i.label)).toEqual(["Carrots"]);
  });

  it("caps a saturated fat figure at the fat it is part of", async () => {
    // Eight figures per line is more room to be inconsistent, and a line
    // claiming more saturated fat than fat is not a thing a food can be.
    createMock.mockResolvedValueOnce(
      textResponse({
        name: "Fry-up",
        servings: 1,
        items: [{ label: "Butter", kcal: 100, fat: 11, satFat: 20, carbs: 0, sugar: 5 }],
      }),
    );

    const draft = await estimateRecipeFromPhoto("x");
    expect(draft.items[0]!.satFatG).toBe(11);
    expect(draft.items[0]!.sugarG).toBe(0);
  });

  it("returns no items when the photo isn't a recipe, rather than inventing one", async () => {
    createMock.mockResolvedValueOnce(textResponse({ items: [] }));

    const draft = await estimateRecipeFromPhoto("x");
    expect(draft.items).toEqual([]);
    expect(draft.name).toBe("");
  });

  it("retries a transient failure before giving up", async () => {
    createMock
      .mockRejectedValueOnce(new Error("ERR_STREAM_PREMATURE_CLOSE"))
      .mockResolvedValueOnce(
        textResponse({ name: "Stew", servings: 2, items: [{ label: "Carrots", kcal: 40 }] }),
      );

    const draft = await estimateRecipeFromPhoto("x");
    expect(draft.name).toBe("Stew");
    expect(createMock).toHaveBeenCalledTimes(2);
  });

  it("throws once every retry has failed, so the waiting user is told", async () => {
    // Different from "no recipe in this photo", and the person on the other
    // end deserves to know which happened.
    createMock.mockRejectedValue(new Error("ERR_STREAM_PREMATURE_CLOSE"));

    await expect(estimateRecipeFromPhoto("x")).rejects.toThrow(/Couldn't read that photo/);
  }, 15000);
});
