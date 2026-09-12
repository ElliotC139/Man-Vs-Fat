import http from "node:http";
import express from "express";
import cookieParser from "cookie-parser";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The operator's screen. Two things matter more than the figures on it: that
 * nobody else can reach it, and that nobody can lock themselves out of it.
 */

const state = vi.hoisted(() => ({
  users: [] as any[],
  usage: [] as any[],
  settings: new Map<string, string>(),
  planOverrides: new Map<string, any>(),
  nextId: 1,
}));

vi.mock("../src/config", () => ({
  // reconcileAdmin and toPublicUser both read this on every sign-in.
  adminUsernames: [],
  config: {
    TIMEZONE: "Europe/London",
    GOOGLE_SIGNIN_CLIENT_ID: undefined,
    GBP_PER_USD: 0.8,
    ANTHROPIC_MODEL: "claude-sonnet-5",
    ANTHROPIC_MODEL_FREE: "claude-haiku-4-5",
  },
}));

vi.mock("../src/db", () => {
  const prisma: any = {
    user: {
      findUnique: vi.fn(async ({ where }: any) =>
        state.users.find((u) => (where.id !== undefined ? u.id === where.id : u.username === where.username)) ?? null),
      findMany: vi.fn(async () => [...state.users].sort((a, b) => a.id - b.id)),
      create: vi.fn(async ({ data }: any) => {
        const user = {
          id: state.nextId++, weekStartWeekday: 0, weekStartHour: 17, weekStartMinute: 0,
          sessionsValidFrom: null, plan: "free", isAdmin: false, createdAt: new Date(),
          email: null, subscriptionStatus: null, subscriptionEndsAt: null, ...data,
        };
        state.users.push(user);
        return user;
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const user = state.users.find((u) => u.id === where.id);
        Object.assign(user, data);
        return user;
      }),
      count: vi.fn(async () => state.users.length),
    },
    setting: {
      findUnique: vi.fn(async ({ where }: any) =>
        state.settings.has(where.key) ? { key: where.key, value: state.settings.get(where.key) } : null),
      upsert: vi.fn(async ({ where, create, update }: any) => {
        state.settings.set(where.key, (update?.value ?? create.value) as string);
        return { key: where.key, value: state.settings.get(where.key) };
      }),
    },
    matchWeek: { updateMany: vi.fn(async () => ({ count: 0 })) },
    planOverride: {
      findMany: vi.fn(async () => [...state.planOverrides.values()]),
      findUnique: vi.fn(async ({ where }: any) => state.planOverrides.get(where.id) ?? null),
      upsert: vi.fn(async ({ where, create, update }: any) => {
        const row = state.planOverrides.has(where.id)
          ? { ...state.planOverrides.get(where.id), ...update }
          : { ...create };
        state.planOverrides.set(where.id, row);
        return row;
      }),
      deleteMany: vi.fn(async ({ where }: any) => {
        const had = state.planOverrides.delete(where.id);
        return { count: had ? 1 : 0 };
      }),
    },
    aiUsage: {
      count: vi.fn(async () => state.usage.length),
      aggregate: vi.fn(async () => ({
        _sum: { costMicros: state.usage.reduce((s, u) => s + u.costMicros, 0) || null },
      })),
      groupBy: vi.fn(async () => {
        const by = new Map<number, { userId: number; _sum: any; _count: any }>();
        for (const row of state.usage) {
          const found = by.get(row.userId) ?? { userId: row.userId, _sum: { costMicros: 0 }, _count: { _all: 0 } };
          found._sum.costMicros += row.costMicros;
          found._count._all += 1;
          by.set(row.userId, found);
        }
        return [...by.values()];
      }),
    },
    $transaction: vi.fn(async (arg: any) => (Array.isArray(arg) ? Promise.all(arg) : arg(prisma))),
  };
  return { prisma };
});

import { authRouter } from "../src/routes/auth";
import { adminRouter, forgetSignupsSetting } from "../src/routes/admin";
import { basePlanFor, clearPlanLens, planFor, PLAN_IDS } from "../src/plans";
import { installPlanOverrides } from "../src/planOverrides";

let server: http.Server;
let baseUrl: string;

beforeEach(async () => {
  state.users.length = 0;
  state.usage.length = 0;
  state.settings.clear();
  state.planOverrides.clear();
  state.nextId = 1;
  // The tier grid is served through an in-memory cache of the override table,
  // so a fresh table needs the cache reading again — and the lens installing,
  // since nothing installs it in a test by default.
  await installPlanOverrides();
  // The setting is cached for half a minute in front of every sign-up; a
  // fresh table needs a fresh answer.
  forgetSignupsSetting();
  vi.clearAllMocks();

  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use("/api/auth", authRouter);
  app.use("/api/admin", adminRouter);
  server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  baseUrl = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
});
afterEach(async () => {
  await new Promise((resolve) => server.close(resolve));
  // Put planFor back to the plans as written, so a test that never touched
  // the tier grid isn't reading one this file left behind.
  clearPlanLens();
});

async function signUp(username: string): Promise<string> {
  const res = await fetch(`${baseUrl}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password: "password123" }),
  });
  const cookie = res.headers.getSetCookie().find((c) => c.startsWith("session="));
  return cookie ? cookie.split(";")[0]! : "";
}

const get = (path: string, cookie: string) =>
  fetch(`${baseUrl}/api/admin${path}`, { headers: { Cookie: cookie } });
const send = (path: string, cookie: string, body: unknown, method = "POST") =>
  fetch(`${baseUrl}/api/admin${path}`, {
    method, headers: { "Content-Type": "application/json", Cookie: cookie }, body: JSON.stringify(body),
  });

describe("who can reach the admin screen", () => {
  it("makes the first account an admin", async () => {
    const cookie = await signUp("alice");
    expect(state.users[0]!.isAdmin).toBe(true);
    expect((await get("/overview", cookie)).status).toBe(200);
  });

  it("does not make the second one", async () => {
    await signUp("alice");
    const bob = await signUp("bob");
    expect(state.users[1]!.isAdmin).toBe(false);
    // 404, not 403: a 403 confirms the screen exists and that this account
    // simply isn't allowed near it.
    expect((await get("/overview", bob)).status).toBe(404);
  });

  it("turns nobody away with no session", async () => {
    await signUp("alice");
    expect((await get("/overview", "")).status).toBe(401);
  });
});

describe("sign-ups", () => {
  it("are open until somebody closes them", async () => {
    const cookie = await signUp("alice");
    expect(((await (await get("/overview", cookie)).json()) as any).signupsOpen).toBe(true);

    await send("/signups", cookie, { open: false });
    const res = await fetch(`${baseUrl}/api/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "bob", password: "password123" }),
    });
    expect(res.status).toBe(403);
    expect(state.users).toHaveLength(1);
  });

  it("open again when told to", async () => {
    const cookie = await signUp("alice");
    await send("/signups", cookie, { open: false });
    await send("/signups", cookie, { open: true });
    expect(await signUp("bob")).not.toBe("");
    expect(state.users).toHaveLength(2);
  });
});

describe("changing an account", () => {
  it("moves someone between plans", async () => {
    const cookie = await signUp("alice");
    await signUp("bob");
    const res = await send(`/users/2`, cookie, { plan: "pro" }, "PATCH");
    expect(res.status).toBe(200);
    expect(state.users[1]!.plan).toBe("pro");
  });

  it("refuses a plan that doesn't exist", async () => {
    const cookie = await signUp("alice");
    await signUp("bob");
    expect((await send(`/users/2`, cookie, { plan: "enterprise" }, "PATCH")).status).toBe(400);
    expect(state.users[1]!.plan).toBe("free");
  });

  it("won't let an admin remove their own access", async () => {
    // The one change that can lock the operator out of their own app with no
    // way back in.
    const cookie = await signUp("alice");
    const res = await send(`/users/1`, cookie, { isAdmin: false }, "PATCH");
    expect(res.status).toBe(400);
    expect(state.users[0]!.isAdmin).toBe(true);
  });

  it("lets them grant it to somebody else, and take it back", async () => {
    const cookie = await signUp("alice");
    await signUp("bob");
    await send(`/users/2`, cookie, { isAdmin: true }, "PATCH");
    expect(state.users[1]!.isAdmin).toBe(true);
    await send(`/users/2`, cookie, { isAdmin: false }, "PATCH");
    expect(state.users[1]!.isAdmin).toBe(false);
  });
});

describe("the figures", () => {
  it("reports the month's spend against what the plans bring in", async () => {
    const cookie = await signUp("alice");
    await signUp("bob");
    state.users[1]!.plan = "pro";
    state.usage.push({ userId: 2, costMicros: 1_000_000 }, { userId: 2, costMicros: 500_000 });

    // Against the catalogue rather than a number typed in here: this test is
    // about the arithmetic — one Pro subscriber, £1.50 spent — and a price
    // change should move the deployment, not break the sums.
    const proPence = planFor("pro").pricePence;

    const body = (await (await get("/overview", cookie)).json()) as any;
    expect(body.month.calls).toBe(2);
    expect(body.month.cost).toBe("£1.50");
    expect(body.month.revenuePence).toBe(proPence);
    expect(body.month.marginPence).toBe(proPence - 150);
    expect(body.plans.find((p: any) => p.id === "pro").users).toBe(1);
  });

  it("flags an account sitting on its ceiling", async () => {
    const cookie = await signUp("alice");
    await signUp("bob");
    state.usage.push({ userId: 2, costMicros: 999_999 });

    const body = (await (await get("/overview", cookie)).json()) as any;
    const bob = body.users.find((u: any) => u.id === 2);
    expect(bob.atCap).toBe(true);
    expect(bob.monthCost).toBe("£1.00");
  });
});

/**
 * The tier editor.
 *
 * What is being protected here is not really the settings — it is the promise
 * underneath them. The monthly ceiling on what an account's AI calls may cost
 * is what makes "no plan costs more to serve than it brings in" true, and it
 * is deliberately not something this screen can move. Nor is the price, which
 * belongs to Stripe. So the last two tests below are the important ones:
 * whatever gets ticked, those two stay where the code put them.
 */
describe("editing what each tier includes", () => {
  async function asAdmin() {
    return signUp("operator");
  }

  const grid = async (cookie: string): Promise<any> => (await get("/plans", cookie)).json();
  const flag = (cookie: string, body: unknown) => send("/plans/flag", cookie, body, "PUT");

  it("is closed to everyone but an admin", async () => {
    const admin = await asAdmin();
    const other = await signUp("bob");

    expect((await get("/plans", other)).status).toBe(404);
    expect((await flag(other, { flag: "keto", plan: "free", enabled: true })).status).toBe(404);
    expect((await get("/plans", admin)).status).toBe(200);
  });

  it("shows every plan against every feature, and what the code says", async () => {
    const data: any = await grid(await asAdmin());

    expect(data.plans.map((p: any) => p.id)).toEqual([...PLAN_IDS]);
    for (const plan of data.plans) {
      const base = basePlanFor(plan.id);
      expect(plan.dailyEstimates).toBe(base.dailyEstimates);
      expect(plan.flags.keto).toEqual({ on: base.keto, default: base.keto });
      // Nothing has been changed yet, so nothing is marked as changed.
      expect(plan.edited).toBe(false);
    }
  });

  it("ticks every tier above the one tapped", async () => {
    const cookie = await asAdmin();
    const data: any = await (await flag(cookie, { flag: "recipeScan", plan: "free", enabled: true })).json();

    for (const plan of data.plans) expect(plan.flags.recipeScan.on).toBe(true);
  });

  it("unticks every tier below the one tapped", async () => {
    const cookie = await asAdmin();
    const data: any = await (await flag(cookie, { flag: "keto", plan: "pro", enabled: false })).json();

    for (const plan of data.plans) expect(plan.flags.keto.on).toBe(false);
  });

  it("changes what the app actually serves, not just what the screen shows", async () => {
    const cookie = await asAdmin();
    expect(planFor("free").keto).toBe(false);

    await flag(cookie, { flag: "keto", plan: "free", enabled: true });

    // planFor is what every gate in the app asks. If this didn't move, the
    // screen would be a set of switches wired to nothing.
    expect(planFor("free").keto).toBe(true);
  });

  it("marks what has been changed, so it can be changed back", async () => {
    const cookie = await asAdmin();
    await flag(cookie, { flag: "keto", plan: "free", enabled: true });

    const data: any = await grid(cookie);
    const free = data.plans.find((p: any) => p.id === "free");
    expect(free.edited).toBe(true);
    expect(free.flags.keto).toEqual({ on: true, default: false });

    const reset: any = await (await send("/plans/reset", cookie, {}, "POST")).json();
    expect(reset.plans.every((p: any) => !p.edited)).toBe(true);
    expect(planFor("free").keto).toBe(false);
  });

  it("moves an allowance and keeps the tiers climbing", async () => {
    const cookie = await asAdmin();
    const data: any = await (await send("/plans/estimates", cookie, { plan: "free", dailyEstimates: 25 }, "PUT")).json();

    const daily = data.plans.map((p: any) => p.dailyEstimates);
    expect(daily[0]).toBe(25);
    expect(daily.every((n: number, i: number) => i === 0 || n >= daily[i - 1])).toBe(true);
    expect(planFor("free").dailyEstimates).toBe(25);
  });

  it("refuses an allowance nobody meant to type", async () => {
    const cookie = await asAdmin();
    for (const dailyEstimates of [-1, 5001, 2.5, "lots"]) {
      expect((await send("/plans/estimates", cookie, { plan: "free", dailyEstimates }, "PUT")).status).toBe(400);
    }
    expect(planFor("free").dailyEstimates).toBe(basePlanFor("free").dailyEstimates);
  });

  it("refuses to touch anything that isn't a feature on the grid", async () => {
    const cookie = await asAdmin();
    // Named fields of a Plan, and the ones that matter most. Neither is on the
    // editable list, so neither is reachable however the request is shaped.
    for (const name of ["pricePence", "monthlyCostCapMicros", "model", "id", "__proto__"]) {
      expect((await flag(cookie, { flag: name, plan: "free", enabled: true })).status).toBe(400);
    }
  });

  it("leaves the price and the spending ceiling exactly where the code put them", async () => {
    const cookie = await asAdmin();
    const before = PLAN_IDS.map((id) => planFor(id));

    // Switch everything on for everyone — the most careless thing this screen
    // can do — and then check the two numbers that keep the app solvent.
    for (const feature of (await grid(cookie)).features) {
      await flag(cookie, { flag: feature.key, plan: "free", enabled: true });
    }
    await send("/plans/estimates", cookie, { plan: "free", dailyEstimates: 500 }, "PUT");

    PLAN_IDS.forEach((id, index) => {
      expect(planFor(id).pricePence).toBe(before[index]!.pricePence);
      // The ceiling is the guarantee. A free account can now scan recipes; it
      // still cannot spend more than 20p a month doing it.
      expect(planFor(id).monthlyCostCapMicros).toBe(before[index]!.monthlyCostCapMicros);
    });
  });
});
