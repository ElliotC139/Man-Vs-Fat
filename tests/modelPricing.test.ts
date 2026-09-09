import { describe, expect, it, vi } from "vitest";

vi.mock("../src/config", () => ({ config: { GBP_PER_USD: 0.8 } }));

import { costMicros, formatMicros, isPricedModel, rateFor } from "../src/modelPricing";

/**
 * These numbers decide whether a spend ceiling holds, so the arithmetic is
 * checked rather than assumed.
 */
describe("costMicros", () => {
  it("prices a typical typed estimate", () => {
    // 1,450 in and 150 out on Sonnet 5 ($2/$10 per MTok) is $0.0044, which at
    // 0.8 GBP/USD is 3,520 micros — about a third of a penny.
    const micros = costMicros({ model: "claude-sonnet-5", inputTokens: 1450, outputTokens: 150 });
    expect(micros).toBe(3520);
    expect(formatMicros(micros)).toBe("0.4p");
  });

  it("prices a photo estimate at roughly 1.7x a typed one", () => {
    const typed = costMicros({ model: "claude-sonnet-5", inputTokens: 1450, outputTokens: 150 });
    const photo = costMicros({ model: "claude-sonnet-5", inputTokens: 2800, outputTokens: 200 });
    expect(photo / typed).toBeGreaterThan(1.5);
    expect(photo / typed).toBeLessThan(2);
  });

  it("charges a tenth for a cache read and a quarter more for a write", () => {
    const fresh = costMicros({ model: "claude-sonnet-5", inputTokens: 1000, outputTokens: 0 });
    const read = costMicros({ model: "claude-sonnet-5", inputTokens: 0, outputTokens: 0, cacheReadTokens: 1000 });
    const write = costMicros({ model: "claude-sonnet-5", inputTokens: 0, outputTokens: 0, cacheWriteTokens: 1000 });
    expect(read).toBe(Math.ceil(fresh * 0.1));
    expect(write).toBe(Math.ceil(fresh * 1.25));
  });

  it("rounds up, so a ceiling never under-counts", () => {
    // One token of input is a fraction of a micro; it must not cost nothing.
    expect(costMicros({ model: "claude-haiku-4-5", inputTokens: 1, outputTokens: 0 })).toBe(1);
  });

  it("prices an unknown model at the dearest rate, not at zero", () => {
    // Costing a model this file has never heard of at nothing is exactly how
    // a spend ceiling silently stops working.
    expect(isPricedModel("claude-something-new")).toBe(false);
    const unknown = rateFor("claude-something-new");
    const dearest = rateFor("claude-opus-5");
    expect(unknown).toEqual(dearest);
    expect(costMicros({ model: "claude-something-new", inputTokens: 1000, outputTokens: 1000 }))
      .toBe(costMicros({ model: "claude-opus-5", inputTokens: 1000, outputTokens: 1000 }));
  });
});
