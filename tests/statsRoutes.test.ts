import http from "node:http";
import express from "express";
import cookieParser from "cookie-parser";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  users: [] as any[],
  entries: [] as any[],
  weighIns: [] as any[],
  whoopCycles: [] as any[],
  exercises: [] as any[],
  whoopRecoveries: [] as any[],
  nextUserId: 1,
}));

vi.mock("../src/config", () => ({
  config: { GOOGLE_SIGNIN_CLIENT_ID: undefined, TIMEZONE: "Europe/London" },
}));

vi.mock("../src/db", () => {
  function findUser(where: any) {
    if (where.id !== undefined) return state.users.find((u) => u.id === where.id) ?? null;
    if (where.username !== undefined) return state.users.find((u) => u.username === where.username) ?? null;
    return null;
  }

  const settingStore = new Map<string, string>();

  const prisma: any = {
    user: {
      findUnique: vi.fn(async ({ where }: any) => findUser(where)),
      findUniqueOrThrow: vi.fn(async ({ where }: any) => {
        const user = findUser(where);
        if (!user) throw new Error("User not found");
        return user;
      }),
      create: vi.fn(async ({ data }: any) => {
        const user = {
          id: state.nextUserId++,
          weekStartWeekday: 0,
          weekStartHour: 17,
          weekStartMinute: 0,
          createdAt: new Date(),
          ...data,
        };
        state.users.push(user);
        return user;
      }),
      count: vi.fn(async () => state.users.length),
    },
    setting: {
      upsert: vi.fn(async ({ where, create }: any) => {
        if (!settingStore.has(where.key)) settingStore.set(where.key, create.value);
        return { key: where.key, value: settingStore.get(where.key)! };
      }),
    },
    matchWeek: {
      updateMany: vi.fn(async () => ({ count: 0 })),
    },
    entry: {
      findMany: vi.fn(async ({ where }: any) => {
        let items = state.entries.filter((e) => e.userId === where.matchWeek.userId);
        if (where.timestamp?.gte) items = items.filter((e) => e.timestamp.getTime() >= where.timestamp.gte.getTime());
        if (where.kcal?.not === null) items = items.filter((e) => e.kcal !== null);
        return items;
      }),
    },
    weighIn: {
      findMany: vi.fn(async ({ where }: any) =>
        state.weighIns
          .filter((w) => w.userId === where.userId && (!where.date?.gte || w.date >= where.date.gte))
          .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)),
      ),
    },
    whoopCycle: {
      findMany: vi.fn(async ({ where }: any) =>
        state.whoopCycles.filter((c) => {
          if (c.userId !== where.userId) return false;
          if (where.scoreState && c.scoreState !== where.scoreState) return false;
          if (where.start?.gte && c.start.getTime() < where.start.gte.getTime()) return false;
          if (where.kcalBurned?.not === null && c.kcalBurned === null) return false;
          return true;
        }),
      ),
    },
    exercise: {
      findMany: vi.fn(async ({ where }: any) =>
        state.exercises.filter((e) => {
          if (e.userId !== where.matchWeek.userId) return false;
          if (where.timestamp?.gte && e.timestamp.getTime() < where.timestamp.gte.getTime()) return false;
          if (where.timestamp?.lt && e.timestamp.getTime() >= where.timestamp.lt.getTime()) return false;
          return true;
        }),
      ),
    },
    whoopRecovery: {
      findMany: vi.fn(async ({ where }: any) =>
        state.whoopRecoveries.filter((r) => {
          if (r.userId !== where.userId) return false;
          if (where.date?.gte && r.date < where.date.gte) return false;
          if (where.recoveryScore?.not === null && r.recoveryScore === null) return false;
          return true;
        }),
      ),
    },
    $transaction: vi.fn(async (fn: any) => fn(prisma)),
  };

  return { prisma };
});

import { prisma } from "../src/db";
import { authRouter } from "../src/routes/auth";
import { statsRouter } from "../src/routes/stats";
import { getLocalParts, localDayKey, zonedTimeToUtc } from "../src/matchWeek";

const TIMEZONE = "Europe/London";

let server: http.Server;
let baseUrl: string;

beforeEach(async () => {
  state.users.length = 0;
  state.entries.length = 0;
  state.weighIns.length = 0;
  state.whoopCycles.length = 0;
  state.exercises.length = 0;
  state.whoopRecoveries.length = 0;
  state.nextUserId = 1;
  vi.clearAllMocks();

  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use("/api/auth", authRouter);
  app.use("/api/stats", statsRouter);

  server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  baseUrl = `http://127.0.0.1:${port}`;
});

afterEach(async () => {
  await new Promise((resolve) => server.close(resolve));
});

function sessionCookieFrom(res: Response): string {
  const cookies = res.headers.getSetCookie();
  const sessionCookie = cookies.find((c) => c.startsWith("session="));
  if (!sessionCookie) throw new Error("No session cookie set");
  return sessionCookie.split(";")[0]!;
}

async function signUp(username: string): Promise<{ cookie: string; userId: number }> {
  const res = await fetch(`${baseUrl}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password: "password123" }),
  });
  const body = (await res.json()) as { id: number };
  return { cookie: sessionCookieFrom(res), userId: body.id };
}

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}

interface SummaryResponse {
  avgKcalPerDay: number | null;
  weightPace: { kgPerWeek: number; goalKgPerWeek: number; onTrack: boolean } | null;
  weightTrend: { kgPerWeek: number; projectedWeightKg4wk: number } | null;
  loggingStreakDays: number;
}

async function fetchSummary(cookie: string): Promise<SummaryResponse> {
  const res = await fetch(`${baseUrl}/api/stats/summary`, { headers: { Cookie: cookie } });
  return (await res.json()) as SummaryResponse;
}

describe("GET /api/stats/summary", () => {
  it("rejects an unauthenticated request", async () => {
    const res = await fetch(`${baseUrl}/api/stats/summary`);
    expect(res.status).toBe(401);
  });

  it("returns null avgKcalPerDay with no recent entries", async () => {
    const { cookie } = await signUp("alice");
    const body = await fetchSummary(cookie);
    expect(body.avgKcalPerDay).toBeNull();
  });

  it("averages kcal from entries in the trailing 7 days, ignoring older ones and nulls", async () => {
    const { cookie, userId } = await signUp("alice");
    state.entries.push(
      { userId, timestamp: daysAgo(1), kcal: 2000 },
      { userId, timestamp: daysAgo(2), kcal: 1400 },
      { userId, timestamp: daysAgo(3), kcal: null },
      { userId, timestamp: daysAgo(10), kcal: 5000 }, // outside the window
    );

    const body = await fetchSummary(cookie);
    // (2000 + 1400) / 7 = 485.71... -> rounds to 486
    expect(body.avgKcalPerDay).toBe(486);
  });

  it("returns a null weightPace with fewer than two weigh-ins or no goal set", async () => {
    const { cookie, userId } = await signUp("alice");
    state.weighIns.push({ userId, date: localDayKey(daysAgo(1), TIMEZONE), weightKg: 90 });

    const body = await fetchSummary(cookie);
    expect(body.weightPace).toBeNull();
  });

  it("computes weight pace vs goal and marks on-track when losing at or faster than the goal", async () => {
    const { cookie, userId } = await signUp("alice");
    const user = state.users.find((u) => u.id === userId);
    user.weeklyGoalKg = 0.5;
    state.weighIns.push(
      { userId, date: localDayKey(daysAgo(14), TIMEZONE), weightKg: 92 },
      { userId, date: localDayKey(daysAgo(0), TIMEZONE), weightKg: 91 },
    );
    // Lost 1kg over 14 days = 0.5 kg/week, exactly matching the goal.

    const body = await fetchSummary(cookie);
    expect(body.weightPace!.kgPerWeek).toBeCloseTo(-0.5, 2);
    expect(body.weightPace!.goalKgPerWeek).toBe(0.5);
    expect(body.weightPace!.onTrack).toBe(true);
  });

  it("marks weight pace off-track when gaining", async () => {
    const { cookie, userId } = await signUp("alice");
    const user = state.users.find((u) => u.id === userId);
    user.weeklyGoalKg = 0.5;
    state.weighIns.push(
      { userId, date: localDayKey(daysAgo(14), TIMEZONE), weightKg: 90 },
      { userId, date: localDayKey(daysAgo(0), TIMEZONE), weightKg: 91 },
    );

    const body = await fetchSummary(cookie);
    expect(body.weightPace!.kgPerWeek).toBeGreaterThan(0);
    expect(body.weightPace!.onTrack).toBe(false);
  });

  it("counts a logging streak of consecutive days, allowing today to be unlogged so far", async () => {
    const { cookie, userId } = await signUp("alice");
    state.entries.push(
      { userId, timestamp: daysAgo(1), kcal: 500 },
      { userId, timestamp: daysAgo(2), kcal: 500 },
      { userId, timestamp: daysAgo(3), kcal: 500 },
      { userId, timestamp: daysAgo(5), kcal: 500 }, // breaks the streak — gap at day 4
    );

    const body = await fetchSummary(cookie);
    expect(body.loggingStreakDays).toBe(3);
  });

  it("returns a streak of 0 when neither today nor yesterday was logged", async () => {
    const { cookie, userId } = await signUp("alice");
    state.entries.push({ userId, timestamp: daysAgo(5), kcal: 500 });

    const body = await fetchSummary(cookie);
    expect(body.loggingStreakDays).toBe(0);
  });

  it("returns a weightTrend independent of whether a weekly goal is set", async () => {
    const { cookie, userId } = await signUp("alice");
    state.weighIns.push(
      { userId, date: localDayKey(daysAgo(14), TIMEZONE), weightKg: 92 },
      { userId, date: localDayKey(daysAgo(0), TIMEZONE), weightKg: 90.6 },
    );

    const body = await fetchSummary(cookie);
    expect(body.weightPace).toBeNull(); // no goal set
    expect(body.weightTrend).not.toBeNull();
    expect(body.weightTrend!.kgPerWeek).toBeCloseTo(-0.7, 1);
  });
});

interface BalanceDay {
  date: string;
  kcalIn: number | null;
  kcalOut: number | null;
  kcalOutSource: "whoop" | "estimated" | null;
  balance: number | null;
}

async function fetchBalance(cookie: string, days?: number): Promise<BalanceDay[]> {
  const res = await fetch(`${baseUrl}/api/stats/balance${days ? `?days=${days}` : ""}`, { headers: { Cookie: cookie } });
  return ((await res.json()) as { days: BalanceDay[] }).days;
}

describe("GET /api/stats/balance", () => {
  it("rejects an unauthenticated request", async () => {
    const res = await fetch(`${baseUrl}/api/stats/balance`);
    expect(res.status).toBe(401);
  });

  it("defaults to 30 days and clamps out-of-range values to 7..90", async () => {
    const { cookie } = await signUp("alice");
    expect((await fetchBalance(cookie)).length).toBe(30);
    expect((await fetchBalance(cookie, 999)).length).toBe(90);
    expect((await fetchBalance(cookie, 1)).length).toBe(7);
  });

  it("computes kcal in/out and balance for a day with entries and a scored WHOOP cycle", async () => {
    const { cookie, userId } = await signUp("alice");
    const day = daysAgo(1);
    state.entries.push({ userId, timestamp: day, kcal: 1800 });
    // end an hour after start, well inside the same calendar day, so the
    // whole cycle lands on one day rather than getting split across two.
    state.whoopCycles.push({ userId, start: day, end: new Date(day.getTime() + 60 * 60 * 1000), scoreState: "SCORED", kcalBurned: 2200 });

    const days = await fetchBalance(cookie, 7);
    const entry = days.find((d) => d.date === localDayKey(day, TIMEZONE));
    expect(entry?.kcalIn).toBe(1800);
    expect(entry?.kcalOut).toBe(2200);
    expect(entry?.kcalOutSource).toBe("whoop");
    expect(entry?.balance).toBe(1800 - 2200);
  });

  it("leaves kcalOut and balance null with no WHOOP data and no body-stat profile", async () => {
    const { cookie, userId } = await signUp("alice");
    const day = daysAgo(1);
    state.entries.push({ userId, timestamp: day, kcal: 1500 });

    const days = await fetchBalance(cookie, 7);
    const entry = days.find((d) => d.date === localDayKey(day, TIMEZONE));
    expect(entry?.kcalIn).toBe(1500);
    expect(entry?.kcalOut).toBeNull();
    expect(entry?.kcalOutSource).toBeNull();
    expect(entry?.balance).toBeNull();
  });

  it("splits a multi-day cycle's kcal proportionally across the days it spans", async () => {
    const { cookie, userId } = await signUp("alice");
    // A cycle running exactly London noon-to-noon spans two calendar days
    // 50/50, regardless of the test host's own timezone or DST state.
    const base = getLocalParts(daysAgo(2), TIMEZONE);
    const start = zonedTimeToUtc(base.year, base.month, base.day, 12, 0, TIMEZONE);
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    state.whoopCycles.push({ userId, start, end, scoreState: "SCORED", kcalBurned: 2000 });

    const days = await fetchBalance(cookie, 7);
    const day1 = days.find((d) => d.date === localDayKey(start, TIMEZONE));
    const day2 = days.find((d) => d.date === localDayKey(end, TIMEZONE));
    expect(day1?.kcalOut).toBe(1000);
    expect(day2?.kcalOut).toBe(1000);
  });
});

interface WeekBreakdown {
  weekStart: string;
  weekEnd: string;
  avgKcalPerDay: number | null;
  daysWithEntries: number;
  weightChangeKg: number | null;
  workoutCount: number;
  avgRecovery: number | null;
}

async function fetchBreakdown(cookie: string, weeks?: number): Promise<WeekBreakdown[]> {
  const res = await fetch(`${baseUrl}/api/stats/weekly-breakdown${weeks ? `?weeks=${weeks}` : ""}`, {
    headers: { Cookie: cookie },
  });
  return ((await res.json()) as { weeks: WeekBreakdown[] }).weeks;
}

describe("GET /api/stats/weekly-breakdown", () => {
  it("rejects an unauthenticated request", async () => {
    const res = await fetch(`${baseUrl}/api/stats/weekly-breakdown`);
    expect(res.status).toBe(401);
  });

  it("defaults to 12 weeks and clamps out-of-range values to 4..26", async () => {
    const { cookie } = await signUp("alice");
    expect((await fetchBreakdown(cookie)).length).toBe(12);
    expect((await fetchBreakdown(cookie, 99)).length).toBe(26);
    expect((await fetchBreakdown(cookie, 1)).length).toBe(4);
  });

  it("counts workouts and averages recovery within the current week", async () => {
    const { cookie, userId } = await signUp("alice");
    const now = daysAgo(0);
    state.exercises.push({ userId, timestamp: now }, { userId, timestamp: now });
    state.whoopRecoveries.push(
      { userId, date: localDayKey(now, TIMEZONE), recoveryScore: 40 },
      { userId, date: localDayKey(now, TIMEZONE), recoveryScore: 60 },
    );

    const weeks = await fetchBreakdown(cookie, 4);
    const currentWeek = weeks[weeks.length - 1]!;
    expect(currentWeek.workoutCount).toBe(2);
    expect(currentWeek.avgRecovery).toBe(50);
  });

  it("counts the distinct days with a logged entry within the week", async () => {
    const { cookie, userId } = await signUp("alice");
    const now = daysAgo(0);
    // Two entries on today count as one logged day, plus one more on yesterday.
    state.entries.push(
      { userId, timestamp: now, kcal: 500 },
      { userId, timestamp: now, kcal: 300 },
      { userId, timestamp: daysAgo(1), kcal: 400 },
    );

    const weeks = await fetchBreakdown(cookie, 4);
    const currentWeek = weeks[weeks.length - 1]!;
    expect(currentWeek.daysWithEntries).toBe(2);
  });

  it("computes week-over-week weight change using the most recent weigh-in per week", async () => {
    const { cookie, userId } = await signUp("alice");
    // 9 days apart guarantees two different match weeks (each spans 7 days).
    state.weighIns.push(
      { userId, date: localDayKey(daysAgo(10), TIMEZONE), weightKg: 92 },
      { userId, date: localDayKey(daysAgo(1), TIMEZONE), weightKg: 90 },
    );

    const weeks = await fetchBreakdown(cookie, 4);
    const changes = weeks.map((w) => w.weightChangeKg).filter((c): c is number => c !== null);
    expect(changes.length).toBeGreaterThan(0);
    expect(changes[changes.length - 1]).toBeLessThan(0);
  });
});

interface InsightsResponse {
  insights: { id: string; text: string }[];
}

async function fetchInsights(cookie: string): Promise<InsightsResponse> {
  const res = await fetch(`${baseUrl}/api/stats/insights`, { headers: { Cookie: cookie } });
  return (await res.json()) as InsightsResponse;
}

describe("GET /api/stats/insights", () => {
  it("rejects an unauthenticated request", async () => {
    const res = await fetch(`${baseUrl}/api/stats/insights`);
    expect(res.status).toBe(401);
  });

  it("returns no insights with too little data", async () => {
    const { cookie } = await signUp("alice");
    const body = await fetchInsights(cookie);
    expect(body.insights).toEqual([]);
  });

  it("surfaces a week-over-week calorie insight on a meaningful shift", async () => {
    const { cookie, userId } = await signUp("alice");
    for (let d = 1; d <= 6; d++) state.entries.push({ userId, timestamp: daysAgo(d), kcal: 2500 });
    for (let d = 8; d <= 13; d++) state.entries.push({ userId, timestamp: daysAgo(d), kcal: 1800 });

    const body = await fetchInsights(cookie);
    expect(body.insights.some((i) => i.id === "week-over-week-kcal")).toBe(true);
  });

  it("surfaces a recovery-vs-next-day-kcal insight on a meaningful split", async () => {
    const { cookie, userId } = await signUp("alice");
    for (let d = 10; d <= 12; d++) {
      state.whoopRecoveries.push({ userId, date: localDayKey(daysAgo(d), TIMEZONE), recoveryScore: 30 });
      state.entries.push({ userId, timestamp: daysAgo(d - 1), kcal: 2600 });
    }
    for (let d = 20; d <= 22; d++) {
      state.whoopRecoveries.push({ userId, date: localDayKey(daysAgo(d), TIMEZONE), recoveryScore: 80 });
      state.entries.push({ userId, timestamp: daysAgo(d - 1), kcal: 1900 });
    }

    const body = await fetchInsights(cookie);
    expect(body.insights.some((i) => i.id === "recovery-vs-next-day-kcal")).toBe(true);
  });
});
