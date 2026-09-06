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
  whoopSleeps: [] as any[],
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
      findFirst: vi.fn(async ({ where }: any) => {
        const items = state.entries
          .filter((e) => e.userId === where.matchWeek.userId)
          .filter((e) => (where.kcal?.not === null ? e.kcal !== null : true))
          .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
        return items[0] ?? null;
      }),
      findMany: vi.fn(async ({ where }: any) => {
        let items = state.entries.filter((e) => e.userId === where.matchWeek.userId);
        if (where.timestamp?.gte) items = items.filter((e) => e.timestamp.getTime() >= where.timestamp.gte.getTime());
        if (where.timestamp?.lt) items = items.filter((e) => e.timestamp.getTime() < where.timestamp.lt.getTime());
        if (where.kcal?.not === null) items = items.filter((e) => e.kcal !== null);
        return items;
      }),
    },
    weighIn: {
      findMany: vi.fn(async ({ where }: any) =>
        state.weighIns
          .filter((w) => w.userId === where.userId
            && (!where.date?.gte || w.date >= where.date.gte)
            && (!where.date?.lte || w.date <= where.date.lte))
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
    whoopSleep: {
      findMany: vi.fn(async ({ where }: any) =>
        state.whoopSleeps.filter((sl) => {
          if (sl.userId !== where.userId) return false;
          if (where.start?.gte && sl.start.getTime() < where.start.gte.getTime()) return false;
          if (where.timeAsleepMin?.not === null && sl.timeAsleepMin === null) return false;
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
  state.whoopSleeps.length = 0;
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

/**
 * Midday on the nth date of the current match week, counting the rollover
 * date as 0.
 *
 * daysAgo() looks equivalent for "put this in the current week" and isn't: a
 * mid-day week rolls over part-way through a date, so "yesterday" lands in
 * the *previous* week whenever the suite runs after the rollover time — a
 * failure that only shows up in the evening, and only on some weekdays.
 * Anchoring to the week's own start makes these tests independent of the
 * clock.
 *
 * Pass 1 or more: midday on day 0 is before a 17:00 rollover, so it belongs
 * to the week that's closing rather than the one that's opening.
 */
async function middayInCurrentWeek(cookie: string, dayOffset: number): Promise<Date> {
  const weeks = await fetchBreakdown(cookie, 4);
  const current = weeks[weeks.length - 1]!;
  return new Date(new Date(`${current.weekStart}T12:00:00Z`).getTime() + dayOffset * 86_400_000);
}

interface SummaryResponse {
  avgKcalPerDay: number | null;
  weightPace: { kgPerWeek: number; goalKgPerWeek: number; onTrack: boolean } | null;
  weightTrend: { kgPerWeek: number; projectedWeightKg4wk: number } | null;
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
  avgSleepMinutes: number | null;
  avgSleepPerformance: number | null;
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

    // Anchored to the week's own second and third dates rather than to
    // "today" and "yesterday" — see middayInCurrentWeek for why.
    const dayTwo = await middayInCurrentWeek(cookie, 1);
    const dayThree = await middayInCurrentWeek(cookie, 2);

    // Two entries on one day still count as one logged day.
    state.entries.push(
      { userId, timestamp: dayTwo, kcal: 500 },
      { userId, timestamp: dayTwo, kcal: 300 },
      { userId, timestamp: dayThree, kcal: 400 },
    );

    const weeks = await fetchBreakdown(cookie, 4);
    const currentWeek = weeks[weeks.length - 1]!;
    expect(currentWeek.daysWithEntries).toBe(2);
  });

  it("counts the two boundary days as half a day each", async () => {
    const { cookie, userId } = await signUp("alice");
    // A match week runs Monday evening to Monday evening, so it touches 8
    // calendar days while only being 7 days long. Logging on every one of
    // them must total 7, not 8 — the bug this guards against reported
    // "logged 8 of 7 days".
    const weeksBack = 2;
    const before = await fetchBreakdown(cookie, 4);
    const target = before[before.length - 1 - weeksBack]!;

    // The week opens at 17:00 on its first calendar day and closes at 17:00
    // on its last, so an entry has to land the right side of each boundary
    // to count: evening on the first day, midday on the rest.
    const firstDay = new Date(`${target.weekStart}T20:00:00Z`);
    state.entries.push({ userId, timestamp: firstDay, kcal: 500 });
    const midday = new Date(`${target.weekStart}T12:00:00Z`);
    for (let i = 1; i < 8; i++) {
      state.entries.push({ userId, timestamp: new Date(midday.getTime() + i * 86_400_000), kcal: 500 });
    }

    const weeks = await fetchBreakdown(cookie, 4);
    const week = weeks[weeks.length - 1 - weeksBack]!;
    expect(week.daysWithEntries).toBe(7);
  });

  it("leaves a week with no weigh-in of its own without a weight change", async () => {
    const { cookie, userId } = await signUp("alice");
    // Only one weigh-in, three weeks back. Carrying it forward would report
    // a confident 0.0kg for every week since, which reads as "no progress"
    // rather than "not weighed".
    state.weighIns.push({ userId, date: localDayKey(daysAgo(21), TIMEZONE), weightKg: 92 });

    const weeks = await fetchBreakdown(cookie, 4);
    const currentWeek = weeks[weeks.length - 1]!;
    expect(currentWeek.weightChangeKg).toBeNull();
  });

  it("averages the week's sleep", async () => {
    const { cookie, userId } = await signUp("alice");
    state.whoopSleeps.push(
      { userId, start: await middayInCurrentWeek(cookie, 1), timeAsleepMin: 420, performancePercent: 80 },
      { userId, start: await middayInCurrentWeek(cookie, 2), timeAsleepMin: 480, performancePercent: 90 },
    );

    const weeks = await fetchBreakdown(cookie, 4);
    const currentWeek = weeks[weeks.length - 1]!;
    expect(currentWeek.avgSleepMinutes).toBe(450);
    expect(currentWeek.avgSleepPerformance).toBe(85);
  });

  it("computes week-over-week weight change using the most recent weigh-in per week", async () => {
    const { cookie, userId } = await signUp("alice");
    // Anchored to the weeks themselves rather than to "10 days ago" and
    // "yesterday" — see middayInCurrentWeek. Relative offsets put the later
    // weigh-in in the previous week whenever the suite runs past the
    // rollover, and then the most recent change isn't the one being asserted.
    const thisWeek = await middayInCurrentWeek(cookie, 1);
    const twoWeeksBack = new Date(thisWeek.getTime() - 14 * 86_400_000);
    state.weighIns.push(
      { userId, date: localDayKey(twoWeeksBack, TIMEZONE), weightKg: 92 },
      { userId, date: localDayKey(thisWeek, TIMEZONE), weightKg: 90 },
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


interface StreakResponse {
  current: number;
  currentStartDate: string | null;
  best: { days: number; startDate: string; endDate: string } | null;
  judgedDays: number;
}

async function fetchStreak(cookie: string): Promise<StreakResponse> {
  const res = await fetch(`${baseUrl}/api/stats/deficit-streak`, { headers: { Cookie: cookie } });
  return (await res.json()) as StreakResponse;
}

/** Midday local on the day `n` days ago, so nothing drifts across a boundary. */
function middayDaysAgo(n: number): Date {
  const d = daysAgo(n);
  d.setHours(12, 0, 0, 0);
  return d;
}

describe("GET /api/stats/deficit-streak", () => {
  it("rejects an unauthenticated request", async () => {
    const res = await fetch(`${baseUrl}/api/stats/deficit-streak`);
    expect(res.status).toBe(401);
  });

  it("reports nothing when there's no history at all", async () => {
    const { cookie } = await signUp("alice");
    expect(await fetchStreak(cookie)).toEqual({
      current: 0,
      currentStartDate: null,
      best: null,
      judgedDays: 0,
    });
  });

  it("counts consecutive days finishing under the estimated burn", async () => {
    const { cookie, userId } = await signUp("alice");
    // 2,400 kcal/day estimated burn for this profile; 1,500 in is a deficit.
    state.users[0]!.weightKg = 95;
    state.users[0]!.heightCm = 180;
    state.users[0]!.ageYears = 40;
    state.users[0]!.activityLevel = "moderate";
    for (let d = 5; d >= 1; d--) {
      state.entries.push({ userId, timestamp: middayDaysAgo(d), kcal: 1500 });
    }

    const body = await fetchStreak(cookie);
    expect(body.current).toBe(5);
    expect(body.best!.days).toBe(5);
    expect(body.judgedDays).toBe(5);
  });

  it("breaks the run on a day that went over", async () => {
    const { cookie, userId } = await signUp("alice");
    state.users[0]!.weightKg = 95;
    state.users[0]!.heightCm = 180;
    state.users[0]!.ageYears = 40;
    state.users[0]!.activityLevel = "moderate";
    for (let d = 5; d >= 1; d--) {
      state.entries.push({ userId, timestamp: middayDaysAgo(d), kcal: d === 3 ? 6000 : 1500 });
    }

    const body = await fetchStreak(cookie);
    // Days 2 and 1 ago survive; the blowout on day 3 ends the earlier run.
    expect(body.current).toBe(2);
    expect(body.best!.days).toBe(2);
  });

  it("leaves today out, since it hasn't finished", async () => {
    const { cookie, userId } = await signUp("alice");
    state.users[0]!.weightKg = 95;
    state.users[0]!.heightCm = 180;
    state.users[0]!.ageYears = 40;
    state.users[0]!.activityLevel = "moderate";
    state.entries.push({ userId, timestamp: middayDaysAgo(1), kcal: 1500 });
    state.entries.push({ userId, timestamp: middayDaysAgo(0), kcal: 1500 });

    expect((await fetchStreak(cookie)).current).toBe(1);
  });

  it("counts a Monday once even though a match week opens and closes on it", async () => {
    const { cookie, userId } = await signUp("alice");
    state.users[0]!.weightKg = 95;
    state.users[0]!.heightCm = 180;
    state.users[0]!.ageYears = 40;
    state.users[0]!.activityLevel = "moderate";

    // Two entries on the same calendar day, one either side of the 17:00
    // rollover, so they land in different match weeks. Together they're a
    // single day at 1,600 kcal — under the burn, and worth one day of
    // streak, not two.
    const morning = daysAgo(1); morning.setHours(9, 0, 0, 0);
    const evening = daysAgo(1); evening.setHours(20, 0, 0, 0);
    state.entries.push({ userId, timestamp: morning, kcal: 800 });
    state.entries.push({ userId, timestamp: evening, kcal: 800 });

    const body = await fetchStreak(cookie);
    expect(body.current).toBe(1);
    expect(body.judgedDays).toBe(1);
  });

  it("says nothing rather than guessing when there's no burn figure at all", async () => {
    const { cookie, userId } = await signUp("alice");
    // No body stats and no WHOOP: nothing to judge a day against.
    state.entries.push({ userId, timestamp: middayDaysAgo(1), kcal: 1500 });

    const body = await fetchStreak(cookie);
    expect(body.judgedDays).toBe(0);
    expect(body.current).toBe(0);
  });
});

describe("GET /api/stats/meal-breakdown", () => {
  it("rejects an unauthenticated request", async () => {
    const res = await fetch(`${baseUrl}/api/stats/meal-breakdown`);
    expect(res.status).toBe(401);
  });

  it("ranks meals by calories and averages over the days each was eaten", async () => {
    const { cookie, userId } = await signUp("alice");
    // Dinner on all four days, lunch on two. Dinner totals more, but the
    // point of the per-day-eaten average is that it is not just a total: a
    // lunch that happens half as often still shows what it costs when it does.
    for (let d = 4; d >= 1; d--) {
      state.entries.push({ userId, timestamp: middayDaysAgo(d), kcal: 800, mealType: "dinner", mealTypeSet: true });
    }
    for (const d of [2, 1]) {
      state.entries.push({ userId, timestamp: middayDaysAgo(d), kcal: 600, mealType: "lunch", mealTypeSet: true });
    }

    const res = await fetch(`${baseUrl}/api/stats/meal-breakdown`, { headers: { Cookie: cookie } });
    const body = (await res.json()) as any;

    expect(body.meals.map((m: any) => m.mealType)).toEqual(["dinner", "lunch"]);
    expect(body.meals[0]).toMatchObject({
      mealType: "dinner",
      kcal: 3200,
      avgKcalPerDayEaten: 800,
      daysEaten: 4,
    });
    expect(body.meals[1]).toMatchObject({
      mealType: "lunch",
      kcal: 1200,
      avgKcalPerDayEaten: 600,
      daysEaten: 2,
    });
    // Shares are of everything logged, so they account for the whole window.
    expect(body.meals.reduce((sum: number, m: any) => sum + m.share, 0)).toBe(100);
    expect(body.totalKcal).toBe(4400);
  });

  it("keeps untagged entries out of snack rather than folding them in", async () => {
    // Folding them into snack is the tempting shortcut and it overstates
    // snacking, which is exactly the number someone reads this card for.
    const { cookie, userId } = await signUp("alice");
    state.entries.push({ userId, timestamp: middayDaysAgo(3), kcal: 200, mealType: "snack", mealTypeSet: true });
    state.entries.push({ userId, timestamp: middayDaysAgo(2), kcal: 500, mealType: null, mealTypeSet: true });
    state.entries.push({ userId, timestamp: middayDaysAgo(1), kcal: 700, mealType: "dinner", mealTypeSet: true });

    const res = await fetch(`${baseUrl}/api/stats/meal-breakdown`, { headers: { Cookie: cookie } });
    const body = (await res.json()) as any;

    const untagged = body.meals.find((m: any) => m.mealType === null);
    const snack = body.meals.find((m: any) => m.mealType === "snack");
    expect(untagged).toMatchObject({ label: "Untagged", kcal: 500 });
    expect(snack).toMatchObject({ kcal: 200 });
  });


  it("does not count a slot the clock guessed as a meal the user chose", () => {
    // The complaint that prompted this: switching tags on made a back
    // catalogue of guesses look like it had been categorised all along.
    return (async () => {
      const { cookie, userId } = await signUp("alice");
      state.entries.push({ userId, timestamp: middayDaysAgo(3), kcal: 400, mealType: "lunch", mealTypeSet: false });
      state.entries.push({ userId, timestamp: middayDaysAgo(2), kcal: 400, mealType: "dinner", mealTypeSet: false });
      state.entries.push({ userId, timestamp: middayDaysAgo(1), kcal: 700, mealType: "dinner", mealTypeSet: true });

      const res = await fetch(`${baseUrl}/api/stats/meal-breakdown`, { headers: { Cookie: cookie } });
      const body = (await res.json()) as any;

      // Only the chosen one is a meal; the two guesses are untagged.
      expect(body.meals.find((m: any) => m.mealType === "dinner")).toMatchObject({ kcal: 700 });
      expect(body.meals.find((m: any) => m.mealType === null)).toMatchObject({ kcal: 800 });
      expect(body.meals.find((m: any) => m.mealType === "lunch")).toBeUndefined();
    })();
  });


  it("uses the user's own names for the slots", async () => {
    const { cookie, userId } = await signUp("alice");
    state.users[0]!.mealTagNames = '{"dinner":"Tea"}';
    state.entries.push({ userId, timestamp: middayDaysAgo(1), kcal: 700, mealType: "dinner", mealTypeSet: true });

    const res = await fetch(`${baseUrl}/api/stats/meal-breakdown`, { headers: { Cookie: cookie } });
    const body = (await res.json()) as any;
    expect(body.meals[0].label).toBe("Tea");
  });
});

describe("GET /api/stats/share-card", () => {
  interface ShareCard {
    label: string;
    kcalTotal: number;
    avgKcal: number;
    daysLogged: number;
    daysSoFar: number;
    netKcal: number | null;
    weightChangeKg: number | null;
    weighInCount: number;
    exerciseKcal: number;
  }

  async function fetchCard(cookie: string): Promise<ShareCard> {
    const res = await fetch(`${baseUrl}/api/stats/share-card`, { headers: { Cookie: cookie } });
    return (await res.json()) as ShareCard;
  }

  it("rejects an unauthenticated request", async () => {
    expect((await fetch(`${baseUrl}/api/stats/share-card`)).status).toBe(401);
  });

  it("answers for a week with nothing on it", async () => {
    const { cookie } = await signUp("alice");
    const card = await fetchCard(cookie);
    expect(card).toMatchObject({ kcalTotal: 0, daysLogged: 0, netKcal: null, weightChangeKg: null });
  });

  it("totals the week and averages over the days that have happened", async () => {
    const { cookie, userId } = await signUp("alice");
    const day1 = await middayInCurrentWeek(cookie, 1);
    const day2 = await middayInCurrentWeek(cookie, 2);
    state.entries.push(
      { userId, timestamp: day1, kcal: 2000 },
      { userId, timestamp: day2, kcal: 1600 },
    );

    const card = await fetchCard(cookie);
    expect(card.kcalTotal).toBe(3600);
    expect(card.daysLogged).toBe(2);
    // Averaged over the days so far, not a flat seven — a card made on
    // Wednesday shouldn't be dragged down by four days that haven't arrived.
    expect(card.avgKcal).toBe(Math.round(3600 / card.daysSoFar));
  });

  it("calls two weigh-ins a change and one of them nothing", async () => {
    const { cookie, userId } = await signUp("alice");
    const start = await middayInCurrentWeek(cookie, 1);
    state.weighIns.push({ userId, date: localDayKey(start, TIMEZONE), weightKg: 90.4 });

    expect((await fetchCard(cookie)).weightChangeKg).toBeNull();

    const later = await middayInCurrentWeek(cookie, 3);
    state.weighIns.push({ userId, date: localDayKey(later, TIMEZONE), weightKg: 89.2 });
    const card = await fetchCard(cookie);
    expect(card.weightChangeKg).toBe(-1.2);
    expect(card.weighInCount).toBe(2);
  });

  it("has no net figure without a measured burn behind it", async () => {
    const { cookie, userId } = await signUp("alice");
    state.entries.push({ userId, timestamp: await middayInCurrentWeek(cookie, 1), kcal: 2000 });
    expect((await fetchCard(cookie)).netKcal).toBeNull();
  });

  it("counts a day's net only once that day has finished", async () => {
    const { cookie, userId } = await signUp("alice");
    const day = await middayInCurrentWeek(cookie, 1);
    state.entries.push({ userId, timestamp: day, kcal: 2000 });
    // A cycle covering the whole of that local day.
    const dayStart = new Date(`${localDayKey(day, TIMEZONE)}T00:00:00Z`);
    state.whoopCycles.push({
      userId,
      scoreState: "SCORED",
      start: dayStart,
      end: new Date(dayStart.getTime() + 23 * 3_600_000),
      kcalBurned: 2600,
    });

    const card = await fetchCard(cookie);
    // Only counted if that day is neither today nor still running.
    if (localDayKey(day, TIMEZONE) === localDayKey(new Date(), TIMEZONE)) {
      expect(card.netKcal).toBeNull();
    } else {
      expect(card.netKcal).toBe(-600);
    }
  });

  it("says which week it is", async () => {
    const { cookie } = await signUp("alice");
    const card = await fetchCard(cookie);
    expect(card.label).toMatch(/ – /);
  });
});
