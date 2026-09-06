import http from "node:http";
import express from "express";
import cookieParser from "cookie-parser";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  users: [] as any[],
  entries: [] as any[],
  shares: [] as any[],
  nextUserId: 1,
  nextEntryId: 1,
  nextShareId: 1,
}));

vi.mock("../src/config", () => ({
  config: {
    GOOGLE_SIGNIN_CLIENT_ID: undefined,
    TIMEZONE: "Europe/London",
    APP_BASE_URL: "https://example.test",
  },
}));

vi.mock("../src/db", () => {
  const prisma: any = {
    user: {
      findUnique: vi.fn(async ({ where }: any) =>
        state.users.find((u) => (where.id !== undefined ? u.id === where.id : u.username === where.username)) ?? null),
      findUniqueOrThrow: vi.fn(async ({ where }: any) => {
        const user = state.users.find((u) => u.id === where.id);
        if (!user) throw new Error("no user");
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
    matchWeek: {
      findFirst: vi.fn(async () => ({ id: 1, userId: 1 })),
      create: vi.fn(async () => ({ id: 1, userId: 1 })),
      // findOrCreateMatchWeek upserts rather than find-then-create.
      upsert: vi.fn(async ({ where }: any) => ({ id: 1, userId: where?.userId_startsAt_endsAt?.userId ?? 1 })),
      updateMany: vi.fn(async () => ({ count: 0 })),
    },
    entry: {
      findMany: vi.fn(async ({ where, orderBy }: any) => {
        const ids: number[] | undefined = where?.id?.in;
        const userId = where?.matchWeek?.userId;
        const rows = state.entries.filter(
          (e) => (ids ? ids.includes(e.id) : true) && (userId === undefined || e.userId === userId),
        );
        if (orderBy?.timestamp) rows.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
        return rows;
      }),
      create: vi.fn(async ({ data }: any) => {
        const entry = { id: state.nextEntryId++, ...data };
        state.entries.push(entry);
        return entry;
      }),
    },
    foodShare: {
      create: vi.fn(async ({ data }: any) => {
        const share = { id: state.nextShareId++, createdAt: new Date(), ...data };
        state.shares.push(share);
        return share;
      }),
      findUnique: vi.fn(async ({ where }: any) =>
        state.shares.find((s) => s.token === where.token) ?? null),
    },
    setting: { upsert: vi.fn(async () => ({ key: "x", value: "y" })) },
    // Both forms: auth.ts hands it a callback, the share accept hands it an
    // array of creates.
    $transaction: vi.fn(async (arg: any) =>
      typeof arg === "function" ? arg(prisma) : Promise.all(arg),
    ),
  };
  return { prisma };
});

import { authRouter } from "../src/routes/auth";
import { sharesRouter } from "../src/routes/shares";

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use("/api/auth", authRouter);
app.use("/api/shares", sharesRouter);

let server: http.Server;
let baseUrl: string;

beforeEach(async () => {
  state.users.length = 0;
  state.entries.length = 0;
  state.shares.length = 0;
  state.nextUserId = 1;
  state.nextEntryId = 1;
  state.nextShareId = 1;
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      baseUrl = `http://127.0.0.1:${(server.address() as any).port}`;
      resolve();
    });
  });
});

afterEach(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

async function signUp(username: string): Promise<{ cookie: string; userId: number }> {
  const res = await fetch(`${baseUrl}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password: "password123" }),
  });
  const body = (await res.json()) as { id: number };
  const raw = res.headers.get("set-cookie") ?? "";
  return { cookie: raw.split(";")[0]!, userId: body.id };
}

function logFor(userId: number, label: string, kcal: number, at = "2026-01-01T12:00:00Z") {
  const entry = { id: state.nextEntryId++, userId, label, kcal, quantity: 1, proteinG: 10, carbsG: 20, fatG: 5, timestamp: new Date(at) };
  state.entries.push(entry);
  return entry;
}

describe("POST /api/shares", () => {
  it("freezes a copy of the sender's items behind a token", async () => {
    const { cookie, userId } = await signUp("alice");
    const a = logFor(userId, "Porridge", 320, "2026-01-01T07:40:00Z");
    const b = logFor(userId, "Coffee", 4, "2026-01-01T07:45:00Z");

    const res = await fetch(`${baseUrl}/api/shares`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ entryIds: [a.id, b.id] }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as any;

    expect(body.items.map((i: any) => i.label)).toEqual(["Porridge", "Coffee"]);
    expect(body.url).toBe(`https://example.test/s/${body.token}`);
    // A link that works forever is a link that leaks forever.
    expect(new Date(body.expiresAt).getTime()).toBeGreaterThan(Date.now());
  });

  it("cannot be pointed at somebody else's entries", async () => {
    // The ids are sequential and guessable, so scoping is the only thing
    // stopping a share being built out of another person's diary.
    const alice = await signUp("alice");
    const bob = await signUp("bob");
    const hers = logFor(alice.userId, "Porridge", 320);

    const res = await fetch(`${baseUrl}/api/shares`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: bob.cookie },
      body: JSON.stringify({ entryIds: [hers.id] }),
    });
    expect(res.status).toBe(404);
  });

  it("refuses an unauthenticated caller", async () => {
    const res = await fetch(`${baseUrl}/api/shares`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entryIds: [1] }),
    });
    expect(res.status).toBe(401);
  });
});

describe("GET /api/shares/:token", () => {
  it("opens for anyone with the link, signed in or not", async () => {
    const { cookie, userId } = await signUp("alice");
    const a = logFor(userId, "Porridge", 320);
    const made = await (await fetch(`${baseUrl}/api/shares`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ entryIds: [a.id] }),
    })).json() as any;

    // No cookie: the whole point is that a link works for whoever it was sent
    // to, including someone who has never opened the app.
    const res = await fetch(`${baseUrl}/api/shares/${made.token}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.items[0].label).toBe("Porridge");
  });

  it("gives nothing away about who sent it or when they ate it", async () => {
    const { cookie, userId } = await signUp("alice");
    const a = logFor(userId, "Porridge", 320);
    const made = await (await fetch(`${baseUrl}/api/shares`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ entryIds: [a.id] }),
    })).json() as any;

    const body = (await (await fetch(`${baseUrl}/api/shares/${made.token}`)).json()) as any;
    const serialised = JSON.stringify(body);
    expect(serialised).not.toContain("alice");
    expect(serialised).not.toContain("userId");
    expect(body.items[0].timestamp).toBeUndefined();
  });

  it("is a flat 404 for an unknown token, so tokens can't be probed", async () => {
    const res = await fetch(`${baseUrl}/api/shares/not-a-real-token`);
    expect(res.status).toBe(404);
  });

  it("stops working once it has expired", async () => {
    const { cookie, userId } = await signUp("alice");
    const a = logFor(userId, "Porridge", 320);
    const made = await (await fetch(`${baseUrl}/api/shares`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ entryIds: [a.id] }),
    })).json() as any;

    state.shares[0]!.expiresAt = new Date(Date.now() - 1000);
    expect((await fetch(`${baseUrl}/api/shares/${made.token}`)).status).toBe(404);
  });
});

describe("POST /api/shares/:token/accept", () => {
  it("writes the items into the recipient's own diary", async () => {
    const alice = await signUp("alice");
    const a = logFor(alice.userId, "Porridge", 320, "2026-01-01T07:40:00Z");
    const b = logFor(alice.userId, "Coffee", 4, "2026-01-01T07:45:00Z");
    const made = await (await fetch(`${baseUrl}/api/shares`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: alice.cookie },
      body: JSON.stringify({ entryIds: [a.id, b.id] }),
    })).json() as any;

    const bob = await signUp("bob");
    const res = await fetch(`${baseUrl}/api/shares/${made.token}/accept`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: bob.cookie },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(201);
    const created = (await res.json()) as any[];
    expect(created.map((e) => e.label)).toEqual(["Porridge", "Coffee"]);
    // Copies, not moves: Alice still has hers.
    expect(state.entries.filter((e) => e.userId === alice.userId)).toHaveLength(2);
  });

  it("refuses to add anything for someone who isn't signed in", async () => {
    // A link on its own must not be able to put food in anybody's diary.
    const alice = await signUp("alice");
    const a = logFor(alice.userId, "Porridge", 320);
    const made = await (await fetch(`${baseUrl}/api/shares`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: alice.cookie },
      body: JSON.stringify({ entryIds: [a.id] }),
    })).json() as any;

    const res = await fetch(`${baseUrl}/api/shares/${made.token}/accept`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(401);
  });

  it("will not accept an expired link", async () => {
    const alice = await signUp("alice");
    const a = logFor(alice.userId, "Porridge", 320);
    const made = await (await fetch(`${baseUrl}/api/shares`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: alice.cookie },
      body: JSON.stringify({ entryIds: [a.id] }),
    })).json() as any;
    state.shares[0]!.expiresAt = new Date(Date.now() - 1000);

    const bob = await signUp("bob");
    const res = await fetch(`${baseUrl}/api/shares/${made.token}/accept`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: bob.cookie },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(404);
  });
});
