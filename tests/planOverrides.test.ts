import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Changing what a tier includes, without shipping a deployment.
 *
 * Two properties matter more than any individual setting here:
 *
 *   - **The ladder holds.** Everything Free gets, Plus gets; everything Plus
 *     gets, Pro gets. A grid of independent tick-boxes can express the
 *     opposite, and the opposite means somebody upgraded and lost a feature.
 *   - **Only differences are stored.** A value equal to the code's own is
 *     stored as null, so a plan nobody has meaningfully changed keeps tracking
 *     the deployment instead of being pinned to whatever it said that day.
 */

const state = vi.hoisted(() => ({ rows: new Map<string, any>() }));

/**
 * src/plans.ts reads the configured models at module scope, and src/config.ts
 * THROWS on an unconfigured environment rather than returning defaults. So
 * importing anything that reaches plans.ts fails outright on a machine with no
 * .env — which is every CI runner, and is exactly how this file first went red
 * after passing locally. Every other route-level test here mocks config for
 * the same reason.
 */
vi.mock("../src/config", () => ({
  adminUsernames: [],
  config: {
    TIMEZONE: "Europe/London",
    ANTHROPIC_MODEL: "claude-sonnet-5",
    ANTHROPIC_MODEL_FREE: "claude-haiku-4-5",
  },
}));

vi.mock("../src/db", () => ({
  prisma: {
    planOverride: {
      findMany: vi.fn(async () => [...state.rows.values()]),
      findUnique: vi.fn(async ({ where }: any) => state.rows.get(where.id) ?? null),
      upsert: vi.fn(async ({ where, create, update }: any) => {
        const row = state.rows.has(where.id)
          ? { ...state.rows.get(where.id), ...update }
          : { ...create };
        state.rows.set(where.id, row);
        return row;
      }),
      deleteMany: vi.fn(async ({ where }: any) => {
        const had = state.rows.delete(where.id);
        return { count: had ? 1 : 0 };
      }),
    },
  },
}));

import {
  applyPlanOverride,
  cascadeAllowance,
  cascadeFlag,
  forgetPlanOverrides,
  installPlanOverrides,
  refreshPlanOverrides,
  savePlanOverride,
} from "../src/planOverrides";
import { basePlanFor, clearPlanLens, planFor, PLAN_IDS, type PlanId } from "../src/plans";

beforeEach(async () => {
  state.rows.clear();
  forgetPlanOverrides();
  clearPlanLens();
});

afterEach(() => {
  clearPlanLens();
});

/** Whether the tiers still climb: nothing is lost by paying more. */
function ladderHolds(read: (plan: PlanId) => boolean | number): boolean {
  const values = PLAN_IDS.map(read);
  return values.every((value, index) => index === 0 || value >= values[index - 1]!);
}

describe("the ladder, when a feature is switched on", () => {
  const off = { free: false, plus: false, pro: false };

  it("ticks every tier above the one tapped", () => {
    // The rule as it was given: ticking in free also ticks plus and pro.
    expect(cascadeFlag(off, "free", true)).toEqual({ free: true, plus: true, pro: true });
    expect(cascadeFlag(off, "plus", true)).toEqual({ free: false, plus: true, pro: true });
    expect(cascadeFlag(off, "pro", true)).toEqual({ free: false, plus: false, pro: true });
  });

  it("unticks every tier below, which is the same rule from the other end", () => {
    // Not symmetry for its own sake. Unticking Plus while leaving Free ticked
    // would mean paying £4.99 to lose something the free tier has.
    const on = { free: true, plus: true, pro: true };
    expect(cascadeFlag(on, "pro", false)).toEqual({ free: false, plus: false, pro: false });
    expect(cascadeFlag(on, "plus", false)).toEqual({ free: false, plus: false, pro: true });
    expect(cascadeFlag(on, "free", false)).toEqual({ free: false, plus: true, pro: true });
  });

  it("leaves the tiers climbing however they are tapped", () => {
    let column = { free: false, plus: false, pro: false };
    // A deliberately contrary sequence: on at the top, off at the bottom, on
    // in the middle, off at the top — the kind of thing a real editing session
    // produces and a naive per-cell toggle gets wrong.
    for (const [plan, enabled] of [
      ["pro", true], ["free", true], ["plus", false], ["pro", false], ["free", true],
    ] as [PlanId, boolean][]) {
      column = cascadeFlag(column, plan, enabled);
      expect(ladderHolds((id) => column[id])).toBe(true);
    }
  });
});

describe("the ladder, when an allowance changes", () => {
  const current = { free: 4, plus: 10, pro: 40 };

  it("raises the tiers above to at least the new figure", () => {
    // Free going to 20 cannot leave Plus on 10, which would be a downgrade
    // for £4.99.
    expect(cascadeAllowance(current, "free", 20)).toEqual({ free: 20, plus: 20, pro: 40 });
  });

  it("lowers the tiers below to at most the new figure", () => {
    expect(cascadeAllowance(current, "plus", 3)).toEqual({ free: 3, plus: 3, pro: 40 });
  });

  it("leaves tiers already in the right order where they are", () => {
    // Plus to 12 touches nothing else: 4 is still under it and 40 still over.
    expect(cascadeAllowance(current, "plus", 12)).toEqual({ free: 4, plus: 12, pro: 40 });
  });

  it("keeps the tiers climbing however they are edited", () => {
    let column = { ...current };
    for (const [plan, value] of [
      ["pro", 5], ["free", 9], ["plus", 2], ["pro", 100],
    ] as [PlanId, number][]) {
      column = cascadeAllowance(column, plan, value);
      expect(ladderHolds((id) => column[id])).toBe(true);
    }
  });
});

describe("laying an override over a plan", () => {
  it("changes nothing until something has been saved", async () => {
    await refreshPlanOverrides();
    for (const id of PLAN_IDS) {
      expect(applyPlanOverride(basePlanFor(id))).toEqual(basePlanFor(id));
    }
  });

  it("changes only the fields that were set", async () => {
    await savePlanOverride("free", basePlanFor("free"), { keto: true });

    const free = applyPlanOverride(basePlanFor("free"));
    expect(free.keto).toBe(true);
    // Everything else still comes from the code, including the two things this
    // layer deliberately cannot touch.
    expect(free.pricePence).toBe(basePlanFor("free").pricePence);
    expect(free.monthlyCostCapMicros).toBe(basePlanFor("free").monthlyCostCapMicros);
    expect(free.photo).toBe(basePlanFor("free").photo);
  });

  it("reaches planFor once installed, and not before", async () => {
    await savePlanOverride("free", basePlanFor("free"), { keto: true });

    // The lens is not installed, so the app still sees the reviewed plans.
    expect(planFor("free").keto).toBe(basePlanFor("free").keto);

    await installPlanOverrides();
    expect(planFor("free").keto).toBe(true);
  });
});

describe("storing only what differs from the code", () => {
  it("keeps no row for a plan set back to its own default", async () => {
    const base = basePlanFor("pro");
    await savePlanOverride("pro", base, { keto: !base.keto });
    expect(state.rows.has("pro")).toBe(true);

    await savePlanOverride("pro", base, { keto: base.keto });
    // Not a row full of nulls — no row. "Has this plan been edited" stays a
    // question the table itself can answer.
    expect(state.rows.has("pro")).toBe(false);
  });

  it("stores null for a field that matches, so the plan tracks the deployment", async () => {
    const base = basePlanFor("plus");
    await savePlanOverride("plus", base, { keto: !base.keto, fasting: base.fasting });
    expect(state.rows.get("plus")).toMatchObject({ keto: !base.keto, fasting: null });
  });

  it("leaves earlier edits alone when a later one touches a different field", async () => {
    const base = basePlanFor("free");
    await savePlanOverride("free", base, { keto: true });
    await savePlanOverride("free", base, { fasting: true });

    const free = applyPlanOverride(base);
    expect(free.keto).toBe(true);
    expect(free.fasting).toBe(true);
  });

  it("clears a plan back to the code when every field is nulled", async () => {
    const base = basePlanFor("free");
    await savePlanOverride("free", base, { keto: true, fasting: true });
    await savePlanOverride("free", base, { keto: null, fasting: null });

    expect(state.rows.has("free")).toBe(false);
    expect(applyPlanOverride(base)).toEqual(base);
  });
});

describe("failing safe", () => {
  it("ignores a row for a plan that no longer exists", async () => {
    state.rows.set("legacy", { id: "legacy", keto: true });
    await refreshPlanOverrides();
    // Ignored, not deleted: a rename should not throw away somebody's
    // settings, and a row nobody reads costs nothing.
    expect(state.rows.has("legacy")).toBe(true);
    expect(applyPlanOverride(basePlanFor("free"))).toEqual(basePlanFor("free"));
  });

  it("ignores an allowance outside what the screen can produce", async () => {
    const base = basePlanFor("free");
    state.rows.set("free", { id: "free", dailyEstimates: 99_999 });
    await refreshPlanOverrides();
    expect(applyPlanOverride(base).dailyEstimates).toBe(base.dailyEstimates);

    state.rows.set("free", { id: "free", dailyEstimates: -1 });
    await refreshPlanOverrides();
    expect(applyPlanOverride(base).dailyEstimates).toBe(base.dailyEstimates);
  });

  it("keeps serving the plans as written when the table cannot be read", async () => {
    const { prisma } = (await import("../src/db")) as any;
    prisma.planOverride.findMany.mockRejectedValueOnce(new Error("no such table"));

    // Does not throw, and does not take the app down with it.
    await expect(refreshPlanOverrides()).resolves.toBeUndefined();
    expect(applyPlanOverride(basePlanFor("pro"))).toEqual(basePlanFor("pro"));
  });
});
