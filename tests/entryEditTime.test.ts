import http from "node:http";
import express from "express";
import cookieParser from "cookie-parser";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The diary sorts on timestamp, so anything that quietly rewrites an entry's
 * time also reorders the list under the reader. The edit form sends `date` on
 * every save — including a save that only changed the quantity — so the rule
 * about when the hour may move has to be exact: moving an entry INTO a meal
 * moves it to that meal's slot, and nothing else touches the time of day.
 */
const TIMEZONE = "Europe/London";

const state = vi.hoisted(() => ({
  users: [] as any[],
  weeks: [] as any[],
  entries: [] as any[],
  nextId: 1,
}));

vi.mock("../src/config", () => ({
  config: { TIMEZONE: "Europe/London", GOOGLE_SIGNIN_CLIENT_ID: undefined },
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
          sessionsValidFrom: null,
          ...data,
        };
        state.users.push(user);
        return user;
      }),
      count: vi.fn(async () => state.users.length),
    },
    setting: { upsert: vi.fn(async ({ where, create }: any) => ({ key: where.key, value: create.value })) },
    matchWeek: {
      findUnique: vi.fn(async ({ where }: any) => {
        const key = where.userId_startsAt_endsAt;
        return (
          state.weeks.find(
            (w) => w.userId === key.userId
              && w.startsAt.getTime() === key.startsAt.getTime()
              && w.endsAt.getTime() === key.endsAt.getTime(),
          ) ?? null
        );
      }),
      create: vi.fn(async ({ data }: any) => {
        const week = { id: state.nextId++, ...data };
        state.weeks.push(week);
        return week;
      }),
      upsert: vi.fn(async ({ where, create }: any) => {
        const key = where.userId_startsAt_endsAt;
        const found = state.weeks.find(
          (w) => w.userId === key.userId
            && w.startsAt.getTime() === key.startsAt.getTime()
            && w.endsAt.getTime() === key.endsAt.getTime(),
        );
        if (found) return found;
        const week = { id: state.nextId++, ...create };
        state.weeks.push(week);
        return week;
      }),
      updateMany: vi.fn(async () => ({ count: 0 })),
    },
    entry: {
      findUnique: vi.fn(async ({ where }: any) => {
        const entry = state.entries.find((e) => e.id === where.id);
        if (!entry) return null;
        return { ...entry, matchWeek: state.weeks.find((w) => w.id === entry.matchWeekId) };
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const entry = state.entries.find((e) => e.id === where.id);
        Object.assign(entry, data);
        return entry;
      }),
      findMany: vi.fn(async () => state.entries),
    },
    $transaction: vi.fn(async (arg: any) => (Array.isArray(arg) ? Promise.all(arg) : arg(prisma))),
  };
  return { prisma };
});

import { authRouter } from "../src/routes/auth";
import { entriesRouter } from "../src/routes/entries";

let server: http.Server;
let baseUrl: string;

beforeEach(async () => {
  state.users.length = 0;
  state.weeks.length = 0;
  state.entries.length = 0;
  state.nextId = 1;
  vi.clearAllMocks();

  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use("/api/auth", authRouter);
  app.use("/api/entries", entriesRouter);
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

/** An entry logged at 14:30 local on 2026-09-09, tagged as whatever is passed. */
function seedEntry(userId: number, mealType: string | null) {
  const week = { id: state.nextId++, userId, startsAt: new Date("2026-09-07T16:00:00Z"), endsAt: new Date("2026-09-14T16:00:00Z") };
  state.weeks.push(week);
  const entry = {
    id: state.nextId++,
    matchWeekId: week.id,
    label: "flapjack",
    kcal: 300,
    quantity: 1,
    mealType,
    proteinG: 4,
    carbsG: 40,
    fatG: 14,
    fibreG: null,
    sugarG: null,
    satFatG: null,
    saltG: null,
    // 14:30 London on 2026-09-09 is 13:30 UTC (BST).
    timestamp: new Date("2026-09-09T13:30:00Z"),
  };
  state.entries.push(entry);
  return entry;
}

function patch(cookie: string, id: number, body: unknown) {
  return fetch(`${baseUrl}/api/entries/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify(body),
  });
}

/** The local hour the stored timestamp lands on, which is what the diary sorts by. */
function localHourOf(entry: any): number {
  return Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: TIMEZONE, hour: "2-digit", hour12: false })
      .format(entry.timestamp),
  );
}

describe("PATCH /api/entries/:id — when the time of day may move", () => {
  it("leaves the time alone when only the quantity changes", async () => {
    const cookie = await signUp();
    const entry = seedEntry(state.users[0].id, "breakfast");

    // Exactly what the edit form sends for a quantity-only save: every field
    // it holds, `date` included.
    const res = await patch(cookie, entry.id, {
      label: "flapjack",
      kcal: 600,
      quantity: 2,
      date: "2026-09-09",
      mealType: "breakfast",
    });

    expect(res.status).toBe(200);
    expect(localHourOf(state.entries[0])).toBe(14);
    expect(state.entries[0].kcal).toBe(600);
  });

  it("keeps the time when the entry is untagged", async () => {
    const cookie = await signUp();
    const entry = seedEntry(state.users[0].id, null);

    await patch(cookie, entry.id, { quantity: 3, date: "2026-09-09", mealType: null });

    expect(localHourOf(state.entries[0])).toBe(14);
  });

  it("moves the entry to the meal's slot when the meal actually changes", async () => {
    const cookie = await signUp();
    const entry = seedEntry(state.users[0].id, null);

    await patch(cookie, entry.id, { date: "2026-09-09", mealType: "dinner" });

    expect(localHourOf(state.entries[0])).toBe(19);
  });

  it("still honours an explicit hour over everything else", async () => {
    const cookie = await signUp();
    const entry = seedEntry(state.users[0].id, "breakfast");

    await patch(cookie, entry.id, { date: "2026-09-09", hour: 6, mealType: "lunch" });

    expect(localHourOf(state.entries[0])).toBe(6);
  });

  it("moves the day without disturbing the time of day", async () => {
    const cookie = await signUp();
    const entry = seedEntry(state.users[0].id, "breakfast");

    await patch(cookie, entry.id, { date: "2026-09-11", mealType: "breakfast" });

    expect(localHourOf(state.entries[0])).toBe(14);
    expect(
      new Intl.DateTimeFormat("en-CA", { timeZone: TIMEZONE }).format(state.entries[0].timestamp),
    ).toBe("2026-09-11");
  });
});
