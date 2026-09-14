/**
 * Where people fall out, which is the one thing the admin screen couldn't say.
 *
 * The existing overview answers "what is this costing and what is it earning".
 * That is the right question once something is working and the wrong one while
 * you are still finding out whether it does. A month of it tells you the
 * number went up or down; it never tells you why.
 *
 * Three failures look identical from a revenue line and need completely
 * different fixes:
 *
 *   Nobody arrives        — a marketing problem. The app is fine.
 *   They arrive and go    — an onboarding or product problem. More traffic
 *                           just pours more people through the same hole.
 *   They stay and don't pay — a pricing or packaging problem. The product
 *                           works; the offer doesn't.
 *
 * So this measures arrival, activation, retention and conversion separately,
 * by signup week, and lets them be read against each other.
 *
 * ── Computed rather than recorded ────────────────────────────────────────
 *
 * Deliberately no new tables and no event log. Everything here is derived
 * from rows the app already writes — when an account was created, when its
 * entries were logged, what plan it is on — which means it works on the
 * history that already exists rather than starting from the day it shipped.
 * An analytics table would be more flexible and would have told us nothing
 * about anybody who signed up before today.
 *
 * The cost of that is a coarser answer: this knows a user's first and last
 * activity, not every day in between. That is enough to tell the three
 * failures above apart, which is the job.
 *
 * ── How it stays cheap ───────────────────────────────────────────────────
 *
 * Entries are the big table and they are never loaded. They are grouped by
 * match week in the database — one row per user-week rather than per meal —
 * and the weeks are mapped back to users in memory. At a thousand users that
 * is a few thousand rows instead of a few hundred thousand.
 *
 * It will not scale forever. Past a few thousand accounts this wants either
 * a materialised daily rollup or a real analytics store, and the shape of the
 * answer below is what that would have to produce.
 */

import { prisma } from "./db";
import { classifyAccount } from "./accounting";

const DAY_MS = 24 * 60 * 60 * 1000;

/** How long after signing up still counts as "got started at all". */
const ACTIVATION_WINDOW_DAYS = 7;

/** No entry in this long and somebody has stopped, whatever the plan says. */
const ACTIVE_WINDOW_DAYS = 7;

/** How many signup weeks to report. A quarter is enough to see a trend. */
const WEEKS_REPORTED = 12;

export interface CohortRow {
  /** Monday of the signup week, YYYY-MM-DD. */
  week: string;
  signups: number;
  /** Logged at least one thing, ever. */
  activated: number;
  /** Logged something in the last week — still here. */
  stillLogging: number;
  /** On a paid plan now. */
  paying: number;
}

export interface FunnelReport {
  cohorts: CohortRow[];
  totals: {
    users: number;
    activated: number;
    neverLogged: number;
    activeLast7: number;
    activeLast28: number;
    paying: number;
    /** Paid plans with Stripe reporting trouble — cancelling or unpaid. */
    lapsing: number;
  };
  /**
   * How quickly the people who did start, started. A diary someone comes back
   * to tomorrow is a different product from one they set up and abandon.
   */
  activation: {
    sameDay: number;
    withinWeek: number;
    /** Signed up, never logged a single thing. The clearest failure there is. */
    never: number;
  };
}

/** Monday of the week a date falls in, as YYYY-MM-DD. */
function weekKey(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  // getUTCDay is 0 for Sunday, so shift it to a Monday-first week.
  const offset = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - offset);
  return d.toISOString().slice(0, 10);
}

export async function buildFunnel(now = new Date()): Promise<FunnelReport> {
  const [users, matchWeeks, weekActivity] = await Promise.all([
    prisma.user.findMany({
      select: {
        id: true, createdAt: true, plan: true, subscriptionStatus: true,
        // Needed to tell a customer from a comp. Counting everyone on a paid
        // plan as "paying" would have this screen contradicting the revenue
        // figure directly above it.
        stripeSubscriptionId: true, subscriptionInterval: true,
      },
    }),
    prisma.matchWeek.findMany({ select: { id: true, userId: true } }),
    // One row per match week rather than per entry: the entries table is the
    // only one here that grows without bound, and it is never read.
    prisma.entry.groupBy({
      by: ["matchWeekId"],
      _min: { timestamp: true },
      _max: { timestamp: true },
    }),
  ]);

  // MatchWeek.userId is nullable — weeks predating accounts have no owner —
  // so orphans are dropped here rather than being counted against whoever
  // happened to sort first.
  const userForWeek = new Map<number, number>();
  for (const week of matchWeeks) {
    if (week.userId !== null) userForWeek.set(week.id, week.userId);
  }

  // Fold each user's weeks down to when they first logged and last logged.
  const firstSeen = new Map<number, Date>();
  const lastSeen = new Map<number, Date>();
  for (const row of weekActivity) {
    const userId = userForWeek.get(row.matchWeekId);
    if (userId === undefined) continue;
    const min = row._min.timestamp;
    const max = row._max.timestamp;
    if (min && (!firstSeen.has(userId) || min < firstSeen.get(userId)!)) firstSeen.set(userId, min);
    if (max && (!lastSeen.has(userId) || max > lastSeen.get(userId)!)) lastSeen.set(userId, max);
  }

  const activeCutoff = new Date(now.getTime() - ACTIVE_WINDOW_DAYS * DAY_MS);
  const active28Cutoff = new Date(now.getTime() - 28 * DAY_MS);

  const totals = {
    users: users.length,
    activated: 0,
    neverLogged: 0,
    activeLast7: 0,
    activeLast28: 0,
    paying: 0,
    lapsing: 0,
  };
  const activation = { sameDay: 0, withinWeek: 0, never: 0 };

  const byWeek = new Map<string, CohortRow>();

  for (const user of users) {
    const week = weekKey(user.createdAt);
    const row = byWeek.get(week) ?? { week, signups: 0, activated: 0, stillLogging: 0, paying: 0 };
    row.signups += 1;

    const first = firstSeen.get(user.id);
    const last = lastSeen.get(user.id);
    // classifyAccount, not `plan !== "free"` — a comped account is on a paid
    // plan and is not a conversion. See src/accounting.ts.
    const kind = classifyAccount(user);
    const paid = kind === "paying";

    if (first) {
      totals.activated += 1;
      row.activated += 1;
      const gapDays = (first.getTime() - user.createdAt.getTime()) / DAY_MS;
      // Negative can happen where an import back-dates entries before the
      // account existed; it still means they got started at once.
      if (gapDays < 1) activation.sameDay += 1;
      if (gapDays < ACTIVATION_WINDOW_DAYS) activation.withinWeek += 1;
    } else {
      totals.neverLogged += 1;
      activation.never += 1;
    }

    if (last && last >= activeCutoff) {
      totals.activeLast7 += 1;
      row.stillLogging += 1;
    }
    if (last && last >= active28Cutoff) totals.activeLast28 += 1;

    if (paid) {
      totals.paying += 1;
      row.paying += 1;
    }
    if (kind === "lapsed") totals.lapsing += 1;

    byWeek.set(week, row);
  }

  const cohorts = [...byWeek.values()]
    .sort((a, b) => b.week.localeCompare(a.week))
    .slice(0, WEEKS_REPORTED);

  return { cohorts, totals, activation };
}
