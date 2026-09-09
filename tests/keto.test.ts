import { describe, expect, it } from "vitest";
import { DEFAULT_KETO_NET_CARB_LIMIT_G, ketoDay, ketoDiaryFields, ketoSettings } from "../src/keto";

describe("ketoDay", () => {
  it("counts net carbs against the ceiling", () => {
    expect(ketoDay({ carbsG: 24, fibreG: 9, limitG: 20, unknownEntries: 0 })).toEqual({
      limitG: 20, eatenG: 15, remainingG: 5, over: false, unknownEntries: 0,
    });
  });

  it("says when the ceiling has been passed", () => {
    const day = ketoDay({ carbsG: 40, fibreG: 6, limitG: 20, unknownEntries: 0 });
    expect(day).toMatchObject({ eatenG: 34, over: true, remainingG: 0 });
  });

  it("leaves the figures null with nothing logged that has carbs", () => {
    expect(ketoDay({ carbsG: null, fibreG: null, limitG: 20, unknownEntries: 3 })).toEqual({
      limitG: 20, eatenG: null, remainingG: null, over: false, unknownEntries: 3,
    });
  });

  it("keeps the full carbs where nothing has a fibre figure", () => {
    // Assuming zero fibre would make a bowl of lentils look like pure net
    // carbs — wrong in the direction that discourages eating them.
    expect(ketoDay({ carbsG: 30, fibreG: null, limitG: 20, unknownEntries: 0 }).eatenG).toBe(30);
  });

  it("treats a zero or missing ceiling as no ceiling", () => {
    expect(ketoDay({ carbsG: 10, fibreG: 2, limitG: 0, unknownEntries: 0 })).toMatchObject({
      limitG: null, remainingG: null, over: false,
    });
  });
});

describe("ketoSettings", () => {
  it("sets the four things keto needs", () => {
    expect(ketoSettings({ carbsTargetG: null })).toEqual({
      carbMode: "net", carbsOp: "max", macroMode: "grams",
      carbsTargetG: DEFAULT_KETO_NET_CARB_LIMIT_G,
    });
  });

  it("keeps a ceiling they have already chosen", () => {
    expect(ketoSettings({ carbsTargetG: 35 }).carbsTargetG).toBe(35);
  });
});

describe("ketoDiaryFields", () => {
  it("adds the count and what it is made of, keeping what was chosen", () => {
    expect(ketoDiaryFields(["protein", "fat"])).toEqual(["protein", "fat", "netCarbs", "fibre"]);
  });

  it("adds nothing twice", () => {
    expect(ketoDiaryFields(["netCarbs", "fibre"])).toEqual(["netCarbs", "fibre"]);
  });
});
