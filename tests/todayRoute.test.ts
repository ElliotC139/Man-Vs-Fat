import http from "node:http";
import express from "express";
import cookieParser from "cookie-parser";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The Today screen is what the app opens on, and it renders from one call —
 * so this endpoint has to be right about an empty day as well as a busy one.
 */
const TIMEZONE = "Europe/London";

const state = vi.hoisted(() => ({
  users: [] as any[],
  weeks: [] as any[],
  entries: [] as any[],
  exercises: [] as any[],
  water: [] as any[],
  notes: [] as any[],
  nextId: 1,
}));

vi.mock("../src/config", () => ({
  config: { TIMEZONE: "Europe/London", GOOGLE_SIGNIN_CLIENT_ID: undefined },
}));

vi.mock("../src/whoop/sync", () => ({
  getRecentSleepRecovery: vi.fn(async () => []),
}));

vi.mock("../src/db", () => {
  const prisma: any = {
    user: {
      findUnique: vi.fn(async ({ where }: any) =>
        state.users.find((u) => (where.id !== undefined ? u.id === where.id : u.username === where.username)) ?? null,
      ),
      findUniqueOrThrow: vi.fn(async ({ where }: any) => {
        const user = state.users.find((u) => u.id === where.id);
        if (!user) throw new Error("no user");
        return user;
      }),
      create: vi.fn(async ({ data }: any) => {
        const user = {
          id: state.nextId++,
          weekStartWeekday: 0,
          weekStartHour: 17,
          weekStartMinute: 0,
          dailyCalorieTarget: null,
          macroMode: null,
          sessionsValidFrom: null,
          ...data,
        };
        state.users.push(user);
        return user;
      }),
      count: vi.fn(async () => state.users.length),
      update: vi.fn(async ({ where, data }: any) => {
        const user = state.users.find((u) => u.id === where.id);
        Object.assign(user, data);
        return user;
      }),
    },
    setting: { upsert: vi.fn(async ({ where, create }: any) => ({ key: where.key, value: create.value })) },
    matchWeek: {
      updateMany: vi.fn(async () => ({ count: 0 })),
      findUnique: vi.fn(async ({ where }: any) => {
        const key = where.userId_startsAt_endsAt;
        const week = state.weeks.find(
          (w) => w.userId === key.userId
            && w.startsAt.getTime() === key.startsAt.getTime()
            && w.endsAt.getTime() === key.endsAt.getTime(),
        );
        if (!week) return null;
        return {
          ...week,
          entries: state.entries.filter((e) => e.matchWeekId === week.id),
          exercises: state.exercises.filter((x) => x.matchWeekId === week.id),
        };
      }),
    },
    entry: { findMany: vi.fn(async () => state.entries) },
    waterLog: {
      findUnique: vi.fn(async ({ where }: any) =>
        state.water.find((w) => w.date === where.userId_date.date) ?? null,
      ),
    },
    dayNote: {
      findUnique: vi.fn(async ({ where }: any) =>
        state.notes.find((n) => n.date === where.userId_date.date) ?? null,
      ),
    },
    whoopCycle: { findMany: vi.fn(async () => []) },
    $transaction: vi.fn(async (arg: any) => (Array.isArray(arg) ? Promise.all(arg) : arg(prisma))),
  };
  return { prisma };
});

import { authRouter } from "../src/routes/auth";
import { statsRouter } from "../src/routes/stats";
import { getMatchWeekBoundaries, localDayKey } from "../src/matchWeek";

let server: http.Server;
let baseUrl: string;

beforeEach(async () => {
  for (const key of ["users", "weeks", "entries", "exercises", "water", "notes"] as const) state[key].length = 0;
  state.nextId = 1;
  vi.clearAllMocks();

  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use("/api/auth", authRouter);
  app.use("/api/stats", statsRouter);
  server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  baseUrl = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
});

afterEach(async () => {
  await new Promise((resolve) => server.close(resolve));
});

async function signUp(): Promise<string> {
  const res = await fetch(`${baseUrl}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "alice", password: "password123" }),
  });
  return res.headers.getSetCookie().find((c) => c.startsWith("session="))!.split(";")[0]!;
}

/** Files an entry into today's week the way the app would. */
function logToday(fields: Record<string, unknown>) {
  const timestamp = new Date();
  const { start, end } = getMatchWeekBoundaries(timestamp, TIMEZONE, { weekday: 0, hour: 17, minute: 0 });
  let week = state.weeks.find((w) => w.startsAt.getTime() === start.getTime());
  if (!week) {
    week = { id: state.nextId++, userId: 1, startsAt: start, endsAt: end };
    state.weeks.push(week);
  }
  state.entries.push({
    id: state.nextId++,
    matchWeekId: week.id,
    timestamp,
    kcal: null,
    proteinG: null,
    carbsG: null,
    fatG: null,
    ...fields,
  });
}

function getToday(cookie: string) {
  return fetch(`${baseUrl}/api/stats/today`, { headers: { Cookie: cookie } });
}

describe("GET /api/stats/today", () => {
  it("rejects an unauthenticated request", async () => {
    expect((await getToday("")).status).toBe(401);
  });

  it("answers for a day with nothing on it", async () => {
    const cookie = await signUp();
    const body = (await (await getToday(cookie)).json()) as any;

    expect(body.date).toBe(localDayKey(new Date(), TIMEZONE));
    expect(body.kcal.eaten).toBe(0);
    expect(body.entries).toEqual([]);
    expect(body.waterMl).toBe(0);
    // No filler on an empty day — there is nothing yet to observe.
    expect(body.insights).toEqual([]);
  });

  it("totals today's food and macros", async () => {
    const cookie = await signUp();
    logToday({ kcal: 420, proteinG: 14, carbsG: 62, fatG: 9 });
    logToday({ kcal: 540, proteinG: 48, carbsG: 22, fatG: 24 });

    const body = (await (await getToday(cookie)).json()) as any;
    expect(body.kcal.eaten).toBe(960);
    expect(body.macros.eaten).toMatchObject({ protein: 62, carbs: 84, fat: 33, unknownEntries: 0 });
    expect(body.entries).toHaveLength(2);
  });

  it("counts entries that couldn't be estimated rather than hiding them", async () => {
    const cookie = await signUp();
    logToday({ kcal: 400, proteinG: 20, carbsG: 30, fatG: 10 });
    logToday({ kcal: null });

    const body = (await (await getToday(cookie)).json()) as any;
    expect(body.kcal.eaten).toBe(400);
    expect(body.kcal.pendingEntries).toBe(1);
    // The macro-less entry is flagged, so the totals don't look complete.
    expect(body.macros.eaten.unknownEntries).toBe(1);
  });

  it("reports remaining against a calorie target", async () => {
    const cookie = await signUp();
    await fetch(`${baseUrl}/api/auth/me`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ dailyCalorieTarget: 2200 }),
    });
    logToday({ kcal: 960, proteinG: 60, carbsG: 80, fatG: 30 });

    const body = (await (await getToday(cookie)).json()) as any;
    expect(body.kcal.target).toBe(2200);
    expect(body.kcal.remaining).toBe(1240);
    expect(body.kcal.referenceSource).toBe("target");
  });

  it("leaves remaining null with no target to remain against", async () => {
    const cookie = await signUp();
    logToday({ kcal: 960 });

    const body = (await (await getToday(cookie)).json()) as any;
    expect(body.kcal.target).toBeNull();
    expect(body.kcal.remaining).toBeNull();
  });

  it("reports no measured burn when no tracker has scored the day", async () => {
    const cookie = await signUp();
    logToday({ kcal: 500 });

    const body = (await (await getToday(cookie)).json()) as any;
    // Null, not zero — "nothing measured" is not "you burned nothing".
    expect(body.kcal.measuredBurn).toBeNull();
    expect(body.whoop.connected).toBe(false);
  });

  it("names the shortfall on a macro floor", async () => {
    const cookie = await signUp();
    await fetch(`${baseUrl}/api/auth/me`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ macroMode: "grams", proteinTargetG: 180, proteinOp: "min" }),
    });
    logToday({ kcal: 400, proteinG: 62, carbsG: 20, fatG: 10 });

    const body = (await (await getToday(cookie)).json()) as any;
    const macro = body.insights.find((i: any) => i.id === "macro-floor");
    expect(macro.text).toContain("118g");
    expect(macro.text).toContain("protein");
  });

  it("says nothing about a ceiling you're under", async () => {
    const cookie = await signUp();
    await fetch(`${baseUrl}/api/auth/me`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ macroMode: "grams", carbsTargetG: 200, carbsOp: "max" }),
    });
    logToday({ kcal: 400, proteinG: 20, carbsG: 40, fatG: 10 });

    const body = (await (await getToday(cookie)).json()) as any;
    // Being 160g under a carb limit needs no comment.
    expect(body.insights.find((i: any) => i.id === "macro-floor")).toBeUndefined();
  });
});
