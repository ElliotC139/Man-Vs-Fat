/**
 * The two gates every paid boundary goes through.
 *
 * Kept out of the routes themselves because there are six call sites and the
 * interesting part — what the person is told, and with which status — should
 * read the same at all of them. A limit that explains itself differently
 * depending on which screen you hit it from is a limit people think is a bug.
 *
 * Statuses are chosen to mean something to the client:
 *
 *   402 — this needs a different plan, or this month's budget is spent. Both
 *         are answered by changing plan, and neither is fixed by waiting a
 *         few minutes.
 *   429 — today's allowance is gone. It comes back at midnight, and the
 *         Retry-After says when.
 */

import type { Request, Response } from "express";
import { checkEntitlement, type AiKind } from "../entitlements";
import { planFor, type Plan } from "../plans";
import { prisma } from "../db";
import { config } from "../config";
import { getLocalParts, zonedTimeToUtc } from "../matchWeek";

/** Seconds until the local day rolls over, for Retry-After. */
function secondsUntilTomorrow(now: Date): number {
  const { year, month, day } = getLocalParts(now, config.TIMEZONE);
  const midnight = zonedTimeToUtc(year, month, day + 1, 0, 0, config.TIMEZONE);
  return Math.max(60, Math.ceil((midnight.getTime() - now.getTime()) / 1000));
}

/**
 * Checks an AI call against the caller's plan.
 *
 * Returns the model to use, or null having already answered the request. The
 * null-means-handled shape keeps the call site to two lines, which matters
 * when it is repeated at every route that spends money.
 */
export async function gateAiCall(
  req: Request,
  res: Response,
  kind: AiKind,
): Promise<{ model: string } | null> {
  const now = new Date();
  const verdict = await checkEntitlement(req.userId!, kind, now);

  if (verdict.allowed) return { model: verdict.model };

  const body = {
    error: verdict.message,
    // What the client needs to offer the right way out: which limit was hit,
    // and what the account is on now.
    limit: verdict.reason,
    plan: verdict.allowance.plan.id,
    usedToday: verdict.allowance.usedToday,
    dailyEstimates: verdict.allowance.plan.dailyEstimates,
  };

  if (verdict.reason === "daily") {
    res.status(429).set("Retry-After", String(secondsUntilTomorrow(now))).json(body);
  } else {
    res.status(402).json(body);
  }
  return null;
}

/** Everything a plan can switch on that isn't an AI call. */
export type PlanFeature = "photo" | "recipeScan" | "health" | "weeklyReport";

const FEATURE_COPY: Record<PlanFeature, string> = {
  photo: "Logging by photo is part of Plus.",
  recipeScan: "Scanning a recipe is part of Pro.",
  health: "Connecting WHOOP or Apple Health is part of Pro.",
  weeklyReport: "The weekly report is part of Pro.",
};

/**
 * Checks a feature the plan either has or doesn't.
 *
 * Same shape as the AI gate: returns the plan, or null having answered. The
 * message always names what still works — a limit that only says no reads as
 * the app being broken rather than as a choice someone can make.
 */
export async function gateFeature(
  req: Request,
  res: Response,
  feature: PlanFeature,
): Promise<Plan | null> {
  const user = await prisma.user.findUnique({ where: { id: req.userId! }, select: { plan: true } });
  const plan = planFor(user?.plan);
  if (plan[feature]) return plan;

  res.status(402).json({ error: FEATURE_COPY[feature], limit: "plan", feature, plan: plan.id });
  return null;
}
