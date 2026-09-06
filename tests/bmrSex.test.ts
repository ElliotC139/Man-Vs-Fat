import { describe, expect, it } from "vitest";
import { sexConstant } from "../src/sexConstant";

/**
 * Mifflin-St Jeor's final term is the only part of the resting-burn formula
 * that depends on sex, and it was hardcoded to the male value. These pin the
 * three cases so the 166 kcal/day error cannot come back unnoticed.
 */
describe("the Mifflin-St Jeor sex constant", () => {
  it("uses +5 for men and -161 for women", () => {
    expect(sexConstant("male")).toBe(5);
    expect(sexConstant("female")).toBe(-161);
  });

  it("is 166 kcal/day apart, which is the whole reason this exists", () => {
    expect(sexConstant("male") - sexConstant("female")).toBe(166);
  });

  it("splits the difference when it hasn't been answered", () => {
    // Wrong by 83 for everyone beats wrong by 166 for half of them, and
    // nobody should have to answer this to use a food diary.
    expect(sexConstant(null)).toBe(-78);
    expect(sexConstant(undefined)).toBe(-78);
    expect(sexConstant("")).toBe(-78);
  });

  it("falls back rather than trusting an unexpected value", () => {
    expect(sexConstant("other")).toBe(-78);
    expect(sexConstant("MALE")).toBe(-78);
  });

  it("is equidistant from both, so neither sex is the default", () => {
    expect(sexConstant("male") - sexConstant(null)).toBe(sexConstant(null) - sexConstant("female"));
  });
});

describe("what it means for a real person", () => {
  // Mifflin-St Jeor: 10*kg + 6.25*cm - 5*yrs + constant, times an activity
  // multiplier. 70kg, 165cm, 35yo, lightly active (1.375).
  const bmrFor = (sex: string | null) => 10 * 70 + 6.25 * 165 - 5 * 35 + sexConstant(sex);

  it("no longer hands a woman a man's burn", () => {
    const asWoman = bmrFor("female") * 1.375;
    const asMan = bmrFor("male") * 1.375;
    expect(Math.round(asMan - asWoman)).toBe(228);
    // Before the fix she was given the man's figure — over a week that is a
    // day and a half of eating she thought she had spare.
    expect(Math.round((asMan - asWoman) * 7)).toBe(1598);
  });

  it("keeps men on exactly the figure they had before", () => {
    expect(bmrFor("male")).toBe(10 * 70 + 6.25 * 165 - 5 * 35 + 5);
  });
});
