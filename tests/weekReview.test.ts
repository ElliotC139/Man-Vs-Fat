import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  weeks: [] as any[],
  updates: [] as { id: number; insightsJson: string | null }[],
  /** What the (mocked) model returns; null stands in for a failed call. */
  generated: null as any,
  generateCalls: 0,
}));

vi.mock("../src/config", () => ({ config: { TIMEZONE: "Europe/London" } }));

vi.mock("../src/db", () => ({
  prisma: {
    matchWeek: {
      findFirst: vi.fn(async ({ where }: any) => {
        const candidates = state.weeks
          .filter((w) => w.userId === where.userId && w.endsAt <= where.endsAt.lte)
          .sort((a, b) => b.startsAt - a.startsAt);
        return candidates[0] ?? null;
      }),
      update: vi.fn(async ({ where, data }: any) => {
        state.updates.push({ id: where.id, insightsJson: data.insightsJson });
        return { id: where.id, ...data };
      }),
    },
  },
}));

vi.mock("../src/insights", () => ({
  generateWeekInsights: vi.fn(async () => {
    state.generateCalls += 1;
    return state.generated;
  }),
}));

import { getWeekInsights, parseCachedInsights, previousWeekNumbers } from "../src/weekReview";

const INSIGHTS = { wentWell: ["Steady week"], couldImprove: [], noticed: [], easyWins: [] };
const PARAMS = { entries: [], totalKcal: 14000, dailyAverage: 2000, daysLogged: 7 };

const HOUR = 60 * 60 * 1000;

beforeEach(() => {
  state.weeks.length = 0;
  state.updates.length = 0;
  state.generated = INSIGHTS;
  state.generateCalls = 0;
  vi.clearAllMocks();
});

describe("parseCachedInsights", () => {
  it("treats unreadable cached JSON as nothing cached", () => {
    expect(parseCachedInsights("{not json")).toBeNull();
    expect(parseCachedInsights(null)).toBeNull();
  });
});

describe("getWeekInsights", () => {
  const finishedWeek = (overrides = {}) => ({
    id: 1,
    startsAt: new Date(Date.now() - 14 * 24 * HOUR),
    endsAt: new Date(Date.now() - 7 * 24 * HOUR),
    insightsJson: null,
    insightsAt: null,
    ...overrides,
  });
  const runningWeek = (overrides = {}) => ({
    id: 2,
    startsAt: new Date(Date.now() - 2 * 24 * HOUR),
    endsAt: new Date(Date.now() + 5 * 24 * HOUR),
    insightsJson: null,
    insightsAt: null,
    ...overrides,
  });

  it("generates and caches when nothing is stored", async () => {
    const result = await getWeekInsights(finishedWeek(), PARAMS);
    expect(result).toEqual(INSIGHTS);
    expect(state.generateCalls).toBe(1);
    expect(state.updates).toHaveLength(1);
  });

  it("never regenerates for a week that's already over", async () => {
    const week = finishedWeek({
      insightsJson: JSON.stringify(INSIGHTS),
      // Cached long enough ago that a running week would have refreshed.
      insightsAt: new Date(Date.now() - 30 * 24 * HOUR),
    });
    const result = await getWeekInsights(week, PARAMS);
    expect(result).toEqual(INSIGHTS);
    expect(state.generateCalls).toBe(0);
  });

  it("reuses a fresh cache for a week still running", async () => {
    const week = runningWeek({
      insightsJson: JSON.stringify(INSIGHTS),
      insightsAt: new Date(Date.now() - 1 * HOUR),
    });
    await getWeekInsights(week, PARAMS);
    expect(state.generateCalls).toBe(0);
  });

  it("re-reads a running week whose cached review has gone stale", async () => {
    const week = runningWeek({
      insightsJson: JSON.stringify(INSIGHTS),
      insightsAt: new Date(Date.now() - 12 * HOUR),
    });
    await getWeekInsights(week, PARAMS);
    expect(state.generateCalls).toBe(1);
  });

  it("spends nothing when only the cache was asked for", async () => {
    const result = await getWeekInsights(runningWeek(), { ...PARAMS, cachedOnly: true });
    expect(result).toBeNull();
    expect(state.generateCalls).toBe(0);
  });

  it("keeps the old review when a regeneration fails", async () => {
    state.generated = null;
    const week = runningWeek({
      insightsJson: JSON.stringify(INSIGHTS),
      insightsAt: new Date(Date.now() - 12 * HOUR),
    });
    const result = await getWeekInsights(week, PARAMS);
    // Better a slightly old review than an empty card.
    expect(result).toEqual(INSIGHTS);
    expect(state.updates).toHaveLength(0);
  });

  it("doesn't try to write a review for the no-entries stub week", async () => {
    await getWeekInsights(finishedWeek({ id: 0 }), PARAMS);
    expect(state.generateCalls).toBe(1);
    expect(state.updates).toHaveLength(0);
  });
});

describe("previousWeekNumbers", () => {
  it("reports nothing rather than zeroes when there's no previous week", async () => {
    expect(await previousWeekNumbers(1, new Date())).toBeNull();
  });

  it("ignores a previous week that was never logged in", async () => {
    state.weeks.push({ id: 1, userId: 1, startsAt: 0, endsAt: new Date(0), entries: [] });
    // Otherwise "you ate 14,000 fewer kcal than last week" would be reported
    // for a week that simply wasn't tracked.
    expect(await previousWeekNumbers(1, new Date())).toBeNull();
  });

  it("averages over the days actually logged, not the calendar week", async () => {
    state.weeks.push({
      id: 1,
      userId: 1,
      startsAt: 0,
      endsAt: new Date(0),
      entries: [
        { kcal: 1000, timestamp: new Date("2026-01-05T12:00:00Z") },
        { kcal: 1000, timestamp: new Date("2026-01-05T18:00:00Z") },
        { kcal: 1000, timestamp: new Date("2026-01-06T12:00:00Z") },
      ],
    });
    const result = await previousWeekNumbers(1, new Date());
    expect(result).toEqual({ totalKcal: 3000, daysLogged: 2, dailyAverage: 1500 });
  });
});
