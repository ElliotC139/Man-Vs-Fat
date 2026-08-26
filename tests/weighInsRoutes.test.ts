import http from "node:http";
import express from "express";
import cookieParser from "cookie-parser";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  users: [] as any[],
  weighIns: [] as any[],
  nextUserId: 1,
  nextWeighInId: 1,
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
    weighIn: {
      findMany: vi.fn(async ({ where }: any) =>
        state.weighIns
          .filter((w) => w.userId === where.userId)
          .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)),
      ),
      upsert: vi.fn(async ({ where, update, create }: any) => {
        const existing = state.weighIns.find(
          (w) => w.userId === where.userId_date.userId && w.date === where.userId_date.date,
        );
        if (existing) {
          Object.assign(existing, update, { updatedAt: new Date() });
          return existing;
        }
        const created = { id: state.nextWeighInId++, createdAt: new Date(), updatedAt: new Date(), ...create };
        state.weighIns.push(created);
        return created;
      }),
      deleteMany: vi.fn(async ({ where }: any) => {
        const before = state.weighIns.length;
        state.weighIns = state.weighIns.filter((w) => !(w.userId === where.userId && w.date === where.date));
        return { count: before - state.weighIns.length };
      }),
    },
    $transaction: vi.fn(async (fn: any) => fn(prisma)),
  };

  return { prisma };
});

import { prisma } from "../src/db";
import { authRouter } from "../src/routes/auth";
import { weighInsRouter } from "../src/routes/weighIns";

let server: http.Server;
let baseUrl: string;

beforeEach(async () => {
  state.users.length = 0;
  state.weighIns.length = 0;
  state.nextUserId = 1;
  state.nextWeighInId = 1;
  vi.clearAllMocks();

  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use("/api/auth", authRouter);
  app.use("/api/weigh-ins", weighInsRouter);

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

async function signUp(username: string): Promise<string> {
  const res = await fetch(`${baseUrl}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password: "password123" }),
  });
  return sessionCookieFrom(res);
}

describe("GET /api/weigh-ins", () => {
  it("rejects an unauthenticated request", async () => {
    const res = await fetch(`${baseUrl}/api/weigh-ins`);
    expect(res.status).toBe(401);
  });

  it("returns the caller's own entries sorted by date", async () => {
    const cookie = await signUp("alice");
    await fetch(`${baseUrl}/api/weigh-ins`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ date: "2026-01-15", weightKg: 90 }),
    });
    await fetch(`${baseUrl}/api/weigh-ins`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ date: "2026-01-01", weightKg: 95 }),
    });

    const res = await fetch(`${baseUrl}/api/weigh-ins`, { headers: { Cookie: cookie } });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { date: string; weightKg: number }[];
    expect(body.map((w) => w.date)).toEqual(["2026-01-01", "2026-01-15"]);
  });
});

describe("POST /api/weigh-ins", () => {
  it("creates a new entry for a date", async () => {
    const cookie = await signUp("alice");
    const res = await fetch(`${baseUrl}/api/weigh-ins`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ date: "2026-01-01", weightKg: 95 }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { weightKg: number };
    expect(body.weightKg).toBe(95);
  });

  it("upserts (edits) an existing date instead of duplicating it", async () => {
    const cookie = await signUp("alice");
    await fetch(`${baseUrl}/api/weigh-ins`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ date: "2026-01-01", weightKg: 95 }),
    });
    await fetch(`${baseUrl}/api/weigh-ins`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ date: "2026-01-01", weightKg: 93.5 }),
    });

    const res = await fetch(`${baseUrl}/api/weigh-ins`, { headers: { Cookie: cookie } });
    const body = (await res.json()) as { date: string; weightKg: number }[];
    expect(body).toHaveLength(1);
    expect(body[0]!.weightKg).toBe(93.5);
  });

  it("rejects a weight outside the sane range", async () => {
    const cookie = await signUp("alice");
    const res = await fetch(`${baseUrl}/api/weigh-ins`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ date: "2026-01-01", weightKg: 10 }),
    });
    expect(res.status).toBe(400);
  });

  it("rejects a future date", async () => {
    const cookie = await signUp("alice");
    const res = await fetch(`${baseUrl}/api/weigh-ins`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ date: "2999-01-01", weightKg: 90 }),
    });
    expect(res.status).toBe(400);
  });

  it("rejects an unauthenticated request", async () => {
    const res = await fetch(`${baseUrl}/api/weigh-ins`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: "2026-01-01", weightKg: 90 }),
    });
    expect(res.status).toBe(401);
  });
});

describe("DELETE /api/weigh-ins/:date", () => {
  it("removes only the requesting user's own entry", async () => {
    const aliceCookie = await signUp("alice");
    const bobCookie = await signUp("bob");

    await fetch(`${baseUrl}/api/weigh-ins`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: aliceCookie },
      body: JSON.stringify({ date: "2026-01-01", weightKg: 90 }),
    });
    await fetch(`${baseUrl}/api/weigh-ins`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: bobCookie },
      body: JSON.stringify({ date: "2026-01-01", weightKg: 80 }),
    });

    // Bob deleting the same date only removes his own row, not Alice's.
    const delRes = await fetch(`${baseUrl}/api/weigh-ins/2026-01-01`, { method: "DELETE", headers: { Cookie: bobCookie } });
    expect(delRes.status).toBe(204);

    const aliceList = await fetch(`${baseUrl}/api/weigh-ins`, { headers: { Cookie: aliceCookie } });
    expect(await aliceList.json()).toHaveLength(1);

    const bobList = await fetch(`${baseUrl}/api/weigh-ins`, { headers: { Cookie: bobCookie } });
    expect(await bobList.json()).toHaveLength(0);
  });
});
