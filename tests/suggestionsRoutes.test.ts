import http from "node:http";
import express from "express";
import cookieParser from "cookie-parser";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * A suggestion box only works if suggestions reach somebody. These check that
 * anyone can send one, that only an admin can read the pile, and that the
 * pile comes back in the order somebody works through it.
 */

const state = vi.hoisted(() => ({
  users: [] as any[],
  suggestions: [] as any[],
  nextId: 1,
  /** Announcement emails the route tried to send. */
  mails: [] as any[],
  /** Set to make sending throw, which is the case that must not lose data. */
  mailFails: false,
  mailOn: true,
}));

vi.mock("../src/config", () => ({
  config: {
    TIMEZONE: "Europe/London",
    GOOGLE_SIGNIN_CLIENT_ID: undefined,
    APP_BASE_URL: "https://quickcals.test",
    SUGGESTIONS_EMAIL: "hello@quickcals.test",
  },
  adminUsernames: [],
}));

vi.mock("../src/errorLog", () => ({ recordError: vi.fn(async () => {}) }));

vi.mock("../src/mailer", () => ({
  canSendMail: () => state.mailOn,
  sendMail: async (mail: any) => {
    if (state.mailFails) throw new Error("Resend is down");
    state.mails.push(mail);
    return true;
  },
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
  state.mails.length = 0;
  state.mailFails = false;
  state.mailOn = true;
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

describe("announcing a suggestion", () => {
  /**
   * The record is the system of record; the email is only a nudge. Every test
   * here is really the same assertion from a different angle: the nudge
   * failing must never cost the thing it was nudging about.
   */
  const settle = () => new Promise((r) => setTimeout(r, 0));

  /**
   * The rate limiter is module state and outlives a test, so two tests that
   * both sign up as user 1 share one daily allowance and the second gets a
   * 429. A distinct id per test keeps them independent.
   */
  const freshUser = (id: number) => { state.nextId = id; };

  it("emails the address in config when one arrives", async () => {
    freshUser(101);
    const cookie = await signUp("alice");
    await send(cookie, { kind: "idea", body: "Let me pin a meal to the top of the list." });
    await settle();

    expect(state.mails).toHaveLength(1);
    expect(state.mails[0].to).toBe("hello@quickcals.test");
    expect(state.mails[0].text).toContain("Let me pin a meal to the top of the list.");
    // Who and what, because a suggestion with no context is a sentence with
    // nobody to go back to.
    expect(state.mails[0].text).toContain("alice");
    expect(state.mails[0].subject).toContain("idea");
  });

  it("still saves the suggestion when the email throws", async () => {
    state.mailFails = true;
    freshUser(102);
    const cookie = await signUp("alice");
    const res = await send(cookie, { kind: "problem", body: "The week nav sticks on Sundays." });

    expect(res.status).toBe(201);
    await settle();
    expect(state.suggestions).toHaveLength(1);
    expect(state.mails).toHaveLength(0);
  });

  it("still saves the suggestion when mail isn't configured at all", async () => {
    state.mailOn = false;
    freshUser(103);
    const cookie = await signUp("alice");
    const res = await send(cookie, { kind: "idea", body: "Dark mode on the weekly report." });

    expect(res.status).toBe(201);
    await settle();
    expect(state.suggestions).toHaveLength(1);
    expect(state.mails).toHaveLength(0);
  });
});
