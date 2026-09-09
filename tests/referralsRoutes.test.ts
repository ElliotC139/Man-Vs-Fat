import http from "node:http";
import express from "express";
import cookieParser from "cookie-parser";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Where an invite comes from and where it goes: a code on a link becomes a
 * referrer on the account created from it, once, and never on an account that
 * already existed.
 */

const state = vi.hoisted(() => ({ users: [] as any[], nextId: 1 }));

vi.mock("../src/config", () => ({
  config: {
    TIMEZONE: "Europe/London",
    GOOGLE_SIGNIN_CLIENT_ID: undefined,
    APP_BASE_URL: "https://quickcals.test",
    ANTHROPIC_MODEL: "claude-sonnet-5",
    ANTHROPIC_MODEL_FREE: "claude-haiku-4-5",
  },
  adminUsernames: [],
  stripeConfigured: true,
}));

vi.mock("../src/db", () => {
  const prisma: any = {
    user: {
      findUnique: vi.fn(async ({ where }: any) =>
        state.users.find((u) =>
          where.id !== undefined ? u.id === where.id
          : where.username !== undefined ? u.username === where.username
          : where.googleId !== undefined ? u.googleId === where.googleId
          : where.referralCode !== undefined ? u.referralCode === where.referralCode
          : false) ?? null),
      create: vi.fn(async ({ data }: any) => {
        const user = {
          id: state.nextId++,
          weekStartWeekday: 0,
          weekStartHour: 17,
          weekStartMinute: 0,
          sessionsValidFrom: null,
          plan: "free",
          referralCode: null,
          referredById: null,
          referralRewardedAt: null,
          referralTrialUsed: false,
          isAdmin: state.users.length === 0,
          ...data,
        };
        state.users.push(user);
        return user;
      }),
      count: vi.fn(async ({ where }: any = {}) => {
        if (!where) return state.users.length;
        return state.users.filter((u) =>
          (where.referredById === undefined || u.referredById === where.referredById)
          && (where.referralRewardedAt === undefined || u.referralRewardedAt !== null)).length;
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const user = state.users.find((u) => u.id === where.id);
        // The unique index on referralCode, which is what makes the mint
        // retry loop worth having.
        if (data.referralCode && state.users.some((u) => u.referralCode === data.referralCode)) {
          throw new Error("Unique constraint failed");
        }
        Object.assign(user, data);
        return user;
      }),
    },
    setting: {
      findUnique: vi.fn(async () => null),
      upsert: vi.fn(async ({ where, create }: any) => ({ key: where.key, value: create.value })),
    },
    matchWeek: { updateMany: vi.fn(async () => ({ count: 0 })) },
    $transaction: vi.fn(async (arg: any) => (Array.isArray(arg) ? Promise.all(arg) : arg(prisma))),
  };
  return { prisma };
});

import { authRouter } from "../src/routes/auth";
import { referralsRouter } from "../src/routes/referrals";

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
  app.use("/api/referrals", referralsRouter);
  server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  baseUrl = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
});
afterEach(async () => { await new Promise((resolve) => server.close(resolve)); });

async function signUp(username: string, ref?: string): Promise<string> {
  const res = await fetch(`${baseUrl}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password: "password123", ...(ref ? { ref } : {}) }),
  });
  return res.headers.getSetCookie().find((c) => c.startsWith("session="))!.split(";")[0]!;
}

const mine = (cookie: string) => fetch(`${baseUrl}/api/referrals`, { headers: { Cookie: cookie } });
const invite = (code: string) => fetch(`${baseUrl}/api/referrals/invite/${code}`);

/** The invite screen's body, typed loosely so a test can read one field. */
const mineBody = async (cookie: string): Promise<any> => (await mine(cookie)).json();
const inviteBody = async (code: string): Promise<any> => (await invite(code)).json();

describe("your own code", () => {
  it("mints one the first time you look, and keeps it after that", async () => {
    const alice = await signUp("alice");
    const first = await mineBody(alice);
    expect(first.code).toMatch(/^[A-Z0-9]{7}$/);
    expect(first.url).toBe(`https://quickcals.test/?ref=${first.code}`);

    const second = await mineBody(alice);
    expect(second.code).toBe(first.code);
  });

  it("draws again when a code is already taken", async () => {
    const alice = await signUp("alice");
    await signUp("bob");
    // Bob holds one; Alice must end up with a different one rather than a 500.
    state.users[1]!.referralCode = "AAAAAAA";
    const body = await mineBody(alice);
    expect(body.code).toBeTruthy();
    expect(body.code).not.toBe("AAAAAAA");
  });

  it("counts invites and conversions separately", async () => {
    const alice = await signUp("alice");
    const code = (await mineBody(alice)).code;

    await signUp("bob", code);
    await signUp("carla", code);
    // Only one of them has actually paid.
    state.users.find((u) => u.username === "carla")!.referralRewardedAt = new Date();

    const body = await mineBody(alice);
    expect(body).toMatchObject({ invited: 2, converted: 1 });
    // A free-tier referrer's next conversion is worth a month of Plus.
    expect(body.nextRewardPence).toBe(499);
    expect(body.earnedPence).toBe(499);
  });

  it("is worth a month of your own plan once you're paying for one", async () => {
    const alice = await signUp("alice");
    state.users[0]!.plan = "pro";
    expect((await mineBody(alice)).nextRewardPence).toBe(999);
  });

  it("says when your own free month is still waiting", async () => {
    const alice = await signUp("alice");
    const code = (await mineBody(alice)).code;
    const bob = await signUp("bob", code);

    expect((await mineBody(bob)).trialWaiting).toBe(true);
    state.users.find((u) => u.username === "bob")!.referralTrialUsed = true;
    expect((await mineBody(bob)).trialWaiting).toBe(false);
  });

  it("needs a session", async () => {
    expect((await mine("")).status).toBe(401);
  });
});

describe("following a link", () => {
  it("attaches the referrer to the account created from it", async () => {
    const alice = await signUp("alice");
    const code = (await mineBody(alice)).code;

    await signUp("bob", code);
    expect(state.users.find((u) => u.username === "bob")!.referredById).toBe(1);
  });

  it("takes the code however it was typed", async () => {
    const alice = await signUp("alice");
    const code: string = (await mineBody(alice)).code;

    await signUp("bob", ` ${code.toLowerCase()} `);
    expect(state.users.find((u) => u.username === "bob")!.referredById).toBe(1);
  });

  it("still creates the account when the code is nonsense", async () => {
    // A mistyped invite should cost somebody a free month, not an account.
    await signUp("alice", "NOTACODE");
    expect(state.users).toHaveLength(1);
    expect(state.users[0]!.referredById).toBeNull();
  });

  it("names who invited you, so the sign-up page isn't asking for trust blind", async () => {
    const alice = await signUp("alice");
    const code = (await mineBody(alice)).code;

    expect(await inviteBody(code)).toMatchObject({ valid: true, name: "alice" });
  });

  it("says nothing about a code that doesn't exist", async () => {
    expect(await inviteBody("ZZZZZZZ")).toEqual({ valid: false });
    expect(await inviteBody("!!")).toEqual({ valid: false });
  });

  it("answers without a session, because nobody following a link has one", async () => {
    const alice = await signUp("alice");
    const code = (await mineBody(alice)).code;
    expect((await invite(code)).status).toBe(200);
  });
});
