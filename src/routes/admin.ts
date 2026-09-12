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
import { planFor, basePlanFor, PLAN_IDS, isPlanId, type PlanId } from "../plans";
import {
  EDITABLE_FLAGS,
  MAX_DAILY_ESTIMATES,
  cascadeAllowance,
  cascadeFlag,
  isEditableFlag,
  overrideFor,
  savePlanOverride,
  type EditableFlag,
} from "../planOverrides";
import { formatMicros } from "../modelPricing";
import { config } from "../config";
import { adminListConfigured, isAdminUser } from "../adminAccess";
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
/**
 * Cached briefly, because this sits in front of every sign-up and the answer
 * changes about once a year. Short enough that closing the door takes effect
 * while the operator is still looking at the screen.
 */
const SIGNUPS_CACHE_MS = 30_000;
let signupsCache: { at: number; open: boolean } | null = null;

/** Clears the cache, so a change made in the admin screen lands at once. */
export function forgetSignupsSetting(): void {
  signupsCache = null;
}

export async function signupsOpen(now = Date.now()): Promise<boolean> {
  if (signupsCache && now - signupsCache.at < SIGNUPS_CACHE_MS) return signupsCache.open;
  try {
    const row = await prisma.setting.findUnique({ where: { key: SIGNUPS_OPEN_KEY } });
    const open = row?.value !== "false";
    signupsCache = { at: now, open };
    return open;
  } catch (error) {
    console.error("Couldn't read whether sign-ups are open; treating them as open:", error);
    // Cached like any other answer, so a settings table that isn't there
    // doesn't log once per sign-up for the life of the process.
    signupsCache = { at: now, open: true };
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
    select: { username: true, isAdmin: true },
  });
  // Through isAdminUser rather than off the stored flag: where the deployment
  // names its admins, that list is the answer and the flag is only a record
  // of it. See src/adminAccess.ts.
  if (!user || !isAdminUser(user)) {
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
  forgetSignupsSetting();
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

  // Where the deployment names its admins, changing the flag here would last
  // until that account's next sign-in and no longer. Refusing says so;
  // accepting it would be a button that appears to work and doesn't.
  if (parsed.data.isAdmin !== undefined && adminListConfigured()) {
    res.status(400).json({
      error: "Admin access is set by this deployment's ADMIN_USERNAMES, not from here.",
    });
    return;
  }

  const user = await prisma.user.update({
    where: { id },
    data: parsed.data,
    select: { id: true, username: true, plan: true, isAdmin: true },
  });
  res.json(user);
});

/**
 * ── What each tier includes ────────────────────────────────────────────────
 *
 * The plans are written in src/plans.ts and reviewed there. This lets the
 * operator change which tier gets what without a deployment — the tick grid
 * from the feature review, made live.
 *
 * Two things are pointedly absent, and the absence is the design. Prices are
 * not here because Stripe holds them, and a second copy would eventually
 * disagree with what customers are actually charged. The monthly cost ceiling
 * is not here because it is the mechanism behind "no plan costs more to serve
 * than it brings in" — every AI call is metered against it, and it stops the
 * month when it is reached. Leave it in code and that promise survives any
 * configuration this screen can produce, including a careless one: tick recipe
 * scanning on to Free and free accounts can scan recipes, but they still
 * cannot spend more than 20p a month doing it.
 *
 * That is the whole safety argument for handing these levers over, and it is
 * why the levers stop where they do.
 */

/**
 * What each switch is, in the words the person deciding would use.
 *
 * `metered` marks the ones that spend money at Anthropic every time somebody
 * uses them. The rest cost nothing to serve and are tier levers purely because
 * they are worth paying for — a distinction worth showing on the screen,
 * because it is the difference between a decision about margin and a decision
 * about positioning.
 */
const FEATURE_COPY: Record<EditableFlag, { name: string; note: string; metered: boolean }> = {
  ads: { name: "Show ads", note: "How the free tier pays for itself.", metered: false },
  photo: { name: "Log by photo", note: "About 1.7x what a typed estimate costs.", metered: true },
  recipeScan: { name: "Scan a recipe or label", note: "The dearest call the app makes — about six typed estimates.", metered: true },
  health: { name: "WHOOP and Apple Health", note: "Measured burn instead of a formula. Free to serve.", metered: false },
  weeklyReport: { name: "Weekly PDF report", note: "And filing it to Google Drive. Free to serve.", metered: false },
  weeklyReview: { name: "In-app weekly review", note: "Free to serve.", metered: false },
  eatingWindow: { name: "Eating-window card", note: "Free to serve.", metered: false },
  fasting: { name: "Fasting timer", note: "Free to serve.", metered: false },
  keto: { name: "Keto mode", note: "Net carbs, and Today leading with them.", metered: false },
  measurements: { name: "Body measurements", note: "Recording new ones. Reading old ones never needs a plan.", metered: false },
  progressPhotos: { name: "Progress photos", note: "Recording new ones. Reading old ones never needs a plan.", metered: false },
};

/** The grid, as the screen draws it: every feature against every plan. */
function planGrid() {
  return {
    features: EDITABLE_FLAGS.map((key) => ({ key, ...FEATURE_COPY[key] })),
    plans: PLAN_IDS.map((id) => {
      const plan = planFor(id);
      const base = basePlanFor(id);
      const patch = overrideFor(id);
      return {
        id,
        name: plan.name,
        pricePence: plan.pricePence,
        // Shown, not editable. The screen says so, and so does the API: there
        // is no request body that changes either of these.
        monthlyCostCap: formatMicros(plan.monthlyCostCapMicros),
        model: plan.model,
        dailyEstimates: plan.dailyEstimates,
        dailyEstimatesDefault: base.dailyEstimates,
        flags: Object.fromEntries(
          EDITABLE_FLAGS.map((key) => [key, { on: plan[key], default: base[key] }]),
        ),
        // Whether anything at all has been changed from the code, so the
        // screen can offer to put one plan back without touching the others.
        edited: Object.values(patch).some((value) => value !== null && value !== undefined),
      };
    }),
  };
}

adminRouter.get("/plans", (_req, res) => {
  res.json(planGrid());
});

/**
 * Writes a change to every plan the ladder reaches, not just the one tapped.
 *
 * One save per plan rather than one transaction, because savePlanOverride has
 * to read each row to work out what still differs from the code. Three small
 * writes on a table with three rows, behind an admin-only route — the
 * simplicity is worth more here than the atomicity.
 */
async function writeLadder(next: Record<PlanId, boolean | number>, key: EditableFlag | "dailyEstimates") {
  for (const id of PLAN_IDS) {
    await savePlanOverride(id, basePlanFor(id), { [key]: next[id] });
  }
}

const flagSchema = z.object({
  flag: z.string().refine(isEditableFlag, "Not a feature this screen can change."),
  plan: z.enum(PLAN_IDS),
  enabled: z.boolean(),
});

adminRouter.put("/plans/flag", async (req, res) => {
  const parsed = flagSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: "Send a feature, a plan and whether it's on." });
    return;
  }
  const { flag, plan, enabled } = parsed.data;

  const current = Object.fromEntries(
    PLAN_IDS.map((id) => [id, planFor(id)[flag as EditableFlag]]),
  ) as Record<PlanId, boolean>;

  await writeLadder(cascadeFlag(current, plan, enabled), flag as EditableFlag);
  res.json(planGrid());
});

const allowanceSchema = z.object({
  plan: z.enum(PLAN_IDS),
  dailyEstimates: z.number().int().min(0).max(MAX_DAILY_ESTIMATES),
});

adminRouter.put("/plans/estimates", async (req, res) => {
  const parsed = allowanceSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: `Send a plan and a whole number from 0 to ${MAX_DAILY_ESTIMATES}.` });
    return;
  }
  const { plan, dailyEstimates } = parsed.data;

  const current = Object.fromEntries(
    PLAN_IDS.map((id) => [id, planFor(id).dailyEstimates]),
  ) as Record<PlanId, number>;

  await writeLadder(cascadeAllowance(current, plan, dailyEstimates), "dailyEstimates");
  res.json(planGrid());
});

/**
 * Puts a plan — or all of them — back to what the code says.
 *
 * Worth having as its own button rather than leaving someone to untick their
 * way back: after a few edits nobody remembers what the defaults were, and
 * "undo everything I did here" is the question actually being asked.
 */
adminRouter.post("/plans/reset", async (req, res) => {
  const requested = req.body?.plan;
  if (requested !== undefined && !isPlanId(requested)) {
    res.status(400).json({ error: "Send a plan to reset, or nothing to reset them all." });
    return;
  }
  const targets = requested ? [requested] : [...PLAN_IDS];
  const cleared = Object.fromEntries(
    [...EDITABLE_FLAGS, "dailyEstimates"].map((key) => [key, null]),
  );
  for (const id of targets) {
    await savePlanOverride(id, basePlanFor(id), cleared);
  }
  res.json(planGrid());
});

/** Whether a stored plan string is one the app knows. Re-exported for tests. */
export { isPlanId };
