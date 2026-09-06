import http from "node:http";
import express from "express";
import cookieParser from "cookie-parser";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Logging is now two steps: /preview estimates and saves nothing, /confirm
 * writes exactly what was approved. The split is the whole point — a preview
 * must never reach the diary, and a confirm must never re-estimate — so both
 * halves of that are asserted here.
 */
const TIMEZONE = "Europe/London";

const state = vi.hoisted(() => ({
  users: [] as any[],
  weeks: [] as any[],
  entries: [] as any[],
  nextId: 1,
  estimateCalls: 0,
}));

vi.mock("../src/config", () => ({
  config: { TIMEZONE: "Europe/London", GOOGLE_SIGNIN_CLIENT_ID: undefined },
}));

vi.mock("../src/estimate", () => ({
  estimateMeal: vi.fn(async () => {
    state.estimateCalls += 1;
    return [{ label: "porridge", kcal: 320, proteinG: 11, carbsG: 54, fatG: 6, quantity: 1 }];
  }),
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
      create: vi.fn(async ({ data }: any) => {
        const entry = { id: state.nextId++, ...data };
        state.entries.push(entry);
        return entry;
      }),
      findMany: vi.fn(async ({ where }: any) => {
        const ids: number[] | undefined = where?.id?.in;
        const userId = where?.matchWeek?.userId;
        return state.entries.filter(
          (e: any) =>
            (ids ? ids.includes(e.id) : true)
            && (userId === undefined || e.userId === userId),
        );
      }),
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
  state.estimateCalls = 0;
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

function preview(cookie: string, text: string) {
  const body = new FormData();
  body.append("text", text);
  return fetch(`${baseUrl}/api/entries/preview`, { method: "POST", headers: { Cookie: cookie }, body });
}

function confirm(cookie: string, payload: unknown) {
  return fetch(`${baseUrl}/api/entries/confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify(payload),
  });
}

describe("POST /api/entries/preview", () => {
  it("rejects an unauthenticated request", async () => {
    expect((await preview("", "porridge")).status).toBe(401);
  });

  it("needs something to estimate from", async () => {
    const cookie = await signUp();
    const res = await fetch(`${baseUrl}/api/entries/preview`, {
      method: "POST",
      headers: { Cookie: cookie },
      body: new FormData(),
    });
    expect(res.status).toBe(400);
  });

  it("returns an estimate without writing anything to the diary", async () => {
    const cookie = await signUp();
    const res = await preview(cookie, "bowl of porridge");
    expect(res.status).toBe(200);

    const body = (await res.json()) as any;
    expect(body.items).toHaveLength(1);
    expect(body.items[0]).toMatchObject({ label: "porridge", kcal: 320 });
    expect(body.rawInput).toBe("bowl of porridge");
    // The whole point of the split: nothing is saved until it is confirmed.
    expect(state.entries).toHaveLength(0);
  });
});

describe("POST /api/entries/repeat", () => {
  function repeat(cookie: string, body: unknown) {
    return fetch(`${baseUrl}/api/entries/repeat`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
      body: JSON.stringify(body),
    });
  }

  /** A meal already in the diary: two rows sharing one group. */
  function loggedMeal(userId: number) {
    state.entries.push(
      {
        id: 901, userId, label: "Bacon medallion", kcal: 45, quantity: 1, unitLabel: null,
        proteinG: 6, carbsG: 0, fatG: 2, fibreG: null, sugarG: null, satFatG: null, saltG: null,
        imageUrl: null, mealType: "breakfast", mealTypeSet: true, source: "meal",
        mealGroupId: "g1", mealGroupName: "Usual breakfast", timestamp: new Date("2026-01-01T07:40:00Z"),
      },
      {
        id: 902, userId, label: "Fried egg", kcal: 90, quantity: 1, unitLabel: null,
        proteinG: 6, carbsG: 1, fatG: 7, fibreG: null, sugarG: null, satFatG: null, saltG: null,
        imageUrl: null, mealType: "breakfast", mealTypeSet: true, source: "meal",
        mealGroupId: "g1", mealGroupName: "Usual breakfast", timestamp: new Date("2026-01-01T07:41:00Z"),
      },
    );
  }

  it("rejects an unauthenticated request", async () => {
    expect((await repeat("", { ids: [1] })).status).toBe(401);
  });

  it("copies every row of the meal onto today", async () => {
    const cookie = await signUp();
    loggedMeal(1);

    const res = await repeat(cookie, { ids: [901, 902] });
    expect(res.status).toBe(201);
    const created = (await res.json()) as any[];
    expect(created.map((e) => e.label)).toEqual(["Bacon medallion", "Fried egg"]);
    // Copies, not moves: the originals are still where they were logged.
    expect(state.entries.filter((e: any) => e.id === 901 || e.id === 902)).toHaveLength(2);
  });

  it("keeps them one meal rather than four loose rows arriving at once", async () => {
    const cookie = await signUp();
    loggedMeal(1);

    const created = (await (await repeat(cookie, { ids: [901, 902] })).json()) as any[];
    const groups = new Set(created.map((e) => e.mealGroupId));
    expect(groups.size).toBe(1);
    expect([...groups][0]).toBeTruthy();
    // A fresh id, not the original's — this is a new meal on a new day.
    expect([...groups][0]).not.toBe("g1");
    expect(created.every((e) => e.mealGroupName === "Usual breakfast")).toBe(true);
  });

  it("leaves a single entry ungrouped", async () => {
    const cookie = await signUp();
    loggedMeal(1);

    const created = (await (await repeat(cookie, { ids: [901] })).json()) as any[];
    expect(created[0]!.mealGroupId).toBeNull();
  });

  it("carries the whole label across, not just the calories", async () => {
    const cookie = await signUp();
    loggedMeal(1);

    const created = (await (await repeat(cookie, { ids: [901] })).json()) as any[];
    expect(created[0]).toMatchObject({ kcal: 45, proteinG: 6, carbsG: 0, fatG: 2, source: "meal" });
  });

  it("keeps a meal tag the user chose", async () => {
    const cookie = await signUp();
    loggedMeal(1);

    const created = (await (await repeat(cookie, { ids: [901] })).json()) as any[];
    expect(created[0]).toMatchObject({ mealType: "breakfast", mealTypeSet: true });
  });

  it("cannot be pointed at somebody else's entries", async () => {
    // The ids are sequential and guessable, so scoping is the only thing
    // stopping a repeat being built out of another person's diary.
    const cookie = await signUp();
    loggedMeal(999);

    expect((await repeat(cookie, { ids: [901, 902] })).status).toBe(404);
  });

  it("refuses an empty list", async () => {
    const cookie = await signUp();
    expect((await repeat(cookie, { ids: [] })).status).toBe(400);
  });
});

describe("POST /api/entries/confirm", () => {
  it("rejects an unauthenticated request", async () => {
    expect((await confirm("", { items: [{ label: "x", kcal: 1 }] })).status).toBe(401);
  });

  it("writes exactly what was approved, without re-estimating", async () => {
    const cookie = await signUp();
    const res = await confirm(cookie, {
      // Deliberately different from what the estimator returns, standing in
      // for figures the user corrected in the sheet.
      items: [{ label: "porridge with honey", kcal: 410, proteinG: 12, carbsG: 70, fatG: 7 }],
      rawInput: "bowl of porridge",
      source: "ai",
    });
    expect(res.status).toBe(201);

    expect(state.estimateCalls).toBe(0);
    expect(state.entries).toHaveLength(1);
    expect(state.entries[0]).toMatchObject({
      label: "porridge with honey",
      kcal: 410,
      proteinG: 12,
      carbsG: 70,
      fatG: 7,
      rawInput: "bowl of porridge",
      source: "ai",
    });
  });

  it("keeps the unit an amount was measured in", async () => {
    // Without this the diary stores a number with nothing attached, and the
    // only thing the edit form can honestly offer is a multiplier.
    const cookie = await signUp();
    await confirm(cookie, {
      items: [{ label: "Seeded sourdough", kcal: 220, quantity: 2, unitLabel: "slice" }],
      source: "database",
    });

    expect(state.entries[0]).toMatchObject({ quantity: 2, unitLabel: "slice" });
  });

  it("takes a serving in grams, which runs well past a count of slices", async () => {
    const cookie = await signUp();
    const res = await confirm(cookie, {
      items: [{ label: "Porridge oats", kcal: 380, quantity: 100, unitLabel: "g" }],
      source: "database",
    });

    expect(res.status).toBe(201);
    expect(state.entries[0]).toMatchObject({ quantity: 100, unitLabel: "g" });
  });

  it("leaves an entry with no named unit as a plain multiple", async () => {
    // Which is every estimate: the model is guessing at a plate of food, not
    // reading a serving off a packet.
    const cookie = await signUp();
    await confirm(cookie, { items: [{ label: "Chilli", kcal: 600 }] });

    expect(state.entries[0]).toMatchObject({ quantity: 1, unitLabel: null });
  });

  it("saves every item in a multi-item meal", async () => {
    const cookie = await signUp();
    await confirm(cookie, {
      items: [
        { label: "chicken", kcal: 300 },
        { label: "rice", kcal: 220 },
        { label: "broccoli", kcal: 40 },
      ],
    });
    expect(state.entries.map((e) => e.label)).toEqual(["chicken", "rice", "broccoli"]);
  });

  it("keeps a null calorie figure rather than turning it into a zero", async () => {
    const cookie = await signUp();
    await confirm(cookie, { items: [{ label: "mystery pastry", kcal: null }] });
    expect(state.entries[0].kcal).toBeNull();
  });

  it("records a packet lookup as a database figure", async () => {
    const cookie = await signUp();
    await confirm(cookie, { items: [{ label: "Oatly barista", kcal: 120 }], source: "database" });
    expect(state.entries[0].source).toBe("database");
  });

  it("refuses an empty item list", async () => {
    const cookie = await signUp();
    expect((await confirm(cookie, { items: [] })).status).toBe(400);
  });

  it("refuses an item with no label", async () => {
    const cookie = await signUp();
    expect((await confirm(cookie, { items: [{ label: "   ", kcal: 100 }] })).status).toBe(400);
  });

  it("ignores an image URL pointing outside the uploads directory", async () => {
    const cookie = await signUp();
    await confirm(cookie, {
      items: [{ label: "toast", kcal: 200 }],
      imageUrl: "/uploads/../../etc/passwd",
    });
    expect(state.entries[0].imageUrl).toBeNull();
  });

  it("back-dates a last-week entry to just before the rollover", async () => {
    const cookie = await signUp();
    await confirm(cookie, { items: [{ label: "late curry", kcal: 800 }], lastWeek: true });

    // The rollover for this account is 17:00 local, and the entry is pinned a
    // minute the other side of it so it files into the week that was running.
    const local = new Intl.DateTimeFormat("en-GB", {
      timeZone: TIMEZONE,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(state.entries[0].timestamp);
    expect(local).toBe("16:59");
  });
});
