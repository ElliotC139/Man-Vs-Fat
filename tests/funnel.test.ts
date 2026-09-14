import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The numbers somebody makes decisions from.
 *
 * A funnel that is quietly wrong is worse than no funnel: it does not look
 * broken, it looks like an answer, and the answer sends you off fixing the
 * wrong end of the product. So these tests are mostly about the ways a count
 * can be subtly off — a cohort boundary, an orphan row, a user with no
 * activity — rather than about the happy path.
 */

vi.mock("../src/config", () => ({
  adminUsernames: [],
  config: {
    GBP_PER_USD: 0.8,
    ANTHROPIC_MODEL: "claude-sonnet-5",
    ANTHROPIC_MODEL_FREE: "claude-haiku-4-5",
  },
}));

const state = vi.hoisted(() => ({
  users: [] as any[],
  matchWeeks: [] as any[],
  entries: [] as any[],
}));

vi.mock("../src/db", () => ({
  prisma: {
    user: { findMany: vi.fn(async () => state.users) },
    matchWeek: { findMany: vi.fn(async () => state.matchWeeks) },
    entry: {
      // The real groupBy returns one row per match week with the first and
      // last timestamp in it; this mirrors that rather than the raw entries.
      groupBy: vi.fn(async () => {
        const by = new Map<number, { matchWeekId: number; _min: any; _max: any }>();
        for (const e of state.entries) {
          const row = by.get(e.matchWeekId) ?? {
            matchWeekId: e.matchWeekId,
            _min: { timestamp: e.timestamp },
            _max: { timestamp: e.timestamp },
          };
          if (e.timestamp < row._min.timestamp) row._min.timestamp = e.timestamp;
          if (e.timestamp > row._max.timestamp) row._max.timestamp = e.timestamp;
          by.set(e.matchWeekId, row);
        }
        return [...by.values()];
      }),
    },
  },
}));

import { buildFunnel } from "../src/funnel";

const NOW = new Date("2026-09-14T12:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000);

let nextId = 1;
let nextWeek = 1;

/**
 * An account, with whatever activity it is supposed to have had.
 *
 * `subscription` is what makes somebody a customer rather than a comp: a plan
 * on its own is what the admin screen hands out by hand. The funnel uses
 * classifyAccount for exactly that reason, so the test has to build both.
 */
function account(opts: {
  createdAt: Date;
  plan?: string;
  subscription?: string | null;
  subscriptionStatus?: string;
  logged?: Date[];
}) {
  const id = nextId++;
  state.users.push({
    id,
    createdAt: opts.createdAt,
    plan: opts.plan ?? "free",
    stripeSubscriptionId: opts.subscription ?? null,
    subscriptionStatus: opts.subscriptionStatus ?? null,
    subscriptionInterval: "month",
  });
  if (opts.logged?.length) {
    const matchWeekId = nextWeek++;
    state.matchWeeks.push({ id: matchWeekId, userId: id });
    for (const timestamp of opts.logged) state.entries.push({ matchWeekId, timestamp });
  }
  return id;
}

beforeEach(() => {
  state.users.length = 0;
  state.matchWeeks.length = 0;
  state.entries.length = 0;
  nextId = 1;
  nextWeek = 1;
});

describe("counting who is still here", () => {
  it("says nothing at all rather than dividing by zero", async () => {
    const report = await buildFunnel(NOW);
    expect(report.totals.users).toBe(0);
    expect(report.cohorts).toEqual([]);
  });

  it("separates signing up, starting, and staying", async () => {
    // Three accounts that fail at three different points — which is the whole
    // reason this exists, because a revenue line shows all three as one dip.
    account({ createdAt: daysAgo(20) }); // never logged
    account({ createdAt: daysAgo(20), logged: [daysAgo(19)] }); // started, gone
    account({ createdAt: daysAgo(20), logged: [daysAgo(19), daysAgo(1)] }); // still here

    const { totals } = await buildFunnel(NOW);
    expect(totals.users).toBe(3);
    expect(totals.activated).toBe(2);
    expect(totals.neverLogged).toBe(1);
    expect(totals.activeLast7).toBe(1);
    // Both who ever logged did so inside 28 days; the one who never logged
    // is not "inactive", it is a different failure and counted separately.
    expect(totals.activeLast28).toBe(2);
  });

  it("counts a user once however many weeks they logged across", async () => {
    // Activity is grouped by match week, so somebody with six months of diary
    // arrives as many rows. They are still one person.
    const id = account({ createdAt: daysAgo(60), logged: [daysAgo(59)] });
    // A second and third week belonging to that same account.
    for (const day of [40, 2]) {
      const week = nextWeek++;
      state.matchWeeks.push({ id: week, userId: id });
      state.entries.push({ matchWeekId: week, timestamp: daysAgo(day) });
    }

    const { totals } = await buildFunnel(NOW);
    expect(totals.users).toBe(1);
    expect(totals.activated).toBe(1);
    expect(totals.activeLast7).toBe(1); // the most recent week is what counts
  });

  it("ignores a match week with no owner", async () => {
    // MatchWeek.userId is nullable. An orphan week's entries belong to nobody
    // and must not be credited to whoever happens to be first in the list.
    account({ createdAt: daysAgo(10) });
    state.matchWeeks.push({ id: 99, userId: null });
    state.entries.push({ matchWeekId: 99, timestamp: daysAgo(1) });

    const { totals } = await buildFunnel(NOW);
    expect(totals.activated).toBe(0);
    expect(totals.activeLast7).toBe(0);
    expect(totals.neverLogged).toBe(1);
  });
});

describe("how quickly people get started", () => {
  it("tells a same-day start from one a week later", async () => {
    account({ createdAt: daysAgo(30), logged: [daysAgo(30)] });   // same day
    account({ createdAt: daysAgo(30), logged: [daysAgo(27)] });   // within the week
    account({ createdAt: daysAgo(30), logged: [daysAgo(10)] });   // came back much later

    const { activation } = await buildFunnel(NOW);
    expect(activation.sameDay).toBe(1);
    expect(activation.withinWeek).toBe(2);
    expect(activation.never).toBe(0);
  });

  it("treats back-dated history as having started at once", async () => {
    // An import can write entries older than the account. That is somebody
    // who arrived with data, not somebody who took negative days to start.
    account({ createdAt: daysAgo(5), logged: [daysAgo(40)] });

    const { activation } = await buildFunnel(NOW);
    expect(activation.sameDay).toBe(1);
    expect(activation.withinWeek).toBe(1);
  });
});

describe("cohorts by the week people signed up", () => {
  it("puts a week's signups in one row, split on Monday", async () => {
    // 2026-09-14 is a Monday, so these two belong to different weeks despite
    // being a day apart — the boundary is the thing worth getting right.
    account({ createdAt: new Date("2026-09-14T09:00:00Z") });
    account({ createdAt: new Date("2026-09-13T09:00:00Z") });

    const { cohorts } = await buildFunnel(NOW);
    expect(cohorts.map((c) => c.week)).toEqual(["2026-09-14", "2026-09-07"]);
    expect(cohorts.every((c) => c.signups === 1)).toBe(true);
  });

  it("reports the newest weeks first", async () => {
    for (const days of [1, 40, 15]) account({ createdAt: daysAgo(days) });
    const { cohorts } = await buildFunnel(NOW);
    const weeks = cohorts.map((c) => c.week);
    expect([...weeks].sort().reverse()).toEqual(weeks);
  });

  it("carries activation and payment into the row, not just the signup", async () => {
    account({ createdAt: daysAgo(3), plan: "plus", subscription: "sub_1", subscriptionStatus: "active", logged: [daysAgo(3), daysAgo(1)] });
    account({ createdAt: daysAgo(3) });

    const { cohorts } = await buildFunnel(NOW);
    expect(cohorts[0]).toMatchObject({ signups: 2, activated: 1, stillLogging: 1, paying: 1 });
  });
});

describe("subscriptions in trouble", () => {
  it("still counts a bounced card as paying, and a cancellation as lapsed", async () => {
    // past_due is deliberately a paying customer: Stripe retries for days, and
    // a bank's fraud check is not a cancellation. That judgement lives once,
    // in billing.ts, and both this screen and the revenue figure follow it.
    account({ createdAt: daysAgo(30), plan: "plus", subscription: "s1", subscriptionStatus: "past_due" });
    account({ createdAt: daysAgo(30), plan: "pro", subscription: "s2", subscriptionStatus: "canceled" });
    account({ createdAt: daysAgo(30), plan: "plus", subscription: "s3", subscriptionStatus: "active" });

    const { totals } = await buildFunnel(NOW);
    expect(totals.paying).toBe(2);
    expect(totals.lapsing).toBe(1);
  });

  it("does not count a comped account as a conversion", async () => {
    // The operator's own Pro account. On a paid plan, nobody paying for it —
    // and this screen sits directly above a revenue figure that agrees.
    account({ createdAt: daysAgo(30), plan: "pro" });

    const { totals } = await buildFunnel(NOW);
    expect(totals.paying).toBe(0);
    expect(totals.lapsing).toBe(0);
  });

  it("never counts a free account as lapsing", async () => {
    // A free account has no subscription to lose, whatever is in the column.
    account({ createdAt: daysAgo(30), plan: "free", subscriptionStatus: "canceled" });

    const { totals } = await buildFunnel(NOW);
    expect(totals.paying).toBe(0);
    expect(totals.lapsing).toBe(0);
  });
});
