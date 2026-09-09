import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The promise this file exists to check: no plan can cost more to serve than
 * it brings in. Two limits do that job — a daily count, and a monthly ceiling
 * on measured spend — and the ceiling is the one that has to hold when the
 * count is wrong.
 */

const state = vi.hoisted(() => ({
  users: [] as any[],
  usage: [] as any[],
}));

vi.mock("../src/config", () => ({
  config: {
    TIMEZONE: "Europe/London",
    GBP_PER_USD: 0.8,
    ANTHROPIC_MODEL: "claude-sonnet-5",
    ANTHROPIC_MODEL_FREE: "claude-haiku-4-5",
  },
}));

vi.mock("../src/db", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(async ({ where }: any) => state.users.find((u) => u.id === where.id) ?? null),
    },
    aiUsage: {
      count: vi.fn(async ({ where }: any) =>
        state.usage.filter((u) => u.userId === where.userId && u.at >= where.at.gte).length),
      aggregate: vi.fn(async ({ where }: any) => ({
        _sum: {
          costMicros: state.usage
            .filter((u) => u.userId === where.userId && u.at >= where.at.gte)
            .reduce((sum, u) => sum + u.costMicros, 0) || null,
        },
      })),
      create: vi.fn(async ({ data }: any) => {
        const row = { ...data, at: data.at ?? new Date() };
        state.usage.push(row);
        return row;
      }),
    },
  },
}));

import { checkEntitlement, readAllowance, recordAiUsage } from "../src/entitlements";
import { planFor } from "../src/plans";

const NOW = new Date("2026-09-15T12:00:00Z");

function account(plan: string) {
  state.users.push({ id: 1, plan });
  return 1;
}

/** N calls today, each costing the given micros. */
function seedUsage(userId: number, count: number, costMicros: number, at = NOW) {
  for (let i = 0; i < count; i += 1) state.usage.push({ userId, at, costMicros });
}

beforeEach(() => {
  state.users.length = 0;
  state.usage.length = 0;
  vi.clearAllMocks();
});
afterEach(() => vi.clearAllMocks());

describe("the daily allowance", () => {
  it("lets a fresh account through, on its plan's model", async () => {
    const id = account("plus");
    const verdict = await checkEntitlement(id, "estimate", NOW);
    expect(verdict.allowed).toBe(true);
    if (verdict.allowed) expect(verdict.model).toBe("claude-sonnet-5");
  });

  it("runs the free tier on the cheaper model", async () => {
    const id = account("free");
    const verdict = await checkEntitlement(id, "estimate", NOW);
    if (verdict.allowed) expect(verdict.model).toBe("claude-haiku-4-5");
    else throw new Error("should have been allowed");
  });

  it("refuses once the day's estimates are gone", async () => {
    const id = account("free");
    seedUsage(id, 3, 1000);
    const verdict = await checkEntitlement(id, "estimate", NOW);
    expect(verdict.allowed).toBe(false);
    if (!verdict.allowed) {
      expect(verdict.reason).toBe("daily");
      // It has to say what still works, or being refused reads as a fault.
      expect(verdict.message).toMatch(/search, barcodes/i);
    }
  });

  it("counts yesterday's calls against yesterday", async () => {
    const id = account("free");
    seedUsage(id, 3, 1000, new Date("2026-09-14T12:00:00Z"));
    expect((await checkEntitlement(id, "estimate", NOW)).allowed).toBe(true);
  });
});

describe("the monthly ceiling", () => {
  it("refuses once this month's spend reaches the cap, whatever the count says", async () => {
    // This is the case the count cannot catch: two calls, both enormous.
    // Free's cap is 200,000 micros (20p).
    const id = account("free");
    seedUsage(id, 2, 150_000);
    const verdict = await checkEntitlement(id, "estimate", NOW);
    expect(verdict.allowed).toBe(false);
    if (!verdict.allowed) expect(verdict.reason).toBe("monthly");
  });

  it("holds on every plan", async () => {
    for (const plan of ["free", "plus", "pro"] as const) {
      state.users.length = 0;
      state.usage.length = 0;
      const id = account(plan);
      const cap = planFor(plan).monthlyCostCapMicros;
      state.usage.push({ userId: id, at: NOW, costMicros: cap });
      const verdict = await checkEntitlement(id, "estimate", NOW);
      expect(verdict.allowed, `${plan} should refuse at its cap`).toBe(false);
    }
  });

  it("starts again next month", async () => {
    const id = account("free");
    state.usage.push({ userId: id, at: new Date("2026-08-20T12:00:00Z"), costMicros: 500_000 });
    expect((await checkEntitlement(id, "estimate", NOW)).allowed).toBe(true);
  });
});

describe("what a plan includes", () => {
  it("refuses a photo on free, and says what still works", async () => {
    const id = account("free");
    const verdict = await checkEntitlement(id, "photo", NOW);
    expect(verdict.allowed).toBe(false);
    if (!verdict.allowed) {
      expect(verdict.reason).toBe("plan");
      expect(verdict.message).toMatch(/scan a barcode|search|type it/i);
    }
  });

  it("allows a photo on Plus", async () => {
    const id = account("plus");
    expect((await checkEntitlement(id, "photo", NOW)).allowed).toBe(true);
  });

  it("reads an unrecognised plan as free rather than as unlimited", async () => {
    // A bad value should ration someone, never hand them the run of the API.
    const id = account("enterprise-gold");
    const allowance = await readAllowance(id, NOW);
    expect(allowance.plan.id).toBe("free");
    expect((await checkEntitlement(id, "photo", NOW)).allowed).toBe(false);
  });
});

describe("recording what a call cost", () => {
  it("files the tokens and the money", async () => {
    const id = account("plus");
    await recordAiUsage(id, "estimate", {
      model: "claude-sonnet-5", inputTokens: 1450, outputTokens: 150,
    });
    expect(state.usage[0]).toMatchObject({ userId: id, kind: "estimate", costMicros: 3520 });
  });

  it("swallows a failure rather than losing the entry behind it", async () => {
    const { prisma } = await import("../src/db");
    (prisma.aiUsage.create as any).mockRejectedValueOnce(new Error("db down"));
    const id = account("plus");
    // The call was already made and paid for; the person's food must still
    // reach their diary.
    await expect(recordAiUsage(id, "estimate", {
      model: "claude-sonnet-5", inputTokens: 10, outputTokens: 10,
    })).resolves.toBeUndefined();
  });
});
