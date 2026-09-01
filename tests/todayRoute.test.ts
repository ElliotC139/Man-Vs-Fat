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

function filterByTimestamp<T extends { timestamp: Date }>(rows: T[], where: any): T[] {
  const range = where?.timestamp;
  if (!range) return rows;
  return rows.filter((row) => {
    if (range.gte && row.timestamp < range.gte) return false;
    if (range.lt && row.timestamp >= range.lt) return false;
    return true;
  });
}

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
    // The route asks for one day at a time now, so the fake has to honour the
    // range rather than handing back everything ever logged.
    entry: {
      findMany: vi.fn(async ({ where }: any = {}) => filterByTimestamp(state.entries, where)),
    },
    exercise: {
      findMany: vi.fn(async ({ where }: any = {}) => filterByTimestamp(state.exercises, where)),
    },
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

/** Files an entry onto a given local day, into whichever week holds it. */
function logOnDay(daysAgo: number, fields: Record<string, unknown>) {
  const timestamp = new Date(Date.now() - daysAgo * 86_400_000);
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
  return localDayKey(timestamp, TIMEZONE);
}

function getToday(cookie: string, date?: string) {
  const query = date ? `?date=${date}` : "";
  return fetch(`${baseUrl}/api/stats/today${query}`, { headers: { Cookie: cookie } });
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

describe("GET /api/stats/today?date", () => {
  it("marks today as today, with no day after it", async () => {
    const cookie = await signUp();
    const body = (await (await getToday(cookie)).json()) as any;

    expect(body.isToday).toBe(true);
    // There is no tomorrow to step into.
    expect(body.nextDate).toBeNull();
    expect(body.previousDate).not.toBeNull();
  });

  it("answers for an earlier day, with only that day's food on it", async () => {
    const cookie = await signUp();
    const twoDaysAgo = logOnDay(2, { kcal: 700, proteinG: 40, carbsG: 60, fatG: 20 });
    logOnDay(0, { kcal: 250 });

    const body = (await (await getToday(cookie, twoDaysAgo)).json()) as any;
    expect(body.date).toBe(twoDaysAgo);
    expect(body.isToday).toBe(false);
    expect(body.kcal.eaten).toBe(700);
    expect(body.entries).toHaveLength(1);
    // Stepping forward from an earlier day is allowed; stepping past today
    // is what the endpoint refuses.
    expect(body.nextDate).not.toBeNull();
  });

  it("leaves today's food off an earlier day and the other way round", async () => {
    const cookie = await signUp();
    const yesterday = logOnDay(1, { kcal: 900 });
    logOnDay(0, { kcal: 250 });

    const past = (await (await getToday(cookie, yesterday)).json()) as any;
    const today = (await (await getToday(cookie)).json()) as any;
    expect(past.kcal.eaten).toBe(900);
    expect(today.kcal.eaten).toBe(250);
  });

  it("steps back a day, including across a month boundary", async () => {
    const cookie = await signUp();
    const body = (await (await getToday(cookie, "2026-03-01")).json()) as any;
    expect(body.previousDate).toBe("2026-02-28");
    expect(body.nextDate).toBe("2026-03-02");
  });

  it("refuses a future date and falls back to today", async () => {
    const cookie = await signUp();
    const body = (await (await getToday(cookie, "2099-01-01")).json()) as any;
    expect(body.date).toBe(localDayKey(new Date(), TIMEZONE));
    expect(body.isToday).toBe(true);
  });

  it("ignores a malformed date rather than erroring", async () => {
    const cookie = await signUp();
    const res = await getToday(cookie, "not-a-date");
    expect(res.status).toBe(200);
    expect(((await res.json()) as any).date).toBe(localDayKey(new Date(), TIMEZONE));
  });
});

/** Files an entry at an exact instant, into whichever match week holds it. */
function logAt(timestamp: Date, fields: Record<string, unknown>) {
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

describe("a day that straddles the week rollover", () => {
  // Monday 31 August 2026, the rollover day for a Monday 17:00 week. Lunch
  // that day belongs to the week ending; dinner to the week beginning. The
  // screen shows a calendar day, so it has to hold both — reading the day out
  // of a single match week dropped whichever half fell in the other one.
  const MONDAY = "2026-08-31";
  const lunch = new Date("2026-08-31T11:00:00Z");   // 12:00 BST — before 17:00
  const dinner = new Date("2026-08-31T19:00:00Z");  // 20:00 BST — after 17:00

  it("counts both sides of the rollover on the same day", async () => {
    const cookie = await signUp();
    logAt(lunch, { kcal: 600 });
    logAt(dinner, { kcal: 900 });

    // The two really are in different weeks — otherwise this proves nothing.
    expect(new Set(state.entries.map((e) => e.matchWeekId)).size).toBe(2);

    const body = (await (await getToday(cookie, MONDAY)).json()) as any;
    expect(body.kcal.eaten).toBe(1500);
    expect(body.entries).toHaveLength(2);
  });

  it("keeps the neighbouring days out of it", async () => {
    const cookie = await signUp();
    logAt(lunch, { kcal: 600 });
    logAt(new Date("2026-08-30T19:00:00Z"), { kcal: 400 });
    logAt(new Date("2026-09-01T11:00:00Z"), { kcal: 300 });

    const body = (await (await getToday(cookie, MONDAY)).json()) as any;
    expect(body.kcal.eaten).toBe(600);
  });
});
