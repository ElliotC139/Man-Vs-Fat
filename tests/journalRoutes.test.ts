import http from "node:http";
import express from "express";
import cookieParser from "cookie-parser";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Covers the day-keyed additions: measurements, day notes and water. All
 * three are upserts on (userId, date), so the thing worth pinning down is
 * that logging twice for one day corrects rather than duplicates — and, for
 * water, that a delta is applied to what's already there rather than
 * replacing it.
 */

const state = vi.hoisted(() => ({
  users: [] as any[],
  measurements: [] as any[],
  dayNotes: [] as any[],
  waterLogs: [] as any[],
  nextUserId: 1,
  nextId: 1,
}));

vi.mock("../src/config", () => ({
  config: { GOOGLE_SIGNIN_CLIENT_ID: undefined, TIMEZONE: "Europe/London" },
}));

vi.mock("../src/db", () => {
  function byDay(rows: any[], where: any) {
    return rows.find((row) => row.userId === where.userId && row.date === where.date) ?? null;
  }

  function upsertByDay(rows: any[], { where, update, create }: any) {
    const key = where.userId_date;
    const existing = byDay(rows, key);
    if (existing) {
      Object.assign(existing, update, { updatedAt: new Date() });
      return existing;
    }
    const created = { id: state.nextId++, createdAt: new Date(), updatedAt: new Date(), ...create };
    rows.push(created);
    return created;
  }

  function dayTable(rows: () => any[]) {
    return {
      findMany: vi.fn(async ({ where }: any) =>
        rows()
          .filter((row) => row.userId === where.userId)
          .sort((a, b) => a.date.localeCompare(b.date)),
      ),
      findUnique: vi.fn(async ({ where }: any) => byDay(rows(), where.userId_date)),
      upsert: vi.fn(async (args: any) => upsertByDay(rows(), args)),
      deleteMany: vi.fn(async ({ where }: any) => {
        const list = rows();
        const before = list.length;
        for (let i = list.length - 1; i >= 0; i--) {
          if (list[i].userId === where.userId && list[i].date === where.date) list.splice(i, 1);
        }
        return { count: before - list.length };
      }),
    };
  }

  const settingStore = new Map<string, string>();

  const prisma: any = {
    user: {
      findUnique: vi.fn(async ({ where }: any) => {
        if (where.id !== undefined) return state.users.find((u) => u.id === where.id) ?? null;
        if (where.username !== undefined) return state.users.find((u) => u.username === where.username) ?? null;
        return null;
      }),
      create: vi.fn(async ({ data }: any) => {
        const user = {
          id: state.nextUserId++,
          weekStartWeekday: 0,
          weekStartHour: 17,
          weekStartMinute: 0,
          sessionsValidFrom: null,
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
    matchWeek: { updateMany: vi.fn(async () => ({ count: 0 })) },
    measurement: dayTable(() => state.measurements),
    dayNote: dayTable(() => state.dayNotes),
    waterLog: dayTable(() => state.waterLogs),
    $transaction: vi.fn(async (fn: any) => fn(prisma)),
  };

  return { prisma };
});

import { authRouter } from "../src/routes/auth";
import { bodyRouter } from "../src/routes/body";
import { daysRouter } from "../src/routes/days";

let server: http.Server;
let baseUrl: string;

beforeEach(async () => {
  state.users.length = 0;
  state.measurements.length = 0;
  state.dayNotes.length = 0;
  state.waterLogs.length = 0;
  state.nextUserId = 1;
  state.nextId = 1;
  vi.clearAllMocks();

  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use("/api/auth", authRouter);
  app.use("/api/body", bodyRouter);
  app.use("/api/days", daysRouter);

  server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  baseUrl = `http://127.0.0.1:${port}`;
});

afterEach(async () => {
  await new Promise((resolve) => server.close(resolve));
});

async function signUp(username: string): Promise<string> {
  const res = await fetch(`${baseUrl}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password: "password123" }),
  });
  const cookie = res.headers.getSetCookie().find((c) => c.startsWith("session="));
  if (!cookie) throw new Error("No session cookie set");
  return cookie.split(";")[0]!;
}

function post(path: string, cookie: string, body: unknown) {
  return fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify(body),
  });
}

describe("measurements", () => {
  it("rejects an unauthenticated request", async () => {
    expect((await fetch(`${baseUrl}/api/body/measurements`)).status).toBe(401);
  });

  it("overwrites the same day rather than adding a second row", async () => {
    const cookie = await signUp("alice");
    await post("/api/body/measurements", cookie, { date: "2026-02-01", waistCm: 96 });
    await post("/api/body/measurements", cookie, { date: "2026-02-01", waistCm: 95.5 });

    const rows = (await (await fetch(`${baseUrl}/api/body/measurements`, { headers: { Cookie: cookie } })).json()) as any[];
    expect(rows).toHaveLength(1);
    expect(rows[0].waistCm).toBe(95.5);
  });

  it("refuses a row with no measurements in it", async () => {
    const cookie = await signUp("alice");
    const res = await post("/api/body/measurements", cookie, { date: "2026-02-01" });
    expect(res.status).toBe(400);
  });

  it("refuses a future date", async () => {
    const cookie = await signUp("alice");
    const res = await post("/api/body/measurements", cookie, { date: "2099-01-01", waistCm: 90 });
    expect(res.status).toBe(400);
  });

  it("refuses a measurement well outside human range", async () => {
    const cookie = await signUp("alice");
    // A misplaced decimal point (960 rather than 96.0) is the realistic slip.
    expect((await post("/api/body/measurements", cookie, { date: "2026-02-01", waistCm: 960 })).status).toBe(400);
  });
});

describe("day notes", () => {
  it("saves and replaces a note for a day", async () => {
    const cookie = await signUp("alice");
    await post("/api/days/notes", cookie, { date: "2026-02-01", note: "Stag do" });
    await post("/api/days/notes", cookie, { date: "2026-02-01", note: "Stag do, all weekend" });

    const rows = (await (await fetch(`${baseUrl}/api/days/notes`, { headers: { Cookie: cookie } })).json()) as any[];
    expect(rows).toHaveLength(1);
    expect(rows[0].note).toBe("Stag do, all weekend");
  });

  it("clearing the text deletes the note instead of storing an empty one", async () => {
    const cookie = await signUp("alice");
    await post("/api/days/notes", cookie, { date: "2026-02-01", note: "Food poisoning" });
    const res = await post("/api/days/notes", cookie, { date: "2026-02-01", note: "   " });
    expect(res.status).toBe(204);

    const rows = (await (await fetch(`${baseUrl}/api/days/notes`, { headers: { Cookie: cookie } })).json()) as any[];
    expect(rows).toHaveLength(0);
  });
});

describe("water", () => {
  it("accumulates deltas rather than replacing the total", async () => {
    const cookie = await signUp("alice");
    await post("/api/days/water", cookie, { date: "2026-02-01", deltaMl: 250 });
    await post("/api/days/water", cookie, { date: "2026-02-01", deltaMl: 500 });
    const res = await post("/api/days/water", cookie, { date: "2026-02-01", deltaMl: 250 });

    expect(((await res.json()) as any).ml).toBe(1000);
  });

  it("never goes below zero when undoing more than was logged", async () => {
    const cookie = await signUp("alice");
    await post("/api/days/water", cookie, { date: "2026-02-01", deltaMl: 250 });
    const res = await post("/api/days/water", cookie, { date: "2026-02-01", deltaMl: -500 });
    expect(((await res.json()) as any).ml).toBe(0);
  });
});
