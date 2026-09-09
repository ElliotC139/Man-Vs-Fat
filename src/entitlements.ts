/**
 * Whether this account may make an AI call right now, and on which model.
 *
 * Two limits, doing different jobs:
 *
 *   - The **daily allowance** is the number a person sees and plans around.
 *     "10 estimates a day" is a promise someone can hold in their head.
 *   - The **monthly cost ceiling** is what makes the plan's price honest. It
 *     is checked against what the API actually charged, not against a count,
 *     so it holds even if the allowance was sized wrong, the prompt grew, or
 *     someone found an expensive way to use the app.
 *
 * The ceiling exists because a count is not a cost. A photo estimate costs
 * roughly twice a typed one, a long description costs more than a short one,
 * and a model change moves both. Rationing by count alone means the promise
 * "this plan is profitable" is only ever as good as the last time somebody
 * checked the arithmetic. Rationing by measured spend means it is true.
 *
 * Both are refusals, not degradations: quietly switching someone to a cheaper
 * model when they hit a limit would mean worse figures in their diary with
 * nothing to tell them why, which is the wrong kind of silence for a number
 * they are going to act on.
 */

import { prisma } from "./db";
import { planFor, type Plan } from "./plans";
import { costMicros, type ModelUsage } from "./modelPricing";
import { config } from "./config";
import { getLocalParts, zonedTimeToUtc } from "./matchWeek";

export type AiKind = "estimate" | "photo" | "recipe" | "exercise";

export interface Allowance {
  plan: Plan;
  /** Estimates made today, against the plan's daily allowance. */
  usedToday: number;
  remainingToday: number;
  /** Spend so far this calendar month, and the plan's ceiling, in micros. */
  spentMicros: number;
  capMicros: number;
}

export type Entitlement =
  | { allowed: true; model: string; allowance: Allowance }
  | { allowed: false; reason: "daily" | "monthly" | "plan"; message: string; allowance: Allowance };

/** Midnight local, as an instant — the day an allowance resets on. */
function startOfLocalDay(now: Date): Date {
  const { year, month, day } = getLocalParts(now, config.TIMEZONE);
  return zonedTimeToUtc(year, month, day, 0, 0, config.TIMEZONE);
}

/** The first instant of the local calendar month a spend ceiling covers. */
function startOfLocalMonth(now: Date): Date {
  const { year, month } = getLocalParts(now, config.TIMEZONE);
  return zonedTimeToUtc(year, month, 1, 0, 0, config.TIMEZONE);
}

export async function readAllowance(userId: number, now = new Date()): Promise<Allowance> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { plan: true } });
  const plan = planFor(user?.plan);

  const [usedToday, spent] = await Promise.all([
    prisma.aiUsage.count({ where: { userId, at: { gte: startOfLocalDay(now) } } }),
    prisma.aiUsage.aggregate({
      where: { userId, at: { gte: startOfLocalMonth(now) } },
      _sum: { costMicros: true },
    }),
  ]);
  const spentMicros = spent._sum.costMicros ?? 0;

  return {
    plan,
    usedToday,
    remainingToday: Math.max(0, plan.dailyEstimates - usedToday),
    spentMicros,
    capMicros: plan.monthlyCostCapMicros,
  };
}

/**
 * The check every AI call goes through.
 *
 * Order matters: the plan gate first (a free account asking for a photo has
 * not run out of anything, it is asking for something its plan doesn't
 * include), then the count, then the ceiling.
 */
export async function checkEntitlement(
  userId: number,
  kind: AiKind,
  now = new Date(),
): Promise<Entitlement> {
  const allowance = await readAllowance(userId, now);
  const { plan } = allowance;

  if (kind === "photo" && !plan.photo) {
    return {
      allowed: false,
      reason: "plan",
      message: `Logging by photo is part of ${plan.id === "free" ? "Plus" : "your plan"}. Everything else still works — scan a barcode, search for it, or type it.`,
      allowance,
    };
  }

  if (allowance.remainingToday <= 0) {
    return {
      allowed: false,
      reason: "daily",
      message: `That's your ${plan.dailyEstimates} AI estimates for today. Search, barcodes and your saved meals still work — they don't count against it.`,
      allowance,
    };
  }

  if (allowance.spentMicros >= allowance.capMicros) {
    return {
      allowed: false,
      reason: "monthly",
      message: "You've used this month's AI estimates. They come back at the start of next month — search, barcodes and your saved meals still work in the meantime.",
      allowance,
    };
  }

  return { allowed: true, model: plan.model, allowance };
}

/**
 * Files what a call cost.
 *
 * Never throws: a call that has already been made and paid for should reach
 * the user even if writing the meter row fails. A lost row under-counts a
 * ceiling by one estimate, which is a far smaller problem than an entry that
 * vanished because the accounting did.
 */
export async function recordAiUsage(userId: number, kind: AiKind, usage: ModelUsage): Promise<void> {
  try {
    await prisma.aiUsage.create({
      data: {
        userId,
        kind,
        model: usage.model,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        cacheReadTokens: usage.cacheReadTokens ?? 0,
        cacheWriteTokens: usage.cacheWriteTokens ?? 0,
        costMicros: costMicros(usage),
      },
    });
  } catch (error) {
    console.error("Failed to record AI usage:", error);
  }
}
