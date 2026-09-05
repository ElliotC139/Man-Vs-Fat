import http from "node:http";
import express from "express";
import cookieParser from "cookie-parser";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The wiring: which sources get asked, what happens when one of them falls
 * over, and that the user's own diary is searched alongside them. What each
 * database's payload turns into is covered in foodSearch.test.ts.
 */
const state = vi.hoisted(() => ({
  users: [] as any[],
  entries: [] as any[],
  overrides: [] as any[],
  off: [] as any[],
  nutritionix: [] as any[],
  usda: [] as any[],
  offCalls: 0,
  offThrows: false,
  barcodeCalls: 0,
  barcodeProduct: null as any,
  nextId: 1,
}));

vi.mock("../src/config", () => ({
  config: { TIMEZONE: "Europe/London", GOOGLE_SIGNIN_CLIENT_ID: undefined },
}));

// The fan-out across sources lives in the providers module now, because the
// search box is no longer its only caller — estimating a typed meal grounds
// itself in the same rows. The mock reproduces its one guarantee, that a
// source which throws drops out and the rest still answer, so the route tests
// below still exercise what the route itself does: cache, filter and rank.
vi.mock("../src/foodSearchProviders", () => {
  const searchOpenFoodFacts = vi.fn(async () => {
    state.offCalls += 1;
    if (state.offThrows) throw new Error("Open Food Facts is down");
    return state.off;
  });
  const searchNutritionix = vi.fn(async () => state.nutritionix);
  const searchUsda = vi.fn(async () => state.usda);

  return {
    configuredSources: () => ({ menus: true, ingredients: true }),
    searchOpenFoodFacts,
    searchNutritionix,
    searchUsda,
    searchAllProviders: vi.fn(async (query: string) => {
      const groups = await Promise.allSettled([
        searchOpenFoodFacts(query),
        searchNutritionix(query),
        searchUsda(query),
      ]);
      return groups.flatMap((group) => (group.status === "fulfilled" ? group.value : []));
    }),
    lookupBarcode: vi.fn(async () => {
      state.barcodeCalls += 1;
      return state.barcodeProduct;
    }),
  };
});

vi.mock("../src/db", () => {
  const prisma: any = {
    user: {
      findUnique: vi.fn(async ({ where }: any) =>
        state.users.find((u) => (where.id !== undefined ? u.id === where.id : u.username === where.username)) ?? null,
      ),
      create: vi.fn(async ({ data }: any) => {
        const user = { id: state.nextId++, sessionsValidFrom: null, ...data };
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
    matchWeek: { updateMany: vi.fn(async () => ({ count: 0 })) },
    setting: { upsert: vi.fn(async ({ where, create }: any) => ({ key: where.key, value: create.value })) },
    entry: { findMany: vi.fn(async () => state.entries) },
    foodOverride: { findMany: vi.fn(async () => state.overrides) },
    $transaction: vi.fn(async (arg: any) => (Array.isArray(arg) ? Promise.all(arg) : arg(prisma))),
  };
  return { prisma };
});

import { authRouter } from "../src/routes/auth";
import { foodSearchRouter } from "../src/routes/foodSearch";
import { cacheClear } from "../src/foodSearch";

let server: http.Server;
let baseUrl: string;

function remote(partial: Record<string, unknown>) {
  return {
    id: "x",
    source: "off",
    kind: "branded",
    name: "Thing",
    brand: null,
    barcode: null,
    per100g: { kcal: 100, protein: 1, carbs: 1, fat: 1 },
    servingGrams: null,
    portion: null,
    labelKey: null,
    timesLogged: 0,
    ...partial,
  };
}

beforeEach(async () => {
  for (const key of ["users", "entries", "overrides", "off", "nutritionix", "usda"] as const) state[key].length = 0;
  state.offCalls = 0;
  state.barcodeCalls = 0;
  state.offThrows = false;
  state.barcodeProduct = null;
  state.nextId = 1;
  cacheClear();
  vi.clearAllMocks();

  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use("/api/auth", authRouter);
  app.use("/api/food-search", foodSearchRouter);
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

function logged(label: string, kcal: number | null) {
  state.entries.push({ label, kcal, proteinG: null, carbsG: null, fatG: null, timestamp: new Date() });
}

function search(cookie: string, query: string, extra = "") {
  return fetch(`${baseUrl}/api/food-search?q=${encodeURIComponent(query)}${extra}`, { headers: { Cookie: cookie } });
}

describe("GET /api/food-search", () => {
  it("rejects an unauthenticated request", async () => {
    expect((await search("", "hobnobs")).status).toBe(401);
  });

  it("doesn't go anywhere near a database for one letter", async () => {
    const cookie = await signUp();
    const body = (await (await search(cookie, "h")).json()) as any;
    expect(body.results).toEqual([]);
    expect(state.offCalls).toBe(0);
  });

  it("merges every source into one list", async () => {
    const cookie = await signUp();
    logged("Hobnob stack", 250);
    state.off.push(remote({ id: "off", name: "Hobnobs", source: "off" }));
    state.nutritionix.push(remote({ id: "nix", name: "Hobnob McFlurry", source: "nutritionix", kind: "restaurant" }));
    state.usda.push(remote({ id: "usda", name: "Hobnob biscuit", source: "usda", kind: "generic" }));

    const body = (await (await search(cookie, "hobnob")).json()) as any;
    expect(new Set(body.results.map((r: any) => r.source))).toEqual(
      new Set(["library", "off", "nutritionix", "usda"]),
    );
  });

  it("puts their own food first", async () => {
    const cookie = await signUp();
    logged("Greek yoghurt", 150);
    state.off.push(remote({ id: "off", name: "Greek Yoghurt" }));

    const body = (await (await search(cookie, "greek yoghurt")).json()) as any;
    expect(body.results[0]).toMatchObject({ kind: "yours", labelKey: "greek yoghurt", portion: { kcal: 150 } });
  });

  it("still answers when a source falls over", async () => {
    const cookie = await signUp();
    state.offThrows = true;
    state.nutritionix.push(remote({ id: "nix", name: "Big Mac", source: "nutritionix", kind: "restaurant" }));

    const res = await search(cookie, "big mac");
    expect(res.status).toBe(200);
    expect(((await res.json()) as any).results).toHaveLength(1);
  });

  it("narrows to one kind when asked", async () => {
    const cookie = await signUp();
    logged("Burger night", 900);
    state.off.push(remote({ id: "off", name: "Burger sauce" }));
    state.nutritionix.push(remote({ id: "nix", name: "Big Mac", source: "nutritionix", kind: "restaurant" }));

    const body = (await (await search(cookie, "burger", "&kind=restaurant")).json()) as any;
    expect(body.results.map((r: any) => r.name)).toEqual(["Big Mac"]);
  });

  it("asks the databases once for the same words", async () => {
    const cookie = await signUp();
    state.off.push(remote({ id: "off", name: "Hobnobs" }));
    await search(cookie, "hobnobs");
    await search(cookie, "Hobnobs");
    expect(state.offCalls).toBe(1);
  });

  it("says which sources this deployment can actually reach", async () => {
    const cookie = await signUp();
    const body = (await (await search(cookie, "hobnobs")).json()) as any;
    expect(body.sources).toEqual({ menus: true, ingredients: true });
  });

  it("applies a correction to their own food, as the library does", async () => {
    const cookie = await signUp();
    logged("Sausage roll", 200);
    state.overrides.push({ labelKey: "roll sausage", label: "Greggs sausage roll", kcal: 327, proteinG: 9, carbsG: 25, fatG: 22 });

    const body = (await (await search(cookie, "sausage")).json()) as any;
    expect(body.results[0]).toMatchObject({ name: "Greggs sausage roll", portion: { kcal: 327 } });
  });
});

describe("GET /api/food-search/barcode/:code", () => {
  function barcode(cookie: string, code: string) {
    return fetch(`${baseUrl}/api/food-search/barcode/${code}`, { headers: { Cookie: cookie } });
  }

  it("rejects something that isn't a barcode", async () => {
    const cookie = await signUp();
    expect((await barcode(cookie, "12")).status).toBe(400);
  });

  it("returns the product it found", async () => {
    const cookie = await signUp();
    state.barcodeProduct = remote({ id: "off:5000168001678", name: "Hobnobs", barcode: "5000168001678" });
    const body = (await (await barcode(cookie, "5000168001678")).json()) as any;
    expect(body.product).toMatchObject({ name: "Hobnobs" });
  });

  it("asks once, then remembers — including that nobody has heard of it", async () => {
    const cookie = await signUp();
    state.barcodeProduct = null;
    expect(((await (await barcode(cookie, "0000000000000")).json()) as any).product).toBeNull();
    await barcode(cookie, "0000000000000");
    expect(state.barcodeCalls).toBe(1);
  });
});
