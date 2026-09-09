import { describe, expect, it } from "vitest";
import { savedMealRows } from "../src/savedMealRows";

/**
 * The rule that decides what a saved meal becomes, shared by logging it and
 * sharing it. Two copies of this would be two chances for a shared recipe to
 * arrive as something its sender never ate.
 */
function item(over: Partial<Parameters<typeof savedMealRows>[0]["items"][number]> & { label: string }) {
  return {
    kcal: 100, proteinG: 10, carbsG: 10, fatG: 5,
    fibreG: 2, sugarG: 1, satFatG: 1, saltG: 0.2, sortOrder: 0,
    ...over,
  };
}

const template = {
  name: "Big breakfast", kind: "template", servings: 1,
  items: [
    item({ label: "Toast", sortOrder: 1, kcal: 160, proteinG: 5, carbsG: 28, fatG: 2, fibreG: 3 }),
    item({ label: "Eggs", sortOrder: 0, kcal: 220, proteinG: 18, carbsG: 2, fatG: 16, fibreG: 0 }),
  ],
};

const recipe = {
  name: "Chilli", kind: "recipe", servings: 4,
  items: [
    item({ label: "Mince", kcal: 1200, proteinG: 80, carbsG: 0, fatG: 96, fibreG: 0 }),
    item({ label: "Beans", kcal: 400, proteinG: 24, carbsG: 60, fatG: 4, fibreG: 20 }),
  ],
};

describe("savedMealRows", () => {
  it("gives a template back as its own items, in the order they were saved", () => {
    const rows = savedMealRows(template, 1);
    expect(rows.map((r) => r.label)).toEqual(["Eggs", "Toast"]);
    expect(rows[0]).toMatchObject({ kcal: 220, proteinG: 18, fibreG: 0 });
  });

  it("multiplies a template and says so in the label", () => {
    const rows = savedMealRows(template, 2);
    expect(rows[0]).toMatchObject({ label: "Eggs (x2)", kcal: 440, proteinG: 36 });
  });

  it("collapses a recipe to one portion", () => {
    // What goes in the diary is the plate, not the ingredient list again.
    const rows = savedMealRows(recipe, 1);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ label: "Chilli (1 portion)", kcal: 400, proteinG: 26, fibreG: 5 });
  });

  it("scales a recipe by portions eaten", () => {
    expect(savedMealRows(recipe, 2)[0]).toMatchObject({ label: "Chilli (2 portions)", kcal: 800 });
  });

  it("trims float noise off a fractional portion", () => {
    expect(savedMealRows(recipe, 1.5)[0]?.label).toBe("Chilli (1.5 portions)");
  });

  it("refuses to total a batch with an un-costed ingredient", () => {
    // Reporting a figure here would silently omit that ingredient, every time.
    const partial = { ...recipe, items: [...recipe.items, item({ label: "Mystery spice", kcal: null })] };
    expect(savedMealRows(partial, 1)[0]).toMatchObject({ kcal: null });
  });

  it("abstains on macros independently of calories", () => {
    // A batch can have a complete calorie total while one ingredient's macros
    // were never worked out.
    const partial = {
      ...recipe,
      items: [...recipe.items, item({ label: "Spice", kcal: 10, proteinG: null, carbsG: null, fatG: null })],
    };
    const row = savedMealRows(partial, 1)[0];
    expect(row?.kcal).toBe(403); // 1610 over four portions
    expect(row?.proteinG).toBeNull();
  });
});
