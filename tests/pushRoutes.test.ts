import http from "node:http";
import express from "express";
import cookieParser from "cookie-parser";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  users: [] as any[],
  subscriptions: [] as any[],
  nextUserId: 1,
  nextSubId: 1,
  sendResult: 1,
}));

vi.mock("../src/config", () => ({
  config: { GOOGLE_SIGNIN_CLIENT_ID: undefined, TIMEZONE: "Europe/London" },
}));

vi.mock("../src/push", () => ({
  getVapidKeys: vi.fn(async () => ({ publicKey: "test-public-key", privateKey: "test-private" })),
  sendToUser: vi.fn(async () => state.sendResult),
}));

vi.mock("../src/db", () => {
  function findUser(where: any) {
    if (where.id !== undefined) return state.users.find((u) => u.id === where.id) ?? null;
    if (where.username !== undefined) return state.users.find((u) => u.username === where.username) ?? null;
    return null;
  }
  const settingStore = new Map<string, string>();

  const prisma: any = {
    user: {
      findUnique: vi.fn(async ({ where }: any) => findUser(where)),
      create: vi.fn(async ({ data }: any) => {
        const user = {
          id: state.nextUserId++,
          weekStartWeekday: 0,
          weekStartHour: 17,
          weekStartMinute: 0,
          reminderHour: null,
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
    matchWeek: { updateMany: vi.fn(async () => ({ count: 0 })) },
    pushSubscription: {
      count: vi.fn(async ({ where }: any) =>
        state.subscriptions.filter((s) => s.userId === where.userId).length,
      ),
      upsert: vi.fn(async ({ where, update, create }: any) => {
        const existing = state.subscriptions.find((s) => s.endpoint === where.endpoint);
        if (existing) {
          Object.assign(existing, update);
          return existing;
        }
        const created = { id: state.nextSubId++, ...create };
        state.subscriptions.push(created);
        return created;
      }),
      deleteMany: vi.fn(async ({ where }: any) => {
        const before = state.subscriptions.length;
        state.subscriptions = state.subscriptions.filter(
          (s) => !(s.endpoint === where.endpoint && s.userId === where.userId),
        );
        return { count: before - state.subscriptions.length };
      }),
    },
    $transaction: vi.fn(async (arg: any) => (typeof arg === "function" ? arg(prisma) : Promise.all(arg))),
  };
  return { prisma };
});

import { authRouter } from "../src/routes/auth";
import { pushRouter } from "../src/routes/push";

let server: http.Server;
let baseUrl: string;

const SUB = {
  endpoint: "https://push.example.com/abc123",
  keys: { p256dh: "key-material", auth: "auth-secret" },
};

beforeEach(async () => {
  state.users.length = 0;
  state.subscriptions.length = 0;
  state.nextUserId = 1;
  state.nextSubId = 1;
  state.sendResult = 1;
  vi.clearAllMocks();

  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use("/api/auth", authRouter);
  app.use("/api/push", pushRouter);

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

function post(path: string, cookie: string, body?: unknown) {
  return fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe("push subscriptions", () => {
  it("rejects an unauthenticated subscribe", async () => {
    const res = await fetch(`${baseUrl}/api/push/subscribe`, { method: "POST" });
    expect(res.status).toBe(401);
  });

  it("registers a device", async () => {
    const cookie = await signUp("alice");
    expect((await post("/api/push/subscribe", cookie, SUB)).status).toBe(204);
    expect(state.subscriptions).toHaveLength(1);
    expect(state.subscriptions[0]).toMatchObject({ userId: 1, p256dh: "key-material" });
  });

  it("re-registering the same device updates it rather than adding a second row", async () => {
    const cookie = await signUp("alice");
    await post("/api/push/subscribe", cookie, SUB);
    await post("/api/push/subscribe", cookie, { ...SUB, keys: { p256dh: "rotated", auth: "new" } });
    expect(state.subscriptions).toHaveLength(1);
    expect(state.subscriptions[0]!.p256dh).toBe("rotated");
  });

  it("hands a device over when a different account signs in on it", async () => {
    const alice = await signUp("alice");
    await post("/api/push/subscribe", alice, SUB);
    const bob = await signUp("bob");
    await post("/api/push/subscribe", bob, SUB);

    // Otherwise this browser would keep delivering Alice's reminders to Bob.
    expect(state.subscriptions).toHaveLength(1);
    expect(state.subscriptions[0]!.userId).toBe(2);
  });

  it("won't let one user unsubscribe another's device", async () => {
    const alice = await signUp("alice");
    await post("/api/push/subscribe", alice, SUB);
    const bob = await signUp("bob");

    await post("/api/push/unsubscribe", bob, { endpoint: SUB.endpoint });
    expect(state.subscriptions).toHaveLength(1);

    await post("/api/push/unsubscribe", alice, { endpoint: SUB.endpoint });
    expect(state.subscriptions).toHaveLength(0);
  });

  it("rejects a malformed subscription", async () => {
    const cookie = await signUp("alice");
    const res = await post("/api/push/subscribe", cookie, { endpoint: "not-a-url", keys: {} });
    expect(res.status).toBe(400);
    expect(state.subscriptions).toHaveLength(0);
  });

  it("reports how many devices are registered", async () => {
    const cookie = await signUp("alice");
    await post("/api/push/subscribe", cookie, SUB);
    await post("/api/push/subscribe", cookie, { ...SUB, endpoint: "https://push.example.com/second" });

    const body = (await (await fetch(`${baseUrl}/api/push/status`, { headers: { Cookie: cookie } })).json()) as {
      deviceCount: number;
      reminderHour: number | null;
    };
    expect(body.deviceCount).toBe(2);
    expect(body.reminderHour).toBeNull();
  });

  it("says so plainly when a test send has nowhere to go", async () => {
    const cookie = await signUp("alice");
    state.sendResult = 0;
    const res = await post("/api/push/test", cookie);
    expect(res.status).toBe(409);
  });
});
