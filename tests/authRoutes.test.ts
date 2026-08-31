import http from "node:http";
import express from "express";
import cookieParser from "cookie-parser";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  users: [] as any[],
  resetTokens: [] as any[],
  nextId: 1,
  nextTokenId: 1,
}));

// Captures what the app would have emailed, so the reset link can be read out
// of the "inbox" the way a user would read it out of theirs.
const { sentMail } = vi.hoisted(() => ({ sentMail: [] as { to: string; subject: string; text: string }[] }));

vi.mock("../src/mailer", () => ({
  canSendMail: () => true,
  sendMail: async (mail: any) => {
    sentMail.push(mail);
    return true;
  },
}));

const { verifyIdTokenMock } = vi.hoisted(() => ({ verifyIdTokenMock: vi.fn() }));

vi.mock("../src/config", () => ({
  config: { GOOGLE_SIGNIN_CLIENT_ID: "test-google-client-id", APP_BASE_URL: "https://example.test" },
}));

vi.mock("../src/deleteAccount", () => ({
  deleteAccount: vi.fn(async (userId: number) => {
    state.users = state.users.filter((u: any) => u.id !== userId);
  }),
}));

vi.mock("google-auth-library", () => ({
  OAuth2Client: class {
    verifyIdToken = verifyIdTokenMock;
  },
}));

vi.mock("../src/db", () => {
  function findUser(where: any) {
    if (where.id !== undefined) return state.users.find((u) => u.id === where.id) ?? null;
    if (where.username !== undefined) return state.users.find((u) => u.username === where.username) ?? null;
    if (where.googleId !== undefined) return state.users.find((u) => u.googleId === where.googleId) ?? null;
    if (where.email !== undefined) return state.users.find((u) => u.email === where.email) ?? null;
    return null;
  }

  const settingStore = new Map<string, string>();

  const prisma: any = {
    user: {
      findUnique: vi.fn(async ({ where }: any) => findUser(where)),
      create: vi.fn(async ({ data }: any) => {
        const user = {
          id: state.nextId++,
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
      update: vi.fn(async ({ where, data }: any) => {
        const user = findUser(where);
        Object.assign(user, data);
        return user;
      }),
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
    passwordResetToken: {
      create: vi.fn(async ({ data }: any) => {
        const token = { id: state.nextTokenId++, usedAt: null, createdAt: new Date(), ...data };
        state.resetTokens.push(token);
        return token;
      }),
      findUnique: vi.fn(async ({ where }: any) =>
        state.resetTokens.find((t: any) => t.tokenHash === where.tokenHash) ?? null,
      ),
      update: vi.fn(async ({ where, data }: any) => {
        const token = state.resetTokens.find((t: any) => t.id === where.id);
        Object.assign(token, data);
        return token;
      }),
      updateMany: vi.fn(async ({ where, data }: any) => {
        let count = 0;
        for (const token of state.resetTokens) {
          if (token.userId === where.userId && token.usedAt === null) {
            Object.assign(token, data);
            count += 1;
          }
        }
        return { count };
      }),
    },
    // The real $transaction takes an array of already-built promises for the
    // reset flow and a callback for signup; both shapes have to work.
    $transaction: vi.fn(async (arg: any) => (Array.isArray(arg) ? Promise.all(arg) : arg(prisma))),
  };

  return { prisma };
});

import { prisma } from "../src/db";
import { authRouter } from "../src/routes/auth";
import { resetAll as resetRateLimits } from "../src/rateLimit";

let server: http.Server;
let baseUrl: string;

beforeEach(async () => {
  state.users.length = 0;
  state.resetTokens.length = 0;
  sentMail.length = 0;
  state.nextId = 1;
  state.nextTokenId = 1;
  // The limiter is module-level state shared by every test in this file, so
  // without this a later test inherits an earlier one's spent allowance.
  resetRateLimits();
  vi.clearAllMocks();
  verifyIdTokenMock.mockReset();

  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use("/api/auth", authRouter);

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

describe("POST /api/auth/signup", () => {
  it("creates an account and sets a session cookie", async () => {
    const res = await fetch(`${baseUrl}/api/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "alice", password: "password123" }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    // Every optional field — body stats for the calorie budget, the goal
    // weight, the reminder hour — comes back null on a fresh account.
    expect(body).toEqual({
      id: 1,
      username: "alice",
      weekStartWeekday: 0,
      weekStartHour: 17,
      weekStartMinute: 0,
      weightKg: null,
      heightCm: null,
      ageYears: null,
      activityLevel: null,
      weeklyGoalKg: null,
      goalWeightKg: null,
      dailyCalorieTarget: null,
      macroMode: null,
      proteinTargetG: null,
      carbsTargetG: null,
      fatTargetG: null,
      proteinPct: null,
      carbsPct: null,
      fatPct: null,
      // Null rather than an empty object: macros are off until asked for, and
      // the diary shows calories only.
      macroTargets: null,
      reminderHour: null,
      email: null,
      // Signed up with a password and no Google account, so the settings
      // screen knows a password change is possible and a Google unlink isn't.
      hasGoogle: false,
      hasPassword: true,
    });
    expect(sessionCookieFrom(res)).toMatch(/^session=/);
  });

  it("rejects a duplicate username", async () => {
    await fetch(`${baseUrl}/api/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "alice", password: "password123" }),
    });

    const res = await fetch(`${baseUrl}/api/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "alice", password: "anotherpassword" }),
    });

    expect(res.status).toBe(409);
  });

  it("rejects a too-short password", async () => {
    const res = await fetch(`${baseUrl}/api/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "alice", password: "short" }),
    });

    expect(res.status).toBe(400);
  });

  it("claims pre-existing legacy match weeks for the first user only", async () => {
    await fetch(`${baseUrl}/api/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "alice", password: "password123" }),
    });
    expect(prisma.matchWeek.updateMany).toHaveBeenCalledTimes(1);
    expect(prisma.matchWeek.updateMany).toHaveBeenCalledWith({ where: { userId: null }, data: { userId: 1 } });

    await fetch(`${baseUrl}/api/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "bob", password: "password123" }),
    });
    expect(prisma.matchWeek.updateMany).toHaveBeenCalledTimes(1);
  });
});

describe("POST /api/auth/login", () => {
  beforeEach(async () => {
    await fetch(`${baseUrl}/api/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "alice", password: "password123" }),
    });
  });

  it("logs in with correct credentials", async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "alice", password: "password123" }),
    });

    expect(res.status).toBe(200);
    expect(sessionCookieFrom(res)).toMatch(/^session=/);
  });

  it("rejects an incorrect password", async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "alice", password: "wrongpassword" }),
    });

    expect(res.status).toBe(401);
  });

  it("rejects an unknown username without revealing it doesn't exist", async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "nobody", password: "password123" }),
    });

    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("Incorrect username or password.");
  });
});

describe("GET /api/auth/google/config", () => {
  it("reports the configured client id", async () => {
    const res = await fetch(`${baseUrl}/api/auth/google/config`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ clientId: "test-google-client-id" });
  });
});

describe("POST /api/auth/google", () => {
  it("creates a new account from a verified credential and claims legacy match weeks for the first user", async () => {
    verifyIdTokenMock.mockResolvedValueOnce({
      getPayload: () => ({ sub: "google-1", email: "newuser@example.com", email_verified: true }),
    });

    const res = await fetch(`${baseUrl}/api/auth/google`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ credential: "fake-id-token" }),
    });

    expect(res.status).toBe(201);
    const body = (await res.json()) as { username: string };
    expect(body.username).toBe("newuser");
    expect(sessionCookieFrom(res)).toMatch(/^session=/);
    expect(prisma.matchWeek.updateMany).toHaveBeenCalledWith({ where: { userId: null }, data: { userId: 1 } });
  });

  it("de-duplicates the generated username against existing accounts", async () => {
    await fetch(`${baseUrl}/api/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "newuser", password: "password123" }),
    });

    verifyIdTokenMock.mockResolvedValueOnce({
      getPayload: () => ({ sub: "google-2", email: "newuser@example.com", email_verified: true }),
    });

    const res = await fetch(`${baseUrl}/api/auth/google`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ credential: "fake-id-token" }),
    });

    expect(res.status).toBe(201);
    const body = (await res.json()) as { username: string };
    expect(body.username).toBe("newuser2");
  });

  it("logs in an existing Google-linked account without creating a duplicate", async () => {
    verifyIdTokenMock.mockResolvedValue({
      getPayload: () => ({ sub: "google-3", email: "returning@example.com", email_verified: true }),
    });

    await fetch(`${baseUrl}/api/auth/google`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ credential: "fake-id-token" }),
    });

    const res = await fetch(`${baseUrl}/api/auth/google`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ credential: "fake-id-token" }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { id: number };
    expect(body.id).toBe(1);
    expect(prisma.user.create).toHaveBeenCalledTimes(1);
  });

  it("rejects a credential with an unverified email", async () => {
    verifyIdTokenMock.mockResolvedValueOnce({
      getPayload: () => ({ sub: "google-4", email: "unverified@example.com", email_verified: false }),
    });

    const res = await fetch(`${baseUrl}/api/auth/google`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ credential: "fake-id-token" }),
    });

    expect(res.status).toBe(401);
  });

  it("rejects a credential that fails verification", async () => {
    verifyIdTokenMock.mockRejectedValueOnce(new Error("invalid token"));

    const res = await fetch(`${baseUrl}/api/auth/google`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ credential: "fake-id-token" }),
    });

    expect(res.status).toBe(401);
  });
});

describe("GET /api/auth/me", () => {
  it("rejects an unauthenticated request", async () => {
    const res = await fetch(`${baseUrl}/api/auth/me`);
    expect(res.status).toBe(401);
  });

  it("returns the signed-in user's own profile", async () => {
    const signupRes = await fetch(`${baseUrl}/api/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "alice", password: "password123" }),
    });
    const cookie = sessionCookieFrom(signupRes);

    const res = await fetch(`${baseUrl}/api/auth/me`, { headers: { Cookie: cookie } });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { username: string };
    expect(body.username).toBe("alice");
  });
});

describe("PATCH /api/auth/me", () => {
  it("updates the caller's own week-start settings", async () => {
    const signupRes = await fetch(`${baseUrl}/api/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "alice", password: "password123" }),
    });
    const cookie = sessionCookieFrom(signupRes);

    const res = await fetch(`${baseUrl}/api/auth/me`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ weekStartWeekday: 2, weekStartHour: 9, weekStartMinute: 0 }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ weekStartWeekday: 2, weekStartHour: 9, weekStartMinute: 0 });
  });

  it("rejects an unauthenticated request", async () => {
    const res = await fetch(`${baseUrl}/api/auth/me`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ weekStartWeekday: 2 }),
    });
    expect(res.status).toBe(401);
  });
});

describe("POST /api/auth/logout", () => {
  it("clears the session so a subsequent /me call is unauthenticated", async () => {
    const signupRes = await fetch(`${baseUrl}/api/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "alice", password: "password123" }),
    });
    const cookie = sessionCookieFrom(signupRes);

    const logoutRes = await fetch(`${baseUrl}/api/auth/logout`, { method: "POST", headers: { Cookie: cookie } });
    expect(logoutRes.status).toBe(204);

    const clearedCookie = sessionCookieFrom(logoutRes);
    const meRes = await fetch(`${baseUrl}/api/auth/me`, { headers: { Cookie: clearedCookie } });
    expect(meRes.status).toBe(401);
  });
});

// ── Account recovery ───────────────────────────────────────────────────────

async function signUpAlice(): Promise<string> {
  const res = await fetch(`${baseUrl}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "alice", password: "password123" }),
  });
  return sessionCookieFrom(res);
}

function tokenFromLastEmail(): string {
  const link = sentMail[sentMail.length - 1]!.text.match(/\?reset=([a-f0-9]+)/);
  if (!link) throw new Error("No reset link in the email");
  return link[1]!;
}

describe("POST /api/auth/forgot", () => {
  it("emails a reset link when the account has an address on file", async () => {
    const cookie = await signUpAlice();
    await fetch(`${baseUrl}/api/auth/email`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ email: "alice@example.test" }),
    });

    const res = await fetch(`${baseUrl}/api/auth/forgot`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "alice" }),
    });

    expect(res.status).toBe(200);
    expect(sentMail).toHaveLength(1);
    expect(sentMail[0]!.to).toBe("alice@example.test");
  });

  it("answers the same for an account that doesn't exist, and sends nothing", async () => {
    const res = await fetch(`${baseUrl}/api/auth/forgot`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "nobody" }),
    });

    // Identical to the success case on purpose: this endpoint must not be a
    // way to find out which usernames are real.
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(sentMail).toHaveLength(0);
  });

  it("stores only a hash of the token, never the token itself", async () => {
    const cookie = await signUpAlice();
    await fetch(`${baseUrl}/api/auth/email`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ email: "alice@example.test" }),
    });
    await fetch(`${baseUrl}/api/auth/forgot`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "alice" }),
    });

    const token = tokenFromLastEmail();
    expect(state.resetTokens).toHaveLength(1);
    expect(state.resetTokens[0].tokenHash).not.toBe(token);
  });
});

describe("POST /api/auth/reset", () => {
  async function requestReset(): Promise<string> {
    const cookie = await signUpAlice();
    await fetch(`${baseUrl}/api/auth/email`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ email: "alice@example.test" }),
    });
    await fetch(`${baseUrl}/api/auth/forgot`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "alice" }),
    });
    return tokenFromLastEmail();
  }

  it("sets a new password and signs the user in", async () => {
    const token = await requestReset();

    const res = await fetch(`${baseUrl}/api/auth/reset`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password: "brand-new-password" }),
    });
    expect(res.status).toBe(200);
    expect(sessionCookieFrom(res)).toMatch(/^session=/);

    const login = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "alice", password: "brand-new-password" }),
    });
    expect(login.status).toBe(200);
  });

  it("burns the token, so the same link can't be used twice", async () => {
    const token = await requestReset();
    await fetch(`${baseUrl}/api/auth/reset`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password: "brand-new-password" }),
    });

    const second = await fetch(`${baseUrl}/api/auth/reset`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password: "another-password" }),
    });
    expect(second.status).toBe(400);
  });

  it("rejects an expired token", async () => {
    const token = await requestReset();
    state.resetTokens[0].expiresAt = new Date(Date.now() - 1000);

    const res = await fetch(`${baseUrl}/api/auth/reset`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password: "brand-new-password" }),
    });
    expect(res.status).toBe(400);
  });

  it("rejects a token that was never issued", async () => {
    await signUpAlice();
    const res = await fetch(`${baseUrl}/api/auth/reset`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: "deadbeef".repeat(8), password: "brand-new-password" }),
    });
    expect(res.status).toBe(400);
  });
});

describe("POST /api/auth/password", () => {
  it("refuses without the current password", async () => {
    const cookie = await signUpAlice();
    const res = await fetch(`${baseUrl}/api/auth/password`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ currentPassword: "wrong-password", newPassword: "a-new-password" }),
    });
    expect(res.status).toBe(403);
  });

  it("changes the password when the current one is right", async () => {
    const cookie = await signUpAlice();
    const res = await fetch(`${baseUrl}/api/auth/password`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ currentPassword: "password123", newPassword: "a-new-password" }),
    });
    expect(res.status).toBe(200);

    const login = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "alice", password: "a-new-password" }),
    });
    expect(login.status).toBe(200);
  });
});

describe("DELETE /api/auth/me", () => {
  it("refuses unless the username is typed back exactly", async () => {
    const cookie = await signUpAlice();
    const res = await fetch(`${baseUrl}/api/auth/me`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ confirm: "Alice", password: "password123" }),
    });
    expect(res.status).toBe(400);
    expect(state.users).toHaveLength(1);
  });

  it("refuses on a wrong password even with the right username", async () => {
    const cookie = await signUpAlice();
    const res = await fetch(`${baseUrl}/api/auth/me`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ confirm: "alice", password: "not-my-password" }),
    });
    expect(res.status).toBe(403);
    expect(state.users).toHaveLength(1);
  });

  it("deletes the account when both checks pass", async () => {
    const cookie = await signUpAlice();
    const res = await fetch(`${baseUrl}/api/auth/me`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ confirm: "alice", password: "password123" }),
    });
    expect(res.status).toBe(204);
    expect(state.users).toHaveLength(0);
  });
});

describe("POST /api/auth/login throttling", () => {
  it("locks out after repeated wrong passwords and stays locked for a correct one", async () => {
    await signUpAlice();

    for (let i = 0; i < 8; i++) {
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "alice", password: `wrong-${i}` }),
      });
      expect(res.status).toBe(401);
    }

    const ninth = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "alice", password: "password123" }),
    });
    expect(ninth.status).toBe(429);
  });
});

describe("POST /api/auth/forgot throttling", () => {
  it("stops a reset link being used to spam an inbox", async () => {
    const cookie = await signUpAlice();
    await fetch(`${baseUrl}/api/auth/email`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ email: "alice@example.test" }),
    });

    for (let i = 0; i < 5; i++) {
      const res = await fetch(`${baseUrl}/api/auth/forgot`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "alice" }),
      });
      expect(res.status).toBe(200);
    }

    const sixth = await fetch(`${baseUrl}/api/auth/forgot`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "alice" }),
    });
    expect(sixth.status).toBe(429);
    expect(sentMail).toHaveLength(5);
  });
});

describe("PATCH /api/auth/me — macro targets", () => {
  it("refuses percentage targets with no calorie target to divide up", async () => {
    const cookie = await signUpAlice();
    const res = await fetch(`${baseUrl}/api/auth/me`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ macroMode: "percent", proteinPct: 30, carbsPct: 40, fatPct: 30 }),
    });
    expect(res.status).toBe(400);
    expect(((await res.json()) as any).error).toMatch(/calorie target/i);
  });

  it("refuses percentages that don't make 100", async () => {
    const cookie = await signUpAlice();
    const res = await fetch(`${baseUrl}/api/auth/me`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({
        dailyCalorieTarget: 2200,
        macroMode: "percent",
        proteinPct: 30,
        carbsPct: 40,
        fatPct: 40,
      }),
    });
    expect(res.status).toBe(400);
    expect(((await res.json()) as any).error).toContain("110%");
  });

  it("validates against the merged settings, not just the fields in this request", async () => {
    const cookie = await signUpAlice();
    // A calorie target arrives first...
    await fetch(`${baseUrl}/api/auth/me`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ dailyCalorieTarget: 2000 }),
    });
    // ...and the percentages in a second request, which on its own says
    // nothing about a calorie target. It has to pass because the stored one
    // satisfies the rule.
    const ok = await fetch(`${baseUrl}/api/auth/me`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ macroMode: "percent", proteinPct: 30, carbsPct: 40, fatPct: 30 }),
    });
    expect(ok.status).toBe(200);

    // And clearing the calorie target afterwards must now fail, because the
    // stored percentages would be left with nothing to divide up.
    const broken = await fetch(`${baseUrl}/api/auth/me`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ dailyCalorieTarget: null }),
    });
    expect(broken.status).toBe(400);
  });

  it("resolves percentage targets into grams on the way out", async () => {
    const cookie = await signUpAlice();
    const res = await fetch(`${baseUrl}/api/auth/me`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({
        dailyCalorieTarget: 2000,
        macroMode: "percent",
        proteinPct: 30,
        carbsPct: 40,
        fatPct: 30,
      }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.macroTargets.grams).toEqual({ protein: 150, carbs: 200, fat: 67 });
  });

  it("refuses gram mode with nothing set", async () => {
    const cookie = await signUpAlice();
    const res = await fetch(`${baseUrl}/api/auth/me`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ macroMode: "grams", proteinTargetG: 0, carbsTargetG: 0, fatTargetG: 0 }),
    });
    expect(res.status).toBe(400);
  });

  it("switching macros off clears the resolved targets and asks nothing else", async () => {
    const cookie = await signUpAlice();
    await fetch(`${baseUrl}/api/auth/me`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ macroMode: "grams", proteinTargetG: 180, carbsTargetG: 200, fatTargetG: 60 }),
    });
    const res = await fetch(`${baseUrl}/api/auth/me`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ macroMode: null }),
    });
    expect(res.status).toBe(200);
    expect(((await res.json()) as any).macroTargets).toBeNull();
  });
});
