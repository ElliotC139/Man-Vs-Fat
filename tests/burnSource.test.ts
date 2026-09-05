import { describe, expect, it } from "vitest";
import { burnCaption, netCaption, readBurnSource, resolveBurn } from "../src/burnSource";

/**
 * Three figures have a claim on the top line of the Today card. The rules that
 * matter: the one the user picked wins where it exists, something usable is
 * always found if there is one, and whatever gets used is what the caption
 * says — a whole-day estimate is never called "burned so far".
 */
const all = { measured: 1900, target: 2000, estimate: 2600 };

describe("reading the stored choice", () => {
  it("defaults to measured, which is what the card did before this was a choice", () => {
    expect(readBurnSource(null)).toBe("measured");
    expect(readBurnSource(undefined)).toBe("measured");
    expect(readBurnSource("")).toBe("measured");
  });

  it("ignores anything it doesn't recognise", () => {
    expect(readBurnSource("adaptive")).toBe("measured");
    expect(readBurnSource("TARGET")).toBe("measured");
  });

  it("takes the three it does", () => {
    expect(readBurnSource("target")).toBe("target");
    expect(readBurnSource("estimate")).toBe("estimate");
  });
});

describe("resolving the figure", () => {
  it("uses what was chosen when it exists", () => {
    expect(resolveBurn("target", all)).toEqual({ kcal: 2000, source: "target", fellBack: false });
    expect(resolveBurn("estimate", all)).toEqual({ kcal: 2600, source: "estimate", fellBack: false });
    expect(resolveBurn("measured", all)).toEqual({ kcal: 1900, source: "measured", fellBack: false });
  });

  it("falls through rather than showing a blank where a number should be", () => {
    // Measured, with no tracker connected.
    expect(resolveBurn("measured", { ...all, measured: null })).toMatchObject({ source: "target", fellBack: true });
    // And with no target set either.
    expect(resolveBurn("measured", { measured: null, target: null, estimate: 2600 }))
      .toMatchObject({ kcal: 2600, source: "estimate", fellBack: true });
  });

  it("says so when nothing at all can be produced", () => {
    expect(resolveBurn("target", { measured: null, target: null, estimate: null }))
      .toEqual({ kcal: null, source: "none", fellBack: true });
  });

  it("treats zero as nothing to go on, not as a burn of zero", () => {
    expect(resolveBurn("measured", { measured: 0, target: 2000, estimate: null }))
      .toMatchObject({ kcal: 2000, source: "target" });
  });

  it("rounds, since a burn is not reported to the decimal", () => {
    expect(resolveBurn("estimate", { measured: null, target: null, estimate: 2612.4 }).kcal).toBe(2612);
  });
});

describe("what it gets called", () => {
  it("only says 'so far' about the one that actually grows through the day", () => {
    expect(burnCaption("measured")).toBe("burned so far");
    expect(burnCaption("target")).toBe("daily target");
    expect(burnCaption("estimate")).toBe("estimated burn");
  });

  it("names the comparison the same way", () => {
    expect(netCaption("measured")).toBe("net so far");
    expect(netCaption("target")).toBe("vs target");
    expect(netCaption("estimate")).toBe("vs estimate");
  });

  it("has something honest to say when there is no figure", () => {
    expect(burnCaption("none")).toBe("burn (nothing to go on)");
    expect(netCaption("none")).toBe("net");
  });
});
