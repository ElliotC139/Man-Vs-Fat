import { beforeEach, describe, expect, it } from "vitest";
import { consume, consumeAll, reset, resetAll, type RateLimitRule } from "../src/rateLimit";

const RULE: RateLimitRule = { limit: 3, windowMs: 60_000 };

describe("consume", () => {
  beforeEach(() => resetAll());

  it("allows calls up to the limit and rejects the next one", () => {
    expect(consume("user:1", RULE, 0).allowed).toBe(true);
    expect(consume("user:1", RULE, 0).allowed).toBe(true);
    expect(consume("user:1", RULE, 0).allowed).toBe(true);
    expect(consume("user:1", RULE, 0).allowed).toBe(false);
  });

  it("keys are independent", () => {
    for (let i = 0; i < 3; i++) consume("user:1", RULE, 0);
    expect(consume("user:1", RULE, 0).allowed).toBe(false);
    expect(consume("user:2", RULE, 0).allowed).toBe(true);
  });

  it("frees one slot at a time as calls age out, not the whole allowance", () => {
    // Staggered, because three calls made at the same instant also expire at
    // the same instant — the sliding behaviour only shows with a spread.
    consume("user:1", RULE, 0);
    consume("user:1", RULE, 10_000);
    consume("user:1", RULE, 20_000);
    expect(consume("user:1", RULE, 59_999).allowed).toBe(false);

    // At 60s the first call is outside the window and one slot opens; the
    // second doesn't free up until 70s.
    expect(consume("user:1", RULE, 60_000).allowed).toBe(true);
    expect(consume("user:1", RULE, 60_001).allowed).toBe(false);
    expect(consume("user:1", RULE, 70_000).allowed).toBe(true);
  });

  it("a rejected call doesn't extend the cool-off", () => {
    for (let i = 0; i < 3; i++) consume("user:1", RULE, 0);
    // Retrying at 30s would push the window out to 90s if rejections were
    // recorded; the retry-after must still count from the original calls.
    consume("user:1", RULE, 30_000);
    expect(consume("user:1", RULE, 60_000).allowed).toBe(true);
  });

  it("reports how long to wait", () => {
    for (let i = 0; i < 3; i++) consume("user:1", RULE, 0);
    expect(consume("user:1", RULE, 20_000).retryAfterSec).toBe(40);
  });
});

describe("consumeAll", () => {
  beforeEach(() => resetAll());

  it("rejects as soon as any rule rejects", () => {
    const burst: RateLimitRule = { limit: 2, windowMs: 1_000 };
    const daily: RateLimitRule = { limit: 5, windowMs: 86_400_000 };

    expect(consumeAll("user:1", [burst, daily], 0).allowed).toBe(true);
    expect(consumeAll("user:1", [burst, daily], 0).allowed).toBe(true);
    expect(consumeAll("user:1", [burst, daily], 0).allowed).toBe(false);

    // The burst window has passed but the daily one hasn't: three more get
    // through (5 daily, 2 already spent), then the daily ceiling bites.
    expect(consumeAll("user:1", [burst, daily], 2_000).allowed).toBe(true);
    expect(consumeAll("user:1", [burst, daily], 2_000).allowed).toBe(true);
    expect(consumeAll("user:1", [burst, daily], 4_000).allowed).toBe(true);
    expect(consumeAll("user:1", [burst, daily], 6_000).allowed).toBe(false);
  });
});

describe("reset", () => {
  beforeEach(() => resetAll());

  it("clears every window for a key, so a correct login forgives the typos", () => {
    for (let i = 0; i < 3; i++) consume("login:alice", RULE, 0);
    expect(consume("login:alice", RULE, 0).allowed).toBe(false);
    reset("login:alice");
    expect(consume("login:alice", RULE, 0).allowed).toBe(true);
  });
});
