/**
 * The operator's screen: who has signed up, what they are on, and what the
 * AI is costing.
 *
 * Three jobs, and they are the three the person paying the API bill actually
 * needs:
 *
 *   - Open or close sign-ups. A running app with an open door is one bad day
 *     on Hacker News away from an API bill nobody agreed to.
 *   - Move an account between plans. Comping a friend, fixing a payment that
 *     went wrong, granting the operator themselves the run of the app — all
 *     of it otherwise means a database client and a hand-written UPDATE.
 *   - See the money. This is the only place in the app that shows what
 *     accounts cost to serve, which is deliberate: it is the operator's
 *     business and nobody else's.
 */

import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { requireAuth } from "../auth";
import { planFor, PLAN_IDS, isPlanId } from "../plans";
import { formatMicros } from "../modelPricing";
import { config } from "../config";
import { getLocalParts, zonedTimeToUtc } from "../matchWeek";

export const adminRouter = Router();
adminRouter.use(requireAuth);

/** The Setting key that holds whether anybody new may join. */
export const SIGNUPS_OPEN_KEY = "signupsOpen";

/**
 * Whether sign-ups are open.
 *
 * Absent reads as open, which is what every deployment meant before this
 * existed. Closing it is a decision someone has to make; leaving it alone
 * shouldn't lock the door behind them.
 *
 * A failed read reads as open too, and never throws. This sits in front of
 * every sign-up, and a settings table that can't be read should not be able
 * to take the front door off the app — the account creation right behind it
 * would fail on its own if the database were genuinely down, with a far
 * better error than this one could give.
 */
export async function signupsOpen(): Promise<boolean> {
  try {
    const row = await prisma.setting.findUnique({ where: { key: SIGNUPS_OPEN_KEY } });
    return row?.value !== "false";
  } catch (error) {
    console.error("Couldn't read whether sign-ups are open; treating them as open:", error);
    return true;
  }
}

/**
 * Admin only, and 404 rather than 403 for everyone else.
 *
 * A 403 confirms the screen exists and that this account simply isn't allowed
 * near it, which is a fact worth not handing out. As far as a normal account
 * can tell, there is no admin API.
 */
adminRouter.use(async (req, res, next) => {
  const user = await prisma.user.findUnique({
    where: { id: req.userId! },
    select: { isAdmin: true },
  });
  if (!user?.isAdmin) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  next();
});

/** The first instant of the current local month, which spend is measured over. */
function startOfLocalMonth(now: Date): Date {
  const { year, month } = getLocalParts(now, config.TIMEZONE);
  return zonedTimeToUtc(year, month, 1, 0, 0, config.TIMEZONE);
}

adminRouter.get("/overview", async (_req, res) => {
  const now = new Date();
  const monthStart = startOfLocalMonth(now);

  const [users, open, spendThisMonth, spendByUser, callsThisMonth] = await Promise.all([
    prisma.user.findMany({
      orderBy: { id: "asc" },
      select: {
        id: true, username: true, email: true, plan: true, isAdmin: true,
        createdAt: true, subscriptionStatus: true, subscriptionEndsAt: true,
      },
    }),
    signupsOpen(),
    prisma.aiUsage.aggregate({ where: { at: { gte: monthStart } }, _sum: { costMicros: true } }),
    prisma.aiUsage.groupBy({
      by: ["userId"],
      where: { at: { gte: monthStart } },
      _sum: { costMicros: true },
      _count: { _all: true },
    }),
    prisma.aiUsage.count({ where: { at: { gte: monthStart } } }),
  ]);

  const byUser = new Map(spendByUser.map((row) => [row.userId, row]));
  const totalMicros = spendThisMonth._sum.costMicros ?? 0;

  // What the paid accounts bring in, so the month's spend has something to be
  // read against. Gross — Stripe's fee is not modelled here, so this reads a
  // little high on purpose rather than a little low.
  const revenuePence = users.reduce((sum, user) => sum + planFor(user.plan).pricePence, 0);

  res.json({
    signupsOpen: open,
    month: {
      calls: callsThisMonth,
      costMicros: totalMicros,
      cost: formatMicros(totalMicros),
      revenuePence,
      // The number the whole pricing structure exists to keep positive.
      marginPence: Math.round(revenuePence - totalMicros / 10_000),
    },
    plans: PLAN_IDS.map((id) => ({
      id,
      name: planFor(id).name,
      users: users.filter((user) => planFor(user.plan).id === id).length,
    })),
    users: users.map((user) => {
      const usage = byUser.get(user.id);
      const spent = usage?._sum.costMicros ?? 0;
      const plan = planFor(user.plan);
      return {
        id: user.id,
        username: user.username,
        email: user.email,
        plan: plan.id,
        isAdmin: user.isAdmin,
        createdAt: user.createdAt,
        subscriptionStatus: user.subscriptionStatus,
        subscriptionEndsAt: user.subscriptionEndsAt,
        monthCalls: usage?._count._all ?? 0,
        monthCost: formatMicros(spent),
        monthCostMicros: spent,
        capMicros: plan.monthlyCostCapMicros,
        // Someone sitting on their ceiling is either a very keen user or a
        // problem, and either way it is worth seeing at a glance.
        atCap: spent >= plan.monthlyCostCapMicros,
      };
    }),
  });
});

adminRouter.post("/signups", async (req, res) => {
  const open = req.body?.open;
  if (typeof open !== "boolean") {
    res.status(400).json({ error: "Send { open: true } or { open: false }." });
    return;
  }
  await prisma.setting.upsert({
    where: { key: SIGNUPS_OPEN_KEY },
    create: { key: SIGNUPS_OPEN_KEY, value: String(open) },
    update: { value: String(open) },
  });
  res.json({ signupsOpen: open });
});

const userPatchSchema = z.object({
  plan: z.enum(PLAN_IDS).optional(),
  isAdmin: z.boolean().optional(),
});

adminRouter.patch("/users/:id", async (req, res) => {
  const id = Number(req.params.id);
  const parsed = userPatchSchema.safeParse(req.body ?? {});
  if (!Number.isInteger(id) || !parsed.success || Object.keys(parsed.data).length === 0) {
    res.status(400).json({ error: "Send a plan and/or an isAdmin flag." });
    return;
  }

  const target = await prisma.user.findUnique({ where: { id }, select: { id: true, isAdmin: true } });
  if (!target) {
    res.status(404).json({ error: "No such account." });
    return;
  }

  // Nobody may take their own admin away. It is the one change that can lock
  // the operator out of their own app with no way back in, and a mis-tap
  // should not be able to do it.
  if (parsed.data.isAdmin === false && target.id === req.userId!) {
    res.status(400).json({ error: "You can't remove your own admin access." });
    return;
  }

  const user = await prisma.user.update({
    where: { id },
    data: parsed.data,
    select: { id: true, username: true, plan: true, isAdmin: true },
  });
  res.json(user);
});

/** Whether a stored plan string is one the app knows. Re-exported for tests. */
export { isPlanId };
