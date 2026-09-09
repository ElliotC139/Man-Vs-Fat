import http from "node:http";
import express from "express";
import cookieParser from "cookie-parser";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The one thing that makes "no ads" mean anything: a paying account never
 * receives the publisher id, so the advertising script is never loaded for
 * them rather than loaded and hidden.
 */

const state = vi.hoisted(() => ({ users: [] as any[], nextId: 1 }));

vi.mock("../src/config", () => ({
  // reconcileAdmin and toPublicUser both read this on every sign-in.
  adminUsernames: [],
  config: {
    TIMEZONE: "Europe/London",
    GOOGLE_SIGNIN_CLIENT_ID: undefined,
    GBP_PER_USD: 0.8,
    ANTHROPIC_MODEL: "claude-sonnet-5",
    ANTHROPIC_MODEL_FREE: "claude-haiku-4-5",
    ADSENSE_CLIENT_ID: "ca-pub-test",
    ADSENSE_SLOT_TODAY: "1234567890",
  },
  adsConfigured: true,
}));

vi.mock("../src/db", () => {
  const prisma: any = {
    user: {
      findUnique: vi.fn(async ({ where }: any) =>
        state.users.find((u) => (where.id !== undefined ? u.id === where.id : u.username === where.username)) ?? null),
      create: vi.fn(async ({ data }: any) => {
        const user = { id: state.nextId++, weekStartWeekday: 0, weekStartHour: 17, weekStartMinute: 0, sessionsValidFrom: null, plan: "free", ...data };
        state.users.push(user);
        return user;
      }),
      count: vi.fn(async () => state.users.length),
    },
    setting: { upsert: vi.fn(async ({ where, create }: any) => ({ key: where.key, value: create.value })) },
    matchWeek: { updateMany: vi.fn(async () => ({ count: 0 })) },
    aiUsage: {
      count: vi.fn(async () => 0),
      aggregate: vi.fn(async () => ({ _sum: { costMicros: 0 } })),
    },
    $transaction: vi.fn(async (arg: any) => (Array.isArray(arg) ? Promise.all(arg) : arg(prisma))),
  };
  return { prisma };
});

import { authRouter } from "../src/routes/auth";
import { planRouter } from "../src/routes/plan";

let server: http.Server;
let baseUrl: string;

beforeEach(async () => {
  state.users.length = 0;
  state.nextId = 1;
  vi.clearAllMocks();
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use("/api/auth", authRouter);
  app.use("/api/plan", planRouter);
  server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  baseUrl = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
});
afterEach(async () => { await new Promise((resolve) => server.close(resolve)); });

async function signUpAs(plan: string): Promise<string> {
  const res = await fetch(`${baseUrl}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "alice", password: "password123" }),
  });
  const cookie = res.headers.getSetCookie().find((c) => c.startsWith("session="))!.split(";")[0]!;
  state.users[0]!.plan = plan;
  return cookie;
}

const plan = (cookie: string) =>
  fetch(`${baseUrl}/api/plan`, { headers: { Cookie: cookie } }).then((r) => r.json() as any);

describe("GET /api/plan — the ad configuration", () => {
  it("gives a free account the publisher id and slot", async () => {
    const body = await plan(await signUpAs("free"));
    expect(body.ads).toEqual({ client: "ca-pub-test", slots: { today: "1234567890" } });
  });

  it("gives a paying account nothing at all", async () => {
    // Not a flag saying "hide them" — the id never leaves the server, so the
    // script has nothing to be loaded with.
    for (const paid of ["plus", "pro"]) {
      state.users.length = 0;
      state.nextId = 1;
      const body = await plan(await signUpAs(paid));
      expect(body.ads, `${paid} should get no ad config`).toBeNull();
    }
  });

  it("gives an unrecognised plan the free tier's ads, not silence", async () => {
    // A bad plan value reads as free everywhere else too; it must not be a
    // way to get an ad-free account.
    const body = await plan(await signUpAs("enterprise-gold"));
    expect(body.ads).not.toBeNull();
  });
});
