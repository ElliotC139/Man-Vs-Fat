import http from "node:http";
import express from "express";
import cookieParser from "cookie-parser";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * A "food" is not a row anywhere — it is every Entry sharing a normalized
 * label. These cover what that means for correcting one: the correction wins
 * on read and on the next one-tap log, and the diary behind it is left alone.
 */
const state = vi.hoisted(() => ({
  users: [] as any[],
  weeks: [] as any[],
  entries: [] as any[],
  favorites: [] as any[],
  tags: [] as any[],
  overrides: [] as any[],
  nextId: 1,
}));

vi.mock("../src/config", () => ({
  config: { TIMEZONE: "Europe/London", GOOGLE_SIGNIN_CLIENT_ID: undefined },
}));

vi.mock("../src/db", () => {
  const match = (rows: any[], where: any) =>
    rows.filter((r) => Object.entries(where ?? {}).every(([k, v]) => r[k] === v));

  const prisma: any = {
    user: {
      findUnique: vi.fn(async ({ where }: any) =>
        state.users.find((u) => (where.id !== undefined ? u.id === where.id : u.username === where.username)) ?? null,
      ),
      findUniqueOrThrow: vi.fn(async ({ where }: any) => {
        const u = state.users.find((x) => x.id === where.id);
        if (!u) throw new Error("no user");
        return u;
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
      upsert: vi.fn(async ({ where, create }: any) => {
        const key = where.userId_startsAt_endsAt;
        const found = state.weeks.find(
          (w) => w.userId === key.userId && w.startsAt.getTime() === key.startsAt.getTime(),
        );
        if (found) return found;
        const week = { id: state.nextId++, ...create };
        state.weeks.push(week);
        return week;
      }),
      updateMany: vi.fn(async () => ({ count: 0 })),
    },
    entry: {
      findMany: vi.fn(async () => [...state.entries].sort((a, b) => b.timestamp - a.timestamp)),
      create: vi.fn(async ({ data }: any) => {
        const entry = { id: state.nextId++, ...data };
        state.entries.push(entry);
        return entry;
      }),
    },
    foodFavorite: { findMany: vi.fn(async () => state.favorites) },
    foodTag: { findMany: vi.fn(async () => state.tags) },
    foodOverride: {
      findMany: vi.fn(async ({ where }: any = {}) => match(state.overrides, where)),
      findUnique: vi.fn(async ({ where }: any) => {
        const key = where.userId_labelKey;
        return state.overrides.find((o) => o.userId === key.userId && o.labelKey === key.labelKey) ?? null;
      }),
      upsert: vi.fn(async ({ where, update, create }: any) => {
        const key = where.userId_labelKey;
        const found = state.overrides.find((o) => o.userId === key.userId && o.labelKey === key.labelKey);
        if (found) {
          Object.assign(found, update);
          return found;
        }
        const made = { id: state.nextId++, ...create };
        state.overrides.push(made);
        return made;
      }),
      deleteMany: vi.fn(async ({ where }: any) => {
        const keep = state.overrides.filter(
          (o) => !(o.userId === where.userId && o.labelKey === where.labelKey),
        );
        const removed = state.overrides.length - keep.length;
        state.overrides.length = 0;
        state.overrides.push(...keep);
        return { count: removed };
      }),
    },
    $transaction: vi.fn(async (arg: any) => (Array.isArray(arg) ? Promise.all(arg) : arg(prisma))),
  };
  return { prisma };
});

import { authRouter } from "../src/routes/auth";
import { foodsRouter, normalizeLabel } from "../src/routes/foods";

let server: http.Server;
let baseUrl: string;

beforeEach(async () => {
  for (const k of ["users", "weeks", "entries", "favorites", "tags", "overrides"] as const) state[k].length = 0;
  state.nextId = 1;
  vi.clearAllMocks();

  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use("/api/auth", authRouter);
  app.use("/api/foods", foodsRouter);
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

/** Puts an entry in the diary. The week it belongs to is created on demand by
 *  the route itself, so nothing here needs to fabricate one. */
function seedEntry(fields: Record<string, unknown>) {
  state.entries.push({
    id: state.nextId++,
    matchWeekId: 999,
    timestamp: new Date(),
    kcal: null,
    proteinG: null,
    carbsG: null,
    fatG: null,
    imageUrl: null,
    source: "ai",
    ...fields,
  });
}

const json = (cookie: string, url: string, body: unknown, method = "POST") =>
  fetch(`${baseUrl}${url}`, {
    method,
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify(body),
  });

describe("GET /api/foods", () => {
  it("groups entries into one food and reports the latest figures", async () => {
    const cookie = await signUp();
    seedEntry({ label: "Greggs sausage roll", kcal: 348, proteinG: 11, carbsG: 26, fatG: 22 });
    seedEntry({ label: "a Greggs sausage roll", kcal: 340 });

    const foods = (await (await fetch(`${baseUrl}/api/foods`, { headers: { Cookie: cookie } })).json()) as any[];
    expect(foods).toHaveLength(1);
    expect(foods[0]).toMatchObject({ count: 2, kcal: 348, proteinG: 11, edited: false });
  });

  it("shows the correction rather than what was last logged", async () => {
    const cookie = await signUp();
    seedEntry({ label: "Greggs sausage roll", kcal: 348, proteinG: 11 });
    const labelKey = normalizeLabel("Greggs sausage roll");

    await json(cookie, "/api/foods/edit", {
      labelKey, label: "Greggs sausage roll (large)", kcal: 420, proteinG: 14, carbsG: 30, fatG: 26,
    }, "PUT");

    const foods = (await (await fetch(`${baseUrl}/api/foods`, { headers: { Cookie: cookie } })).json()) as any[];
    expect(foods[0]).toMatchObject({
      label: "Greggs sausage roll (large)", kcal: 420, proteinG: 14, edited: true,
    });
  });
});

describe("PUT /api/foods/edit", () => {
  it("rejects an unauthenticated request", async () => {
    expect((await json("", "/api/foods/edit", { labelKey: "x", label: "x", kcal: 1 }, "PUT")).status).toBe(401);
  });

  it("refuses a nameless food", async () => {
    const cookie = await signUp();
    expect((await json(cookie, "/api/foods/edit", { labelKey: "x", label: "  ", kcal: 1 }, "PUT")).status).toBe(400);
  });

  it("replaces an earlier correction rather than stacking another", async () => {
    const cookie = await signUp();
    seedEntry({ label: "Porridge", kcal: 300 });
    const labelKey = normalizeLabel("Porridge");

    await json(cookie, "/api/foods/edit", { labelKey, label: "Porridge", kcal: 320 }, "PUT");
    await json(cookie, "/api/foods/edit", { labelKey, label: "Porridge with honey", kcal: 380 }, "PUT");

    expect(state.overrides).toHaveLength(1);
    expect(state.overrides[0]).toMatchObject({ label: "Porridge with honey", kcal: 380 });
  });

  it("leaves entries already in the diary exactly as they were", async () => {
    const cookie = await signUp();
    seedEntry({ label: "Porridge", kcal: 300, proteinG: 9 });
    // structuredClone, not a JSON round trip: that would turn the timestamps
    // into strings and the comparison would fail on its own serialisation.
    const before = structuredClone(state.entries);

    await json(cookie, "/api/foods/edit", {
      labelKey: normalizeLabel("Porridge"), label: "Porridge", kcal: 999, proteinG: 99,
    }, "PUT");

    expect(state.entries).toEqual(before);
  });
});

describe("POST /api/foods/log", () => {
  it("carries the macros over, not just the calories", async () => {
    const cookie = await signUp();
    seedEntry({ label: "Chicken and rice", kcal: 620, proteinG: 52, carbsG: 68, fatG: 14 });

    const res = await json(cookie, "/api/foods/log", { labelKey: normalizeLabel("Chicken and rice") });
    const entry = (await res.json()) as any;
    // These were being dropped, so every one-tap log landed with no macros.
    expect(entry).toMatchObject({ kcal: 620, proteinG: 52, carbsG: 68, fatG: 14 });
  });

  it("logs the corrected figures once a food has been edited", async () => {
    const cookie = await signUp();
    seedEntry({ label: "Greggs sausage roll", kcal: 348, proteinG: 11, carbsG: 26, fatG: 22 });
    const labelKey = normalizeLabel("Greggs sausage roll");
    await json(cookie, "/api/foods/edit", {
      labelKey, label: "Greggs sausage roll (large)", kcal: 420, proteinG: 14, carbsG: 30, fatG: 26,
    }, "PUT");

    const entry = (await (await json(cookie, "/api/foods/log", { labelKey })).json()) as any;
    expect(entry).toMatchObject({
      label: "Greggs sausage roll (large)", kcal: 420, proteinG: 14,
      // Figures typed by hand are no longer an estimate.
      source: "manual",
    });
  });

  it("goes back to the logged figures after a reset", async () => {
    const cookie = await signUp();
    seedEntry({ label: "Porridge", kcal: 300, proteinG: 9 });
    const labelKey = normalizeLabel("Porridge");
    await json(cookie, "/api/foods/edit", { labelKey, label: "Porridge", kcal: 999, proteinG: 99 }, "PUT");
    await json(cookie, "/api/foods/edit/reset", { labelKey });

    const entry = (await (await json(cookie, "/api/foods/log", { labelKey })).json()) as any;
    expect(entry).toMatchObject({ kcal: 300, proteinG: 9, source: "ai" });
  });

  it("404s for a food that was never logged", async () => {
    const cookie = await signUp();
    expect((await json(cookie, "/api/foods/log", { labelKey: "nothing here" })).status).toBe(404);
  });
});
