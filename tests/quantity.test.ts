import { describe, expect, it } from "vitest";

import { statesExplicitQuantity } from "../src/quantity";

describe("statesExplicitQuantity", () => {
  it("recognises a stated count of countable units", () => {
    // The entry that started this: ten small units is an amount, not a bag.
    expect(statesExplicitQuantity("Milkybar White Chocolate Giant Buttons (10 pieces)")).toBe(true);
    expect(statesExplicitQuantity("3 slices of toast")).toBe(true);
    expect(statesExplicitQuantity("two eggs")).toBe(true);
    expect(statesExplicitQuantity("6 chicken nuggets")).toBe(true);
    // No list of nouns could cover every food, so a plain count of something
    // plural counts too.
    expect(statesExplicitQuantity("3 jaffa cakes")).toBe(true);
    expect(statesExplicitQuantity("2 sausage rolls")).toBe(true);
  });

  it("recognises a stated weight or volume", () => {
    expect(statesExplicitQuantity("200g chicken breast")).toBe(true);
    expect(statesExplicitQuantity("1.5kg turkey")).toBe(true);
    expect(statesExplicitQuantity("330ml coke")).toBe(true);
    expect(statesExplicitQuantity("a pizza and 2 pints")).toBe(true);
    expect(statesExplicitQuantity("2 x 25g bags")).toBe(true);
  });

  it("does not count words that only sound like an amount", () => {
    // These are how people describe an amount they have NOT measured, which is
    // exactly the case the under-reporting buffer exists for.
    expect(statesExplicitQuantity("a handful of crisps")).toBe(false);
    expect(statesExplicitQuantity("a portion of chips")).toBe(false);
    expect(statesExplicitQuantity("a serving of lasagne")).toBe(false);
    expect(statesExplicitQuantity("just a sandwich")).toBe(false);
    expect(statesExplicitQuantity("chicken stir fry with rice")).toBe(false);
  });

  it("does not trip on a number or a stray letter inside an ordinary description", () => {
    expect(statesExplicitQuantity("1 garlic clove crushed into the sauce")).toBe(false);
    expect(statesExplicitQuantity("lovely roast dinner")).toBe(false);
    expect(statesExplicitQuantity("")).toBe(false);
    expect(statesExplicitQuantity(undefined)).toBe(false);
  });
});
