import { beforeEach, describe, expect, it, vi } from "vitest";

const createMock = vi.hoisted(() => vi.fn());

vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = { create: createMock };
  },
}));

vi.mock("../src/config", () => ({
  // reconcileAdmin and toPublicUser both read this on every sign-in.
  adminUsernames: [],
  config: { ANTHROPIC_API_KEY: "test-key", ANTHROPIC_MODEL: "test-model" },
}));

import { estimateMeal } from "../src/estimate";

/**
 * What the four label figures come back as when the model's reply doesn't
 * carry them — null, never zero. Spread into the expectations rather than
 * loosened to toMatchObject, because the exact shape is the point: these
 * assertions exist to catch a figure quietly becoming 0.
 */
const NO_NUTRIENTS = { fibreG: null, sugarG: null, satFatG: null, saltG: null };

/**
 * The amount, when the model's reply said nothing about one — one of whatever
 * this is, in no named unit. Spread alongside NO_NUTRIENTS for the same
 * reason: an estimate that quietly starts claiming a quantity it never worked
 * out would rescale the calories under whoever logged it.
 */
const ONE_OF_IT = { quantity: 1, unitLabel: null };

function textResponse(json: unknown) {
  return { content: [{ type: "text", text: JSON.stringify(json) }] };
}

beforeEach(() => {
  createMock.mockReset();
});

describe("estimateMeal", () => {
  it("returns a single item for a single dish described with multiple ingredients, with the buffer applied", async () => {
    createMock.mockResolvedValueOnce(
      textResponse({
        items: [{ label: "Chicken stir fry with rice", kcal: 650, protein: 40, carbs: 70, fat: 18 }],
      }),
    );

    const result = await estimateMeal({ text: "chicken stir fry with rice" });

    // 650 * 1.12 = 728
    // The buffer goes on the macros as well as the calories, so an entry's
    // four figures stay consistent with each other.
    expect(result).toEqual([
      { label: "Chicken stir fry with rice", kcal: 728, proteinG: 44.8, carbsG: 78.4, fatG: 20.2, ...NO_NUTRIENTS, ...ONE_OF_IT },
    ]);
    expect(createMock).toHaveBeenCalledTimes(1);
  });

  it("splits multiple distinct foods in one entry into separate items, buffering each", async () => {
    createMock.mockResolvedValueOnce(
      textResponse({
        items: [
          { label: "Chicken stir fry with rice", kcal: 650, protein: 40, carbs: 70, fat: 18 },
          { label: "Small handful of crisps", kcal: 120, protein: 1, carbs: 13, fat: 7 },
        ],
      }),
    );

    const result = await estimateMeal({
      text: "chicken stir fry with rice, small handful of crisps",
    });

    // 650 * 1.12 = 728, 120 * 1.12 = 134.4 -> rounds to 134
    expect(result).toEqual([
      { label: "Chicken stir fry with rice", kcal: 728, proteinG: 44.8, carbsG: 78.4, fatG: 20.2, ...NO_NUTRIENTS, ...ONE_OF_IT },
      { label: "Small handful of crisps", kcal: 134, proteinG: 1.1, carbsG: 14.6, fatG: 7.8, ...NO_NUTRIENTS, ...ONE_OF_IT },
    ]);
  });

  it("retries a transient stream failure and still returns a real, buffered estimate", async () => {
    createMock
      .mockRejectedValueOnce(new Error("ERR_STREAM_PREMATURE_CLOSE"))
      .mockResolvedValueOnce(
        textResponse({ items: [{ label: "Sandwich", kcal: 400, protein: 20, carbs: 45, fat: 14 }] }),
      );

    const result = await estimateMeal({ text: "a sandwich" });

    // 400 * 1.12 = 448
    expect(result).toEqual([{ label: "Sandwich", kcal: 448, proteinG: 22.4, carbsG: 50.4, fatG: 15.7, ...NO_NUTRIENTS, ...ONE_OF_IT }]);
    expect(createMock).toHaveBeenCalledTimes(2);
  });

  it("leaves a stated amount alone instead of inflating it", async () => {
    // The entry that prompted this: ten small buttons is roughly 22g of white
    // chocolate. Whatever the model says it comes to, the person has told us
    // the amount — buffering it for "portions guessed low" adds 12% of pure
    // error to the one kind of entry with nothing vague about it.
    createMock.mockResolvedValueOnce(
      textResponse({
        items: [
          { label: "Milkybar Giant Buttons", kcal: 122, protein: 2, carbs: 13, fat: 7, quantified: true },
        ],
      }),
    );

    const result = await estimateMeal({
      text: "Milkybar White Chocolate Giant Buttons (10 pieces)",
    });

    expect(result).toEqual([
      { label: "Milkybar Giant Buttons", kcal: 122, proteinG: 2, carbsG: 13, fatG: 7, ...NO_NUTRIENTS, ...ONE_OF_IT },
    ]);
  });

  it("still buffers a quantified claim the text cannot support", async () => {
    // The model flagging every item quantified would silently switch the
    // buffer off for the whole diary, so the text has to agree.
    createMock.mockResolvedValueOnce(
      textResponse({
        items: [{ label: "Sandwich", kcal: 400, protein: 20, carbs: 45, fat: 14, quantified: true }],
      }),
    );

    const result = await estimateMeal({ text: "just a sandwich" });

    // 400 * 1.12 = 448 — the buffer stands.
    expect(result).toEqual([{ label: "Sandwich", kcal: 448, proteinG: 22.4, carbsG: 50.4, fatG: 15.7, ...NO_NUTRIENTS, ...ONE_OF_IT }]);
  });

  it("buffers each item on its own, not the whole entry", async () => {
    createMock.mockResolvedValueOnce(
      textResponse({
        items: [
          { label: "Chicken breast", kcal: 330, protein: 62, carbs: 0, fat: 7, quantified: true },
          { label: "Chips", kcal: 300, protein: 4, carbs: 40, fat: 14, quantified: false },
        ],
      }),
    );

    const result = await estimateMeal({ text: "200g chicken breast and some chips" });

    // The weighed chicken is left alone; the unmeasured chips still get the
    // buffer (300 * 1.12 = 336).
    expect(result[0]).toEqual({ label: "Chicken breast", kcal: 330, proteinG: 62, carbsG: 0, fatG: 7, ...NO_NUTRIENTS, ...ONE_OF_IT });
    expect(result[1]!.kcal).toBe(336);
  });

  it("passes database figures to the model as reference, when there are any", async () => {
    createMock.mockResolvedValueOnce(
      textResponse({
        items: [{ label: "Milkybar buttons", kcal: 109, protein: 2, carbs: 12, fat: 6, quantified: true }],
      }),
    );

    await estimateMeal({
      text: "Milkybar Giant Buttons (10 pieces)",
      references: [
        {
          name: "Milkybar Giant Buttons",
          brand: "Nestlé",
          per100g: { kcal: 543, protein: 7.7, carbs: 57.6, fat: 31.3 },
          portion: null,
          servingGrams: 30,
          // Straight off the packet, and the line that makes the sum exact:
          // 10 of 15 pieces is two thirds of a 163 kcal serving = 109 kcal.
          servingLabel: "15 pieces (30 g)",
        },
      ],
    });

    const content = createMock.mock.calls[0]![0].messages[0].content;
    const sent = content.map((block: { text?: string }) => block.text ?? "").join("\n");
    expect(sent).toContain("REFERENCE FIGURES");
    expect(sent).toContain("Nestlé — Milkybar Giant Buttons");
    expect(sent).toContain("per 100g: 543 kcal, protein 7.7g, carbs 57.6g, fat 31.3g");
    // The count-per-serving has to reach the model, not just the gram figure.
    expect(sent).toContain("stated serving: 15 pieces (30 g)");
  });

  it("sends no reference block when nothing matched", async () => {
    createMock.mockResolvedValueOnce(
      textResponse({ items: [{ label: "Stir fry", kcal: 650, protein: 40, carbs: 70, fat: 18 }] }),
    );

    await estimateMeal({ text: "chicken stir fry", references: [] });

    const content = createMock.mock.calls[0]![0].messages[0].content;
    expect(content).toHaveLength(1);
  });

  it("uses the account's own buffer rather than the old fixed 12%", async () => {
    createMock.mockResolvedValueOnce(
      textResponse({ items: [{ label: "Sandwich", kcal: 400, protein: 20, carbs: 45, fat: 14 }] }),
    );

    const result = await estimateMeal({ text: "a sandwich", buffer: { kcalBufferPct: 25 } });

    // 400 * 1.25 = 500
    expect(result[0]!.kcal).toBe(500);
  });

  it("applies nothing at all when the buffer is set to zero", async () => {
    createMock.mockResolvedValueOnce(
      textResponse({ items: [{ label: "Sandwich", kcal: 400, protein: 20, carbs: 45, fat: 14 }] }),
    );

    const result = await estimateMeal({ text: "a sandwich", buffer: { kcalBufferPct: 0 } });

    expect(result[0]!.kcal).toBe(400);
    expect(result[0]!.proteinG).toBe(20);
  });

  it("only falls back to a manual-entry placeholder once every retry has failed", async () => {
    createMock.mockRejectedValue(new Error("ERR_STREAM_PREMATURE_CLOSE"));

    const result = await estimateMeal({ text: "mystery meal" });

    expect(createMock).toHaveBeenCalledTimes(4);
    // Nulls, not zeroes: nobody worked these out, which is a different thing
    // from the food containing none of them.
    expect(result).toEqual([
      { label: "mystery meal", kcal: null, proteinG: null, carbsG: null, fatG: null, ...NO_NUTRIENTS, ...ONE_OF_IT },
    ]);
  }, 15000);
});

/**
 * How much of it, as the model reports it.
 *
 * The calories have always been the total for the whole entry and still are —
 * nothing below changes a figure. What changes is that the entry now also says
 * what amount that total is FOR, which is the only way one rasher of bacon can
 * ever be worked out from the two you logged last week.
 */
describe("estimateMeal, on how much was eaten", () => {
  it("takes the count and the unit the model gave", async () => {
    createMock.mockResolvedValueOnce(
      textResponse({
        items: [{ label: "Bacon", kcal: 180, protein: 12, carbs: 0, fat: 14, count: 2, unit: "rasher", quantified: true }],
      }),
    );

    const result = await estimateMeal({ text: "2 rashers of bacon" });

    // The kcal is still the total for both rashers, unbuffered because the
    // amount was stated. The count is what makes it divisible.
    expect(result[0]).toMatchObject({ label: "Bacon", kcal: 180, quantity: 2, unitLabel: "rasher" });
  });

  it("leaves a food with no unit as one of itself", async () => {
    // The case that must not be forced: a stew divides into nothing, and a
    // unit invented for it would have everything downstream dividing by a
    // number nobody measured.
    createMock.mockResolvedValueOnce(
      textResponse({ items: [{ label: "Beef stew", kcal: 520, protein: 30, carbs: 40, fat: 20, count: 1, unit: null }] }),
    );

    expect((await estimateMeal({ text: "beef stew" }))[0]).toMatchObject({ quantity: 1, unitLabel: null });
  });

  it("drops a serving, which says nothing a bare count didn't", async () => {
    createMock.mockResolvedValueOnce(
      textResponse({ items: [{ label: "Lasagne", kcal: 700, protein: 30, carbs: 60, fat: 35, count: 2, unit: "serving" }] }),
    );

    // The 2 survives — it is a real amount — but "serving" is not a unit.
    expect((await estimateMeal({ text: "2 servings of lasagne" }))[0]).toMatchObject({ quantity: 2, unitLabel: null });
  });

  it("falls back to one of it when the model says nothing sensible", async () => {
    // Every one of these used to be the only behaviour there was, so a model
    // that omits the fields, or returns nonsense in them, costs nothing.
    for (const count of [undefined, null, 0, -3, "lots", 99999]) {
      createMock.mockResolvedValueOnce(
        textResponse({ items: [{ label: "Toast", kcal: 100, protein: 3, carbs: 18, fat: 1, count, unit: "slice" }] }),
      );
      expect((await estimateMeal({ text: "toast" }))[0]).toMatchObject({ quantity: 1, unitLabel: "slice" });
    }
  });

  it("keeps a fractional count to something a database can hold", async () => {
    createMock.mockResolvedValueOnce(
      textResponse({ items: [{ label: "Pizza", kcal: 300, protein: 12, carbs: 30, fat: 14, count: 1 / 3, unit: "slice" }] }),
    );

    expect((await estimateMeal({ text: "a third of a pizza" }))[0]).toMatchObject({ quantity: 0.33 });
  });
});
