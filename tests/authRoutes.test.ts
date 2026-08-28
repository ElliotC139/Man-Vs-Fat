import http from "node:http";
import express from "express";
import cookieParser from "cookie-parser";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  users: [] as any[],
  nextId: 1,
}));

const { verifyIdTokenMock } = vi.hoisted(() => ({ verifyIdTokenMock: vi.fn() }));

vi.mock("../src/config", () => ({
  config: { GOOGLE_SIGNIN_CLIENT_ID: "test-google-client-id" },
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
    $transaction: vi.fn(async (fn: any) => fn(prisma)),
  };

  return { prisma };
});

import { prisma } from "../src/db";
import { authRouter } from "../src/routes/auth";

let server: http.Server;
let baseUrl: string;

beforeEach(async () => {
  state.users.length = 0;
  state.nextId = 1;
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
    // The body-stat fields (added later, for the calorie budget) come back
    // null on a fresh account — this assertion predates them.
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
