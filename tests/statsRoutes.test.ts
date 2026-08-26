import http from "node:http";
import express from "express";
import cookieParser from "cookie-parser";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  users: [] as any[],
  entries: [] as any[],
  weighIns: [] as any[],
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
    $transaction: vi.fn(async (fn: any) => fn(prisma)),
  };

  return { prisma };
});

import { prisma } from "../src/db";
import { authRouter } from "../src/routes/auth";
import { statsRouter } from "../src/routes/stats";
import { localDayKey } from "../src/matchWeek";

const TIMEZONE = "Europe/London";

let server: http.Server;
let baseUrl: string;

beforeEach(async () => {
  state.users.length = 0;
  state.entries.length = 0;
  state.weighIns.length = 0;
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
});
