import { describe, expect, it } from "vitest";
import { DEFAULT_LOG_METHODS, readLogMethods, writeLogMethods } from "../src/logMethods";

describe("which ways into the diary the form offers", () => {
  it("offers the four it always has, with number off", () => {
    // Number skips the estimate entirely, which is occasionally the right tool
    // and never a sensible default.
    expect(readLogMethods(null)).toEqual(["photo", "scan", "search", "speak"]);
    expect(DEFAULT_LOG_METHODS).not.toContain("number");
  });

  it("reads a saved choice", () => {
    expect(readLogMethods({ logMethods: '["scan","number"]' })).toEqual(["scan", "number"]);
  });

  it("keeps the form's own order, not the order they were ticked", () => {
    expect(readLogMethods({ logMethods: '["number","photo","scan"]' })).toEqual([
      "photo",
      "scan",
      "number",
    ]);
  });

  it("honours an empty choice rather than overriding it", () => {
    // Unlike the diary's figures, none is a real answer: somebody who only
    // ever types can legitimately want every button gone, and the typed box
    // stays either way.
    expect(readLogMethods({ logMethods: "[]" })).toEqual([]);
  });

  it("falls back to the default when the column can't be read", () => {
    // The worst a bad row should cost is a preference not being honoured,
    // never a log form with no way to log on it.
    expect(readLogMethods({ logMethods: "not json" })).toEqual(DEFAULT_LOG_METHODS);
    expect(readLogMethods({ logMethods: '{"scan":true}' })).toEqual(DEFAULT_LOG_METHODS);
    expect(readLogMethods({ logMethods: "" })).toEqual(DEFAULT_LOG_METHODS);
  });

  it("drops a method it doesn't recognise instead of rejecting the rest", () => {
    expect(readLogMethods({ logMethods: '["scan","telepathy"]' })).toEqual(["scan"]);
  });

  it("round-trips a choice through the column", () => {
    const stored = writeLogMethods(["number", "search"]);
    expect(readLogMethods({ logMethods: stored })).toEqual(["search", "number"]);
  });

  it("stores an empty choice as empty, not as the default", () => {
    expect(readLogMethods({ logMethods: writeLogMethods([]) })).toEqual([]);
  });
});
