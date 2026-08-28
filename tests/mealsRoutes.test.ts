import http from "node:http";
import express from "express";
import cookieParser from "cookie-parser";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  users: [] as any[],
  meals: [] as any[],
  mealItems: [] as any[],
  matchWeeks: [] as any[],
  entries: [] as any[],
  nextUserId: 1,
  nextMealId: 1,
  nextItemId: 1,
  nextEntryId: 1,
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

  /** Reattaches items to a meal the way Prisma's `include` would. */
  function hydrate(meal: any) {
    return { ...meal, items: state.mealItems.filter((i) => i.savedMealId === meal.id) };
  }

  function matchesMeal(meal: any, where: any = {}) {
    if (where.id !== undefined && meal.id !== where.id) return false;
    if (where.userId !== undefined && meal.userId !== where.userId) return false;
    if (where.name !== undefined && meal.name !== where.name) return false;
    return true;
  }

  const settingStore = new Map<string, string>();

  const prisma: any = {
    user: {
      findUnique: vi.fn(async ({ where }: any) => findUser(where)),
      findUniqueOrThrow: vi.fn(async ({ where }: any) => {
        const user = findUser(where);
        if (!user) throw new Error("No user");
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
      upsert: vi.fn(async ({ where, create }: any) => {
        const key = where.userId_startsAt_endsAt;
        const existing = state.matchWeeks.find(
          (w) =>
            w.userId === key.userId &&
            w.startsAt.getTime() === key.startsAt.getTime() &&
            w.endsAt.getTime() === key.endsAt.getTime(),
        );
        if (existing) return existing;
        const week = { id: state.matchWeeks.length + 1, ...create };
        state.matchWeeks.push(week);
        return week;
      }),
    },
    entry: {
      findMany: vi.fn(async ({ where }: any) => {
        const ids: number[] | undefined = where?.id?.in;
        return state.entries.filter((e) => (ids ? ids.includes(e.id) : true));
      }),
      create: vi.fn(async ({ data }: any) => {
        const entry = { id: state.nextEntryId++, createdAt: new Date(), updatedAt: new Date(), ...data };
        state.entries.push(entry);
        return entry;
      }),
    },
    savedMeal: {
      findMany: vi.fn(async ({ where }: any) =>
        state.meals.filter((m) => matchesMeal(m, where)).map(hydrate),
      ),
      findFirst: vi.fn(async ({ where }: any) => {
        const meal = state.meals.find((m) => matchesMeal(m, where));
        return meal ? hydrate(meal) : null;
      }),
      create: vi.fn(async ({ data }: any) => {
        const { items, ...rest } = data;
        const meal = { id: state.nextMealId++, createdAt: new Date(), updatedAt: new Date(), ...rest };
        state.meals.push(meal);
        for (const item of items?.create ?? []) {
          state.mealItems.push({ id: state.nextItemId++, savedMealId: meal.id, ...item });
        }
        return hydrate(meal);
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const meal = state.meals.find((m) => m.id === where.id);
        const { items, ...rest } = data;
        Object.assign(meal, rest, { updatedAt: new Date() });
        for (const item of items?.create ?? []) {
          state.mealItems.push({ id: state.nextItemId++, savedMealId: meal.id, ...item });
        }
        return hydrate(meal);
      }),
      delete: vi.fn(async ({ where }: any) => {
        state.meals = state.meals.filter((m) => m.id !== where.id);
        state.mealItems = state.mealItems.filter((i) => i.savedMealId !== where.id);
        return { id: where.id };
      }),
    },
    savedMealItem: {
      deleteMany: vi.fn(async ({ where }: any) => {
        const before = state.mealItems.length;
        state.mealItems = state.mealItems.filter((i) => i.savedMealId !== where.savedMealId);
        return { count: before - state.mealItems.length };
      }),
      createMany: vi.fn(async ({ data }: any) => {
        for (const item of data) state.mealItems.push({ id: state.nextItemId++, ...item });
        return { count: data.length };
      }),
    },
    $transaction: vi.fn(async (arg: any) =>
      typeof arg === "function" ? arg(prisma) : Promise.all(arg),
    ),
  };

  return { prisma };
});

import { authRouter } from "../src/routes/auth";
import { mealsRouter } from "../src/routes/meals";

let server: http.Server;
let baseUrl: string;

beforeEach(async () => {
  state.users.length = 0;
  state.meals.length = 0;
  state.mealItems.length = 0;
  state.matchWeeks.length = 0;
  state.entries.length = 0;
  state.nextUserId = 1;
  state.nextMealId = 1;
  state.nextItemId = 1;
  state.nextEntryId = 1;
  vi.clearAllMocks();

  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use("/api/auth", authRouter);
  app.use("/api/meals", mealsRouter);

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

/** Saved-meal shape as the router presents it (see `present` in meals.ts). */
type MealBody = {
  id: number;
  name: string;
  kind: string;
  servings: number;
  items: { id: number; label: string; kcal: number | null }[];
  totalKcal: number | null;
  kcalPerServing: number | null;
};
type EntryBody = { id: number; label: string; kcal: number | null; source: string };

/** res.json() is `unknown` under this tsconfig, so every read is narrowed here. */
async function jsonOf<T>(res: Response): Promise<T> {
  return (await res.json()) as T;
}

function post(path: string, cookie: string, body: unknown) {
  return fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify(body),
  });
}

const BREAKFAST = {
  name: "Usual breakfast",
  items: [
    { label: "Porridge", kcal: 220 },
    { label: "Banana", kcal: 95 },
  ],
};

describe("POST /api/meals", () => {
  it("rejects an unauthenticated request", async () => {
    const res = await fetch(`${baseUrl}/api/meals`, { method: "POST" });
    expect(res.status).toBe(401);
  });

  it("totals the items it was given", async () => {
    const cookie = await signUp("alice");
    const res = await post("/api/meals", cookie, BREAKFAST);
    expect(res.status).toBe(201);
    const meal = await jsonOf<MealBody>(res);
    expect(meal.totalKcal).toBe(315);
    expect(meal.kcalPerServing).toBe(315);
    expect(meal.items).toHaveLength(2);
  });

  it("reports no total at all when an item has no calories", async () => {
    const cookie = await signUp("alice");
    const res = await post("/api/meals", cookie, {
      name: "Half known",
      items: [{ label: "Porridge", kcal: 220 }, { label: "Mystery jam", kcal: null }],
    });
    const meal = await jsonOf<MealBody>(res);
    // Better to say nothing than to quietly report 220 for a meal that
    // contains something uncosted.
    expect(meal.totalKcal).toBeNull();
    expect(meal.kcalPerServing).toBeNull();
  });

  it("divides a recipe's total by the portions it makes", async () => {
    const cookie = await signUp("alice");
    const res = await post("/api/meals", cookie, {
      name: "Chilli",
      kind: "recipe",
      servings: 6,
      items: [{ label: "Mince", kcal: 1400 }, { label: "Beans and rice", kcal: 1000 }],
    });
    const meal = await jsonOf<MealBody>(res);
    expect(meal.totalKcal).toBe(2400);
    expect(meal.kcalPerServing).toBe(400);
  });

  it("forces a one-sitting meal to a single serving", async () => {
    const cookie = await signUp("alice");
    const res = await post("/api/meals", cookie, { ...BREAKFAST, servings: 8 });
    const meal = await jsonOf<MealBody>(res);
    expect(meal.servings).toBe(1);
  });

  it("refuses a duplicate name rather than creating a second copy", async () => {
    const cookie = await signUp("alice");
    await post("/api/meals", cookie, BREAKFAST);
    const res = await post("/api/meals", cookie, BREAKFAST);
    expect(res.status).toBe(409);
  });
});

describe("POST /api/meals/:id/log", () => {
  it("writes one entry per item for a meal", async () => {
    const cookie = await signUp("alice");
    const meal = await jsonOf<MealBody>(
      await post("/api/meals", cookie, BREAKFAST),
    );

    const res = await post(`/api/meals/${meal.id}/log`, cookie, {});
    expect(res.status).toBe(201);
    const entries = await jsonOf<EntryBody[]>(res);
    expect(entries).toHaveLength(2);
    expect(entries.map((e: any) => e.kcal)).toEqual([220, 95]);
    expect(entries.every((e: any) => e.source === "meal")).toBe(true);
  });

  it("scales every item when a meal is eaten more than once", async () => {
    const cookie = await signUp("alice");
    const meal = await jsonOf<MealBody>(
      await post("/api/meals", cookie, BREAKFAST),
    );

    const entries = await jsonOf<EntryBody[]>(await post(`/api/meals/${meal.id}/log`, cookie, { servings: 2 }));
    expect(entries.map((e: any) => e.kcal)).toEqual([440, 190]);
    expect(entries[0]!.label).toContain("x2");
  });

  it("collapses a recipe to one entry for the portion eaten", async () => {
    const cookie = await signUp("alice");
    const meal = await jsonOf<MealBody>(
      await post("/api/meals", cookie, {
        name: "Chilli",
        kind: "recipe",
        servings: 6,
        items: [{ label: "Mince", kcal: 1400 }, { label: "Beans and rice", kcal: 1000 }],
      })
    );

    const entries = await jsonOf<EntryBody[]>(await post(`/api/meals/${meal.id}/log`, cookie, { servings: 2 }));
    expect(entries).toHaveLength(1);
    expect(entries[0]!.kcal).toBe(800);
    expect(entries[0]!.label).toBe("Chilli (2 portions)");
  });

  it("leaves the calories unknown when the recipe's own total is", async () => {
    const cookie = await signUp("alice");
    const meal = await jsonOf<MealBody>(
      await post("/api/meals", cookie, {
        name: "Stew",
        kind: "recipe",
        servings: 4,
        items: [{ label: "Beef", kcal: 900 }, { label: "Whatever was left", kcal: null }],
      })
    );

    const entries = await jsonOf<EntryBody[]>(await post(`/api/meals/${meal.id}/log`, cookie, { servings: 1 }));
    expect(entries[0]!.kcal).toBeNull();
  });

  it("won't log another user's meal", async () => {
    const aliceCookie = await signUp("alice");
    const meal = await jsonOf<MealBody>(
      await post("/api/meals", aliceCookie, BREAKFAST),
    );

    const bobCookie = await signUp("bob");
    const res = await post(`/api/meals/${meal.id}/log`, bobCookie, {});
    expect(res.status).toBe(404);
  });
});

describe("POST /api/meals/from-entries", () => {
  it("builds a saved meal out of entries already logged", async () => {
    const cookie = await signUp("alice");
    state.entries.push(
      { id: 1, label: "Chicken salad", kcal: 400, timestamp: new Date("2026-01-01T12:00:00Z") },
      { id: 2, label: "Flapjack", kcal: 260, timestamp: new Date("2026-01-01T12:05:00Z") },
    );
    state.nextEntryId = 3;

    const res = await post("/api/meals/from-entries", cookie, {
      name: "Work lunch",
      entryIds: [1, 2],
    });
    expect(res.status).toBe(201);
    const meal = await jsonOf<MealBody>(res);
    expect(meal.items.map((i: any) => i.label)).toEqual(["Chicken salad", "Flapjack"]);
    expect(meal.totalKcal).toBe(660);
  });
});

describe("PATCH /api/meals/:id", () => {
  it("replaces the item list wholesale rather than merging it", async () => {
    const cookie = await signUp("alice");
    const meal = await jsonOf<MealBody>(
      await post("/api/meals", cookie, BREAKFAST),
    );

    const res = await fetch(`${baseUrl}/api/meals/${meal.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ items: [{ label: "Just toast", kcal: 180 }] }),
    });
    const updated = await jsonOf<MealBody>(res);
    expect(updated.items).toHaveLength(1);
    expect(updated.totalKcal).toBe(180);
  });

  it("resets servings to 1 when a recipe is turned back into a meal", async () => {
    const cookie = await signUp("alice");
    const meal = await jsonOf<MealBody>(
      await post("/api/meals", cookie, {
        name: "Chilli",
        kind: "recipe",
        servings: 6,
        items: [{ label: "Mince", kcal: 1400 }],
      })
    );

    const res = await fetch(`${baseUrl}/api/meals/${meal.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ kind: "template" }),
    });
    const updated = await jsonOf<MealBody>(res);
    expect(updated.servings).toBe(1);
    expect(updated.kcalPerServing).toBe(1400);
  });
});
