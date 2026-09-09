import http from "node:http";
import express from "express";
import cookieParser from "cookie-parser";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * A suggestion box only works if suggestions reach somebody. These check that
 * anyone can send one, that only an admin can read the pile, and that the
 * pile comes back in the order somebody works through it.
 */

const state = vi.hoisted(() => ({ users: [] as any[], suggestions: [] as any[], nextId: 1 }));

vi.mock("../src/config", () => ({
  config: { TIMEZONE: "Europe/London", GOOGLE_SIGNIN_CLIENT_ID: undefined },
  adminUsernames: [],
}));

vi.mock("../src/db", () => {
  const prisma: any = {
    user: {
      findUnique: vi.fn(async ({ where }: any) =>
        state.users.find((u) => (where.id !== undefined ? u.id === where.id : u.username === where.username)) ?? null),
      create: vi.fn(async ({ data }: any) => {
        const user = { id: state.nextId++, weekStartWeekday: 0, weekStartHour: 17, weekStartMinute: 0, sessionsValidFrom: null, isAdmin: state.users.length === 0, ...data };
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
    setting: {
      findUnique: vi.fn(async () => null),
      upsert: vi.fn(async ({ where, create }: any) => ({ key: where.key, value: create.value })),
    },
    matchWeek: { updateMany: vi.fn(async () => ({ count: 0 })) },
    suggestion: {
      create: vi.fn(async ({ data }: any) => {
        const row = { id: state.nextId++, createdAt: new Date(), handled: false, ...data };
        state.suggestions.push(row);
        return row;
      }),
      findMany: vi.fn(async () =>
        [...state.suggestions]
          .sort((a, b) => Number(a.handled) - Number(b.handled) || b.createdAt - a.createdAt)
          .map((row) => ({ ...row, user: state.users.find((u) => u.id === row.userId) }))),
      update: vi.fn(async ({ where, data }: any) => {
        const row = state.suggestions.find((s) => s.id === where.id);
        if (!row) throw new Error("not found");
        Object.assign(row, data);
        return row;
      }),
    },
    $transaction: vi.fn(async (arg: any) => (Array.isArray(arg) ? Promise.all(arg) : arg(prisma))),
  };
  return { prisma };
});

import { authRouter } from "../src/routes/auth";
import { suggestionsRouter } from "../src/routes/suggestions";

let server: http.Server;
let baseUrl: string;

beforeEach(async () => {
  state.users.length = 0;
  state.suggestions.length = 0;
  state.nextId = 1;
  vi.clearAllMocks();
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use("/api/auth", authRouter);
  app.use("/api/suggestions", suggestionsRouter);
  server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  baseUrl = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
});
afterEach(async () => { await new Promise((resolve) => server.close(resolve)); });

async function signUp(username: string): Promise<string> {
  const res = await fetch(`${baseUrl}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password: "password123" }),
  });
  return res.headers.getSetCookie().find((c) => c.startsWith("session="))!.split(";")[0]!;
}

const send = (cookie: string, body: unknown) =>
  fetch(`${baseUrl}/api/suggestions`, {
    method: "POST", headers: { "Content-Type": "application/json", Cookie: cookie }, body: JSON.stringify(body),
  });
const read = (cookie: string) =>
  fetch(`${baseUrl}/api/suggestions`, { headers: { Cookie: cookie } });

describe("sending one", () => {
  it("takes a suggestion from any account", async () => {
    await signUp("alice");
    const bob = await signUp("bob");
    expect((await send(bob, { kind: "idea", body: "Weekly average on Today please" })).status).toBe(201);
    expect(state.suggestions[0]).toMatchObject({ kind: "idea", handled: false });
  });

  it("keeps the context, which is the point of not using email", async () => {
    const alice = await signUp("alice");
    await send(alice, { kind: "problem", body: "The chart is empty", appVersion: "v38" });
    expect(state.suggestions[0]).toMatchObject({ appVersion: "v38" });
    expect(state.suggestions[0].userAgent).toBeTruthy();
  });

  it("refuses an empty one", async () => {
    const alice = await signUp("alice");
    expect((await send(alice, { body: "  " })).status).toBe(400);
    expect((await send(alice, { body: "hm" })).status).toBe(400);
    expect(state.suggestions).toHaveLength(0);
  });

  it("refuses a kind it doesn't know", async () => {
    const alice = await signUp("alice");
    expect((await send(alice, { kind: "urgent", body: "Please fix this" })).status).toBe(400);
  });

  it("turns nobody away with no session", async () => {
    expect((await send("", { body: "Anonymous idea" })).status).toBe(401);
  });
});

describe("reading the pile", () => {
  it("is admin only, and 404s for everyone else", async () => {
    const alice = await signUp("alice");
    const bob = await signUp("bob");
    await send(bob, { body: "Something to say" });

    expect((await read(alice)).status).toBe(200);
    // 404 rather than 403, same as the admin screen: a 403 confirms there is
    // a pile to read.
    expect((await read(bob)).status).toBe(404);
  });

  it("puts the unhandled ones first", async () => {
    const alice = await signUp("alice");
    await send(alice, { body: "The older one" });
    await send(alice, { body: "The newer one" });
    state.suggestions[0]!.handled = true;

    const body = (await (await read(alice)).json()) as any;
    expect(body.suggestions[0].body).toBe("The newer one");
    expect(body.suggestions[0].handled).toBe(false);
    expect(body.suggestions[1].handled).toBe(true);
  });

  it("says who sent it", async () => {
    const alice = await signUp("alice");
    const bob = await signUp("bob");
    await send(bob, { body: "From Bob" });
    const body = (await (await read(alice)).json()) as any;
    expect(body.suggestions[0].from).toBe("bob");
  });
});

describe("marking one done", () => {
  it("lets an admin close and reopen it", async () => {
    const alice = await signUp("alice");
    await send(alice, { body: "Something to do" });
    const id = state.suggestions[0]!.id;

    const patch = (handled: boolean) =>
      fetch(`${baseUrl}/api/suggestions/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json", Cookie: alice },
        body: JSON.stringify({ handled }),
      });

    expect((await patch(true)).status).toBe(200);
    expect(state.suggestions[0]!.handled).toBe(true);
    await patch(false);
    expect(state.suggestions[0]!.handled).toBe(false);
  });

  it("won't let anyone else", async () => {
    const alice = await signUp("alice");
    const bob = await signUp("bob");
    await send(bob, { body: "Bob's own suggestion" });
    const res = await fetch(`${baseUrl}/api/suggestions/${state.suggestions[0]!.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json", Cookie: bob },
      body: JSON.stringify({ handled: true }),
    });
    // Not even their own: the pile is one person's to work through.
    expect(res.status).toBe(404);
    expect(state.suggestions[0]!.handled).toBe(false);
  });
});
