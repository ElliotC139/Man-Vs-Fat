/**
 * Changing what a plan includes without shipping a deployment.
 *
 * The plans live in src/plans.ts and stay there. This is a layer of exceptions
 * over them, edited from the admin screen: which features each tier includes,
 * and how many AI estimates a day it gets. Everything else about a plan — its
 * price, and the monthly ceiling on what its AI calls may cost — is deliberately
 * not editable from here. See the note on the PlanOverride model for why, and
 * the short version is that a guarantee you can switch off from a web form was
 * never a guarantee.
 *
 * ── Why this is a cache rather than a query ───────────────────────────────
 *
 * `planFor()` is synchronous and called from about a dozen places, several of
 * them inside request handlers that are already doing their own database work.
 * Making it async to read a table would have meant touching every one of them
 * and turning a pure function into an I/O call in the middle of hot paths.
 *
 * So the overrides are read once at boot and held in memory, and a write
 * refreshes them in place. That is correct here because the app runs on one
 * machine — a Fly volume attaches to exactly one — so there is no second
 * process holding a stale copy. If that ever changes, this needs a TTL or a
 * notification, and the comment on `refreshPlanOverrides` says so.
 *
 * ── Failing safe ──────────────────────────────────────────────────────────
 *
 * Nothing in here throws. A table that can't be read, a row for a plan that no
 * longer exists, a column holding something unexpected — each one falls back
 * to what src/plans.ts says, which is the version that was reviewed. An
 * override layer that could break the app by being unreadable would be a worse
 * deal than not having it.
 */

import { prisma } from "./db";
import { PLAN_IDS, setPlanLens, type Plan, type PlanId } from "./plans";

/**
 * The parts of a plan the admin screen may change.
 *
 * Named as a type rather than left implicit because it is the actual boundary:
 * anything absent from this list cannot be edited at runtime, whatever the
 * request body says, and adding a key here is a deliberate decision to hand
 * that lever over.
 */
export const EDITABLE_FLAGS = [
  "ads",
  "photo",
  "recipeScan",
  "health",
  "weeklyReport",
  "weeklyReview",
  "eatingWindow",
  "fasting",
  "keto",
  "measurements",
  "progressPhotos",
] as const;

export type EditableFlag = (typeof EDITABLE_FLAGS)[number];

export function isEditableFlag(value: unknown): value is EditableFlag {
  return typeof value === "string" && (EDITABLE_FLAGS as readonly string[]).includes(value);
}

/**
 * The most estimates a day any plan may be given from this screen.
 *
 * Not a cost control — the monthly ceiling is the cost control, and it is not
 * editable — but a typo guard. Someone meaning to type 40 and typing 4000
 * should get a refusal rather than a plan whose headline promises something
 * the ceiling will cut off on the second of the month.
 */
export const MAX_DAILY_ESTIMATES = 500;

export interface PlanOverridePatch {
  dailyEstimates?: number | null;
  ads?: boolean | null;
  photo?: boolean | null;
  recipeScan?: boolean | null;
  health?: boolean | null;
  weeklyReport?: boolean | null;
  weeklyReview?: boolean | null;
  eatingWindow?: boolean | null;
  fasting?: boolean | null;
  keto?: boolean | null;
  measurements?: boolean | null;
  progressPhotos?: boolean | null;
}

/** What is currently overridden, by plan. Empty until the first load. */
let overrides = new Map<PlanId, PlanOverridePatch>();

/**
 * Reads every override out of the database into memory.
 *
 * Called once at boot and again after every write. Never rejects: a failure
 * here leaves the previous state in place (at boot, that is no overrides at
 * all, which is the code's own plans), and logs rather than taking the app
 * down with it.
 *
 * If this app ever runs more than one process, a second one would hold its own
 * copy of this map and not hear about a write made through the first. That is
 * the one assumption in this file — single machine, single process — and it is
 * the thing to revisit before scaling out, not after.
 */
export async function refreshPlanOverrides(): Promise<void> {
  try {
    const rows = await prisma.planOverride.findMany();
    const next = new Map<PlanId, PlanOverridePatch>();
    for (const row of rows) {
      // A row for a plan that no longer exists is ignored rather than
      // repaired: deleting it here would throw away an operator's settings
      // because of a rename, and keeping it costs nothing.
      if (!(PLAN_IDS as readonly string[]).includes(row.id)) continue;
      next.set(row.id as PlanId, {
        dailyEstimates: row.dailyEstimates,
        ads: row.ads,
        photo: row.photo,
        recipeScan: row.recipeScan,
        health: row.health,
        weeklyReport: row.weeklyReport,
        weeklyReview: row.weeklyReview,
        eatingWindow: row.eatingWindow,
        fasting: row.fasting,
        keto: row.keto,
        measurements: row.measurements,
        progressPhotos: row.progressPhotos,
      });
    }
    overrides = next;
  } catch (error) {
    console.error("Could not read the plan overrides; using the plans as written:", error);
  }
}

/**
 * Switches the override layer on and reads it in.
 *
 * Called once from src/server.ts at boot, and nowhere else. Until it runs,
 * `planFor()` returns the plans exactly as src/plans.ts writes them — which is
 * what every test sees, and what the app falls back to if this fails.
 */
export async function installPlanOverrides(): Promise<void> {
  setPlanLens(applyPlanOverride);
  await refreshPlanOverrides();
}

/** Drops everything in memory. Tests use it; nothing in the app does. */
export function forgetPlanOverrides(): void {
  overrides = new Map();
}

/**
 * A plan with whatever the operator has changed laid over the top.
 *
 * Only a non-null override counts. Null and undefined both mean "the code
 * decides", which is what lets a single row hold an edit to one feature
 * without freezing every other field at the value it had that day.
 */
export function applyPlanOverride(plan: Plan): Plan {
  const patch = overrides.get(plan.id);
  if (!patch) return plan;

  const out: Plan = { ...plan };
  for (const flag of EDITABLE_FLAGS) {
    const value = patch[flag];
    if (typeof value === "boolean") out[flag] = value;
  }
  const daily = patch.dailyEstimates;
  if (typeof daily === "number" && Number.isInteger(daily) && daily >= 0 && daily <= MAX_DAILY_ESTIMATES) {
    out.dailyEstimates = daily;
  }
  return out;
}

/** What has been overridden for one plan, for the admin screen to show. */
export function overrideFor(planId: PlanId): PlanOverridePatch {
  return overrides.get(planId) ?? {};
}

/**
 * Writes one plan's overrides, storing only what differs from the code.
 *
 * The "only what differs" part is the whole reason this is a patch table and
 * not a copy of the plans. A value equal to the code's own is stored as null,
 * so the plan goes back to tracking the deployment: change the default in
 * src/plans.ts later and this plan picks it up, instead of being pinned to a
 * number somebody once agreed with.
 *
 * A row that ends up entirely null is deleted rather than kept, so "has this
 * plan been edited at all" stays a question the table itself can answer.
 */
export async function savePlanOverride(planId: PlanId, base: Plan, patch: PlanOverridePatch): Promise<void> {
  const data: Record<string, number | boolean | null> = {};

  for (const flag of EDITABLE_FLAGS) {
    const value = patch[flag];
    if (value === undefined) continue;
    data[flag] = value === null || value === base[flag] ? null : value;
  }
  if (patch.dailyEstimates !== undefined) {
    const value = patch.dailyEstimates;
    data.dailyEstimates = value === null || value === base.dailyEstimates ? null : value;
  }

  const existing = await prisma.planOverride.findUnique({ where: { id: planId } });
  const merged = { ...stripMeta(existing), ...data };
  const empty = Object.values(merged).every((value) => value === null || value === undefined);

  if (empty) {
    // deleteMany rather than delete: there may be no row to remove, and
    // "nothing to undo" is a success, not a failure.
    await prisma.planOverride.deleteMany({ where: { id: planId } });
  } else {
    await prisma.planOverride.upsert({
      where: { id: planId },
      create: { id: planId, ...merged },
      update: merged,
    });
  }

  await refreshPlanOverrides();
}

/** The stored columns, without the id and the timestamp Prisma manages. */
function stripMeta(row: Record<string, unknown> | null): Record<string, number | boolean | null> {
  if (!row) return {};
  const out: Record<string, number | boolean | null> = {};
  for (const key of [...EDITABLE_FLAGS, "dailyEstimates"]) {
    const value = row[key];
    out[key] = value === undefined ? null : (value as number | boolean | null);
  }
  return out;
}

/**
 * ── The ladder ─────────────────────────────────────────────────────────────
 *
 * Tiers only make sense as a ladder: everything Free gets, Plus gets, and
 * everything Plus gets, Pro gets. A grid of independent tick-boxes can express
 * a configuration where Plus includes something Pro doesn't, and that is never
 * an intended state — it is a support ticket from somebody who upgraded and
 * lost a feature.
 *
 * So a tick is not a single cell. Ticking a feature on Free ticks it on Plus
 * and Pro too, ticking on Plus ticks Pro, and ticking on Pro ticks only Pro.
 * Unticking runs the other way, because that is what keeps the same invariant
 * from the other end: unticking on Plus has to untick Free, or Free would be
 * left holding something the tier above it lost.
 *
 * This runs on the server as well as in the browser. The grid enforces it so
 * the screen never shows an impossible ladder mid-edit; the server enforces it
 * because a screen is not a guarantee, and the one thing that must be true of
 * this table is that no account can be worse off for paying more.
 */

/** Plans from cheapest to dearest — the order the ladder climbs. */
const LADDER: readonly PlanId[] = PLAN_IDS;

/**
 * The whole column for one feature after a tick or untick at one rung.
 *
 * Returns a value for every plan, not just the changed ones, so the caller
 * never has to work out which rows the change reached.
 */
export function cascadeFlag(
  current: Record<PlanId, boolean>,
  changed: PlanId,
  enabled: boolean,
): Record<PlanId, boolean> {
  const at = LADDER.indexOf(changed);
  const out = { ...current };
  for (const [index, id] of LADDER.entries()) {
    // Switching on reaches upward, switching off reaches downward. Either way
    // the rung that was tapped takes the new value and the far end is left
    // alone, which is what makes a tick on Pro a change to Pro only.
    if (enabled ? index >= at : index <= at) out[id] = enabled;
  }
  return out;
}

/**
 * The same, for an allowance rather than a switch.
 *
 * A number has the same ordering problem in a subtler form: Plus with fewer
 * estimates than Free is the same broken ladder as Plus missing a feature Free
 * has. Setting a rung raises everything above it to at least that figure and
 * lowers everything below it to at most — so the ladder stays climbing without
 * flattening the tiers that were already in the right order.
 */
export function cascadeAllowance(
  current: Record<PlanId, number>,
  changed: PlanId,
  value: number,
): Record<PlanId, number> {
  const at = LADDER.indexOf(changed);
  const out = { ...current };
  for (const [index, id] of LADDER.entries()) {
    if (index === at) out[id] = value;
    else if (index > at) out[id] = Math.max(out[id] ?? value, value);
    else out[id] = Math.min(out[id] ?? value, value);
  }
  return out;
}
