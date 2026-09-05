import { beforeEach, describe, expect, it, vi } from "vitest";

import type { FoodSearchResult } from "../src/foodSearch";

const searchMock = vi.hoisted(() => vi.fn());

vi.mock("../src/foodSearchProviders", () => ({
  searchAllProviders: searchMock,
}));

import { findReferences, groundingQuery } from "../src/estimateGrounding";

function product(overrides: Partial<FoodSearchResult> = {}): FoodSearchResult {
  return {
    id: "off:1",
    source: "off",
    kind: "branded",
    name: "Milkybar Giant Buttons",
    brand: "Nestlé",
    barcode: "1",
    per100g: { kcal: 553, protein: 7.7, carbs: 57.6, fat: 32.2 },
    servingGrams: 30,
    portion: null,
    labelKey: null,
    timesLogged: 0,
    ...overrides,
  };
}

beforeEach(() => {
  searchMock.mockReset();
});

describe("groundingQuery", () => {
  it("strips the amount so the search sees a product name", () => {
    // The databases index products, not portions — "(10 pieces)" only pushes
    // the actual product down the rankings.
    expect(groundingQuery("Milkybar White Chocolate Giant Buttons (10 pieces)")).toBe(
      "Milkybar White Chocolate Giant Buttons",
    );
    expect(groundingQuery("200g chicken breast")).toBe("chicken breast");
    expect(groundingQuery("2 x 25g hula hoops")).toBe("hula hoops");
    expect(groundingQuery("3 slices of toast")).toBe("slices of toast");
  });
});

describe("findReferences", () => {
  it("returns the matching product's published figures", async () => {
    searchMock.mockResolvedValueOnce([product()]);

    const references = await findReferences("Milkybar Giant Buttons (10 pieces)");

    expect(searchMock).toHaveBeenCalledWith("Milkybar Giant Buttons");
    expect(references).toEqual([
      {
        name: "Milkybar Giant Buttons",
        brand: "Nestlé",
        per100g: { kcal: 553, protein: 7.7, carbs: 57.6, fat: 32.2 },
        portion: null,
        servingGrams: 30,
      },
    ]);
  });

  it("drops rows that carry no figures to compute from", async () => {
    searchMock.mockResolvedValueOnce([
      product({ id: "off:2", name: "Mystery Bar", per100g: null, portion: null }),
      product(),
    ]);

    const references = await findReferences("dairy milk buttons");

    expect(references).toHaveLength(1);
    expect(references[0]!.name).toBe("Milkybar Giant Buttons");
  });

  it("returns nothing rather than failing when the search does", async () => {
    // Grounding is a bonus. A provider outage has to leave the estimate
    // working exactly as it did before grounding existed.
    searchMock.mockRejectedValueOnce(new Error("provider down"));

    await expect(findReferences("galaxy counters")).resolves.toEqual([]);
  });

  it("does not cache a failed search over the search box's results", async () => {
    // An empty list from a timeout must not sit in the shared cache pretending
    // the product doesn't exist for the next six hours.
    searchMock.mockRejectedValueOnce(new Error("provider down"));
    await findReferences("maltesers buttons");

    searchMock.mockResolvedValueOnce([product({ name: "Maltesers Buttons" })]);
    const references = await findReferences("maltesers buttons");

    expect(references).toHaveLength(1);
    expect(searchMock).toHaveBeenCalledTimes(2);
  });

  it("does not spend a round trip when the text names no food at all", async () => {
    // "200g" on its own leaves nothing to search for once the amount is out.
    expect(await findReferences("200g")).toEqual([]);
    expect(searchMock).not.toHaveBeenCalled();
  });
});
