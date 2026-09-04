import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The two things that make this safe to run over years of diary: it never
 * touches a calorie figure, and it asks about each distinct food once rather
 * than once per entry.
 */
const state = vi.hoisted(() => ({
  entries: [] as any[],
  estimates: new Map<string, any[]>(),
  estimateCalls: [] as string[],
  estimateThrows: false,
}));

vi.mock("../src/config", () => ({ config: { TIMEZONE: "Europe/London" } }));

vi.mock("../src/estimate", () => ({
  estimateMeal: vi.fn(async ({ text }: { text: string }) => {
    state.estimateCalls.push(text);
    if (state.estimateThrows) throw new Error("model unavailable");
    return state.estimates.get(text) ?? [];
  }),
}));

vi.mock("../src/errorLog", () => ({ recordError: vi.fn(async () => {}) }));

vi.mock("../src/db", () => ({
  prisma: {
    entry: {
      findMany: vi.fn(async () =>
        state.entries.filter((e) => e.kcal !== null && e.proteinG === null && e.carbsG === null && e.fatG === null),
      ),
      update: vi.fn(async ({ where, data }: any) => {
        const entry = state.entries.find((e) => e.id === where.id);
        Object.assign(entry, data);
        return entry;
      }),
    },
  },
}));

import { macroBackfillStatus, runMacroBackfill } from "../src/macroBackfill";

function entry(id: number, label: string, kcal: number | null, macros: Partial<Record<"proteinG" | "carbsG" | "fatG", number>> = {}) {
  return {
    id,
    label,
    kcal,
    proteinG: macros.proteinG ?? null,
    carbsG: macros.carbsG ?? null,
    fatG: macros.fatG ?? null,
    timestamp: new Date(),
  };
}

beforeEach(() => {
  state.entries.length = 0;
  state.estimateCalls.length = 0;
  state.estimates.clear();
  state.estimateThrows = false;
  vi.clearAllMocks();
});

afterEach(() => vi.clearAllMocks());

describe("what counts as missing", () => {
  it("counts entries with calories but no macros at all", async () => {
    state.entries.push(entry(1, "Sandwich", 600), entry(2, "Sandwich", 600), entry(3, "Apple", 95));
    expect(await macroBackfillStatus(1)).toEqual({ entries: 3, foods: 2 });
  });

  it("leaves alone an entry that genuinely has none of a macro", async () => {
    // A black coffee is 0/0/0, not unanswered — a zero is an answer.
    state.entries.push(entry(1, "Black coffee", 2, { proteinG: 0, carbsG: 0, fatG: 0 }));
    expect(await macroBackfillStatus(1)).toEqual({ entries: 0, foods: 0 });
  });

  it("leaves alone an entry with no calories, which has nothing to scale to", async () => {
    state.entries.push(entry(1, "Mystery", null));
    expect(await macroBackfillStatus(1)).toEqual({ entries: 0, foods: 0 });
  });

  it("groups the same food logged differently into one question", async () => {
    state.entries.push(entry(1, "Chicken and rice", 600), entry(2, "rice and chicken", 620));
    expect(await macroBackfillStatus(1)).toEqual({ entries: 2, foods: 1 });
  });
});

describe("filling them in", () => {
  it("asks once per food and applies the answer to every entry of it", async () => {
    state.entries.push(entry(1, "Sandwich", 600), entry(2, "Sandwich", 600), entry(3, "Sandwich", 600));
    state.estimates.set("Sandwich", [{ label: "Sandwich", kcal: 600, proteinG: 30, carbsG: 60, fatG: 20 }]);

    const result = await runMacroBackfill(1);
    expect(state.estimateCalls).toEqual(["Sandwich"]);
    expect(result.updated).toBe(3);
    expect(state.entries.map((e) => e.proteinG)).toEqual([30, 30, 30]);
  });

  it("keeps the calories that were logged and scales the macros to them", async () => {
    // Two portions of the same thing. The model is asked about one; each row
    // keeps its own calorie figure and gets macros to match.
    state.entries.push(entry(1, "Porridge", 380), entry(2, "Porridge", 760));
    state.estimates.set("Porridge", [{ label: "Porridge", kcal: 380, proteinG: 12, carbsG: 62, fatG: 8 }]);

    await runMacroBackfill(1);
    expect(state.entries[0]).toMatchObject({ kcal: 380, proteinG: 12, carbsG: 62, fatG: 8 });
    expect(state.entries[1]).toMatchObject({ kcal: 760, proteinG: 24, carbsG: 124, fatG: 16 });
  });

  it("never lets the macros claim more energy than the entry has", async () => {
    state.entries.push(entry(1, "Protein bar", 200));
    // 90g of protein is 360 kcal, which will not fit in a 200 kcal bar.
    state.estimates.set("Protein bar", [{ label: "Protein bar", kcal: 200, proteinG: 90, carbsG: 5, fatG: 3 }]);

    await runMacroBackfill(1);
    expect(state.entries[0].proteinG).toBeLessThanOrEqual(200 / 4);
  });

  it("skips a food the estimator couldn't answer for, and says which", async () => {
    state.entries.push(entry(1, "Nan's mystery pie", 400));
    state.estimates.set("Nan's mystery pie", []);

    const result = await runMacroBackfill(1);
    expect(result.updated).toBe(0);
    expect(result.failed).toEqual(["Nan's mystery pie"]);
    expect(state.entries[0].proteinG).toBeNull();
  });

  it("stops rather than looping when nothing more can be filled in", async () => {
    // A food the model can't answer for stays in the count for ever, so
    // "done" has to mean "no progress", not "the count reached zero".
    state.entries.push(entry(1, "Mystery", 400));
    state.estimates.set("Mystery", []);
    const result = await runMacroBackfill(1);
    expect(result.done).toBe(true);
    expect(result.entries).toBe(1);
  });

  it("carries on past a food that made the model throw", async () => {
    state.entries.push(entry(1, "Sandwich", 600));
    state.estimateThrows = true;
    const result = await runMacroBackfill(1);
    expect(result.failed).toEqual(["Sandwich"]);
    expect(result.done).toBe(true);
  });

  it("works through the most-logged foods first", async () => {
    // An interrupted run should have moved the needle on the diary, not on
    // whatever happened to sort first.
    state.entries.push(entry(1, "Rare thing", 300));
    for (let i = 2; i <= 6; i += 1) state.entries.push(entry(i, "Everyday thing", 300));
    state.estimates.set("Everyday thing", [{ label: "x", kcal: 300, proteinG: 10, carbsG: 30, fatG: 10 }]);
    state.estimates.set("Rare thing", [{ label: "x", kcal: 300, proteinG: 10, carbsG: 30, fatG: 10 }]);

    await runMacroBackfill(1, 1);
    expect(state.estimateCalls).toEqual(["Everyday thing"]);
  });

  it("reports what is left after the batch", async () => {
    state.entries.push(entry(1, "Toast", 100), entry(2, "Banana", 100), entry(3, "Yoghurt", 100));
    for (const label of ["Toast", "Banana", "Yoghurt"]) {
      state.estimates.set(label, [{ label, kcal: 100, proteinG: 5, carbsG: 10, fatG: 3 }]);
    }
    const result = await runMacroBackfill(1, 2);
    expect(result.updated).toBe(2);
    expect(result.entries).toBe(1);
    expect(result.done).toBe(false);
  });
});
