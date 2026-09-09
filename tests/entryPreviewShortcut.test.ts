import http from "node:http";
import express from "express";
import cookieParser from "cookie-parser";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The point of the shortcut is money, so the assertion that matters is not
 * "the right figures came back" — the unit tests cover that — but "the model
 * was never asked". Every test here checks the call count on estimateMeal.
 */

const state = vi.hoisted(() => ({
  users: [] as any[],
  library: [] as any[],
  products: [] as any[],
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
      create: vi.fn(async ({ data }: any) => {
        const user = { id: state.nextId++, weekStartWeekday: 0, weekStartHour: 17, weekStartMinute: 0, sessionsValidFrom: null, ...data };
        state.users.push(user);
        return user;
      }),
      count: vi.fn(async () => state.users.length),
    },
    setting: { upsert: vi.fn(async ({ where, create }: any) => ({ key: where.key, value: create.value })) },
    matchWeek: { updateMany: vi.fn(async () => ({ count: 0 })) },
    $transaction: vi.fn(async (arg: any) => (Array.isArray(arg) ? Promise.all(arg) : arg(prisma))),
  };
  return { prisma };
});

vi.mock("../src/foodLibrary", () => ({ loadLibrary: vi.fn(async () => state.library) }));

vi.mock("../src/estimateGrounding", () => ({
  findGroundingResults: vi.fn(async () => state.products),
  findReferences: vi.fn(async () => []),
  toReferences: vi.fn(() => []),
}));

vi.mock("../src/estimate", () => ({
  estimateMeal: vi.fn(async () => [{
    label: "guessed", kcal: 999, proteinG: null, carbsG: null, fatG: null,
    fibreG: null, sugarG: null, satFatG: null, saltG: null,
  }]),
}));

import { authRouter } from "../src/routes/auth";
import { entriesRouter } from "../src/routes/entries";
import { estimateMeal } from "../src/estimate";

let server: http.Server;
let baseUrl: string;

beforeEach(async () => {
  state.users.length = 0;
  state.library.length = 0;
  state.products.length = 0;
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

async function preview(cookie: string, text: string) {
  const form = new FormData();
  form.set("text", text);
  const res = await fetch(`${baseUrl}/api/entries/preview`, { method: "POST", headers: { Cookie: cookie }, body: form });
  return { status: res.status, body: (await res.json()) as any };
}

describe("POST /api/entries/preview — the model is a last resort", () => {
  it("answers from their own diary without calling the model", async () => {
    const cookie = await signUp();
    state.library.push({
      label: "Chicken and rice", kcal: 620, proteinG: 50, carbsG: 60, fatG: 15,
      fibreG: null, sugarG: null, satFatG: null, saltG: null, count: 5,
    });

    const { status, body } = await preview(cookie, "chicken and rice");

    expect(status).toBe(200);
    expect(body.items[0]).toMatchObject({ label: "Chicken and rice", kcal: 620 });
    expect(body.from).toBe("library");
    // Their own past entry was itself an estimate — answering from it again
    // must not upgrade it to a verified figure.
    expect(body.source).toBe("ai");
    expect(estimateMeal).not.toHaveBeenCalled();
  });

  it("answers from a matched product without calling the model", async () => {
    const cookie = await signUp();
    state.products.push({
      id: "p1", source: "off", kind: "restaurant", name: "Big Mac", brand: "McDonald's",
      barcode: null, per100g: null, servingGrams: null, servingLabel: null, servingUnit: "burger",
      portion: { label: "1 burger", kcal: 493, protein: 26, carbs: 44, fat: 24 },
      labelKey: null, timesLogged: 0,
    });

    const { body } = await preview(cookie, "big mac");

    expect(body.items[0]).toMatchObject({ label: "McDonald's Big Mac", kcal: 493 });
    expect(body.source).toBe("database");
    expect(body.from).toBe("database");
    expect(estimateMeal).not.toHaveBeenCalled();
  });

  it("prefers their own diary over a product of the same name", async () => {
    const cookie = await signUp();
    state.library.push({
      label: "Big Mac", kcal: 520, proteinG: 26, carbsG: 44, fatG: 24,
      fibreG: null, sugarG: null, satFatG: null, saltG: null, count: 2,
    });
    state.products.push({
      id: "p1", source: "off", kind: "restaurant", name: "Big Mac", brand: null,
      barcode: null, per100g: null, servingGrams: null, servingLabel: null, servingUnit: null,
      portion: { label: "1 burger", kcal: 493, protein: 26, carbs: 44, fat: 24 },
      labelKey: null, timesLogged: 0,
    });

    const { body } = await preview(cookie, "big mac");

    expect(body.items[0].kcal).toBe(520);
    expect(body.from).toBe("library");
  });

  it("falls back to the model when nothing is certain", async () => {
    const cookie = await signUp();
    state.library.push({
      label: "Chicken and rice", kcal: 620, proteinG: null, carbsG: null, fatG: null,
      fibreG: null, sugarG: null, satFatG: null, saltG: null, count: 5,
    });

    const { body } = await preview(cookie, "chicken stir fry with a naan");

    expect(body.items[0].kcal).toBe(999);
    expect(body.source).toBe("ai");
    expect(body.from).toBeNull();
    expect(estimateMeal).toHaveBeenCalledTimes(1);
  });
});
