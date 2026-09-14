import http from "node:http";
import express from "express";
import cookieParser from "cookie-parser";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * An endpoint with no login on it.
 *
 * Everything else in this app sits behind requireAuth. This one deliberately
 * does not, because the people worth hearing from here are the ones who never
 * made an account — and that makes it the piece of surface most worth testing.
 * These are mostly about what it refuses.
 */

const state = vi.hoisted(() => ({
  votes: [] as any[],
  nextId: 1,
}));

vi.mock("../src/config", () => ({
  adminUsernames: [],
  config: { TIMEZONE: "Europe/London", GOOGLE_SIGNIN_CLIENT_ID: undefined },
}));

vi.mock("../src/db", () => ({
  prisma: {
    roadmapVote: {
      create: vi.fn(async ({ data }: any) => {
        // Mirrors the two unique indexes, because their behaviour is what the
        // duplicate path depends on.
        const clash = state.votes.some(
          (v) =>
            v.itemId === data.itemId &&
            ((data.browserKey != null && v.browserKey === data.browserKey) ||
              (data.email != null && v.email === data.email) ||
              (data.userId != null && v.userId === data.userId)),
        );
        if (clash) {
          const error: any = new Error("Unique constraint failed");
          error.code = "P2002";
          throw error;
        }
        const row = { id: state.nextId++, createdAt: new Date(), ...data };
        state.votes.push(row);
        return row;
      }),
      updateMany: vi.fn(async ({ where, data }: any) => {
        const rows = state.votes.filter(
          (v) =>
            v.itemId === where.itemId &&
            v.browserKey === where.browserKey &&
            v.userId === where.userId,
        );
        for (const row of rows) Object.assign(row, data);
        return { count: rows.length };
      }),
      findMany: vi.fn(async ({ where }: any) =>
        state.votes.filter((v) => v.userId === where.userId)),
    },
  },
}));

// Signed out by default — the situation the route is built for — but some of
// these are about the signed-in half, so it has to be steerable.
const session = vi.hoisted(() => ({ userId: null as number | null }));
vi.mock("../src/auth", () => ({ sessionUserId: vi.fn(async () => session.userId) }));

import { roadmapRouter } from "../src/routes/roadmap";
import { ROADMAP } from "../src/roadmap";
import { resetAll } from "../src/rateLimit";

let server: http.Server;
let baseUrl: string;

beforeEach(async () => {
  state.votes.length = 0;
  state.nextId = 1;
  session.userId = null;
  resetAll();

  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use("/api/roadmap", roadmapRouter);
  server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as any).port}`;
});

afterEach(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

const vote = (body: unknown) =>
  fetch(`${baseUrl}/api/roadmap/vote`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

describe("reading the list", () => {
  it("hands back every item", async () => {
    const res = await fetch(`${baseUrl}/api/roadmap`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.items.map((i: any) => i.id)).toEqual(ROADMAP.map((i) => i.id));
  });
});

describe("what it refuses", () => {
  it("will not record an item that isn't on the list", async () => {
    // The only thing standing between an open endpoint and a table full of
    // whatever somebody posts.
    for (const itemId of ["", "not-a-thing", "../../admin", "apple-watch "]) {
      const res = await vote({ itemId });
      expect(res.status, `accepted ${JSON.stringify(itemId)}`).toBe(400);
    }
    expect(state.votes).toHaveLength(0);
  });

  it("will not record a malformed address", async () => {
    const res = await vote({ itemId: "apple-watch", email: "not an email" });
    expect(res.status).toBe(400);
    expect(state.votes).toHaveLength(0);
  });

  it("will not take an address long enough to be a payload", async () => {
    const res = await vote({ itemId: "apple-watch", email: `${"a".repeat(300)}@example.com` });
    expect(res.status).toBe(400);
  });

  it("stops one caller flooding the table", async () => {
    // Generous, because a household behind one address is several real votes.
    // The point is that it is bounded at all.
    let refused = 0;
    for (let i = 0; i < 40; i += 1) {
      const res = await vote({ itemId: "fitbit", browserKey: `browser-${i}-aaaaaaaa` });
      if (res.status === 429) refused += 1;
    }
    expect(refused).toBeGreaterThan(0);
  });
});

describe("what it records", () => {
  it("takes a vote with nothing but an item id", async () => {
    // Demanding an address would cost more signal than the address is worth.
    const res = await vote({ itemId: "apple-watch" });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ recorded: true, duplicate: false });
    expect(state.votes[0]).toMatchObject({ itemId: "apple-watch", email: null, userId: null });
  });

  it("lower-cases the address so one person is one row", async () => {
    await vote({ itemId: "fitbit", email: "Elliot@Example.COM" });
    expect(state.votes[0].email).toBe("elliot@example.com");
  });

  it("says noted to a second tap instead of counting it twice", async () => {
    const key = "browser-key-12345678";
    await vote({ itemId: "garmin", browserKey: key });
    const again = await vote({ itemId: "garmin", browserKey: key });

    expect(again.status).toBe(200);
    expect(await again.json()).toMatchObject({ recorded: true, duplicate: true });
    expect(state.votes).toHaveLength(1);
  });

  it("lets one browser vote for different things", async () => {
    const key = "browser-key-12345678";
    await vote({ itemId: "garmin", browserKey: key });
    await vote({ itemId: "oura", browserKey: key });
    expect(state.votes).toHaveLength(2);
  });

  it("lets different browsers vote for the same thing", async () => {
    await vote({ itemId: "oura", browserKey: "browser-aaaaaaaa" });
    await vote({ itemId: "oura", browserKey: "browser-bbbbbbbb" });
    expect(state.votes).toHaveLength(2);
  });
});

describe("when the database is the problem", () => {
  it("says so rather than claiming the vote landed", async () => {
    // The bug this replaced: a bare catch answered "recorded" for every
    // failure, including the database being unreachable. A feature whose
    // entire output is a count must not lie about whether it counted.
    const { prisma } = await import("../src/db");
    (prisma.roadmapVote.create as any).mockImplementationOnce(async () => {
      throw new Error("database is locked");
    });

    const res = await vote({ itemId: "alcohol" });
    expect(res.status).toBe(500);
    expect((await res.json()) as any).not.toMatchObject({ recorded: true });
  });
});

describe("voting while signed in", () => {
  it("records who cast it", async () => {
    session.userId = 42;
    await vote({ itemId: "apple-watch" });
    expect(state.votes[0]).toMatchObject({ itemId: "apple-watch", userId: 42 });
  });

  it("counts one person once, however many devices they use", async () => {
    // The question this table answers is how many *people* want a thing.
    session.userId = 42;
    await vote({ itemId: "fitbit" });
    const fromTheLaptop = await vote({ itemId: "fitbit" });

    expect(await fromTheLaptop.json()).toMatchObject({ duplicate: true });
    expect(state.votes).toHaveLength(1);
  });

  it("still lets one person vote for several things", async () => {
    session.userId = 42;
    await vote({ itemId: "fitbit" });
    await vote({ itemId: "garmin" });
    expect(state.votes).toHaveLength(2);
  });

  it("does not merge two accounts' votes", async () => {
    session.userId = 1;
    await vote({ itemId: "oura" });
    session.userId = 2;
    await vote({ itemId: "oura" });
    expect(state.votes).toHaveLength(2);
  });
});

describe("the visitor who signs up afterwards", () => {
  it("attaches their account to the vote they cast signed out", async () => {
    // Read the landing page, voted, liked it, made an account, found the same
    // board in Settings and tapped again. The second tap collides on the
    // browser key — correctly, it is the same person — but the row we hold is
    // anonymous, and discarding the tap would lose the one new fact.
    const key = "browser-key-12345678";
    await vote({ itemId: "coach-access", browserKey: key });
    expect(state.votes[0].userId).toBeNull();

    session.userId = 7;
    const again = await vote({ itemId: "coach-access", browserKey: key });

    expect(await again.json()).toMatchObject({ duplicate: true });
    expect(state.votes).toHaveLength(1);
    expect(state.votes[0].userId).toBe(7);
  });

  it("never moves a vote from one account to another", async () => {
    // The upgrade above only ever fills a blank. A shared browser must not
    // hand somebody else's vote to whoever signs in next.
    const key = "browser-key-12345678";
    session.userId = 7;
    await vote({ itemId: "household", browserKey: key });

    session.userId = 8;
    await vote({ itemId: "household", browserKey: key });

    expect(state.votes).toHaveLength(1);
    expect(state.votes[0].userId).toBe(7);
  });
});

describe("what this person already voted for", () => {
  it("is empty for somebody signed out, rather than a 401", async () => {
    // One renderer serves the landing page and the app, so this has to answer
    // both without the caller checking which it is.
    const res = await fetch(`${baseUrl}/api/roadmap/mine`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ voted: [] });
  });

  it("lists their votes from any device, not this browser's storage", async () => {
    session.userId = 42;
    await vote({ itemId: "apple-watch" });
    await vote({ itemId: "plan-ahead" });

    const res = await fetch(`${baseUrl}/api/roadmap/mine`);
    expect(((await res.json()) as any).voted.sort()).toEqual(["apple-watch", "plan-ahead"]);
  });

  it("shows one person nothing of anybody else's", async () => {
    session.userId = 1;
    await vote({ itemId: "oura" });
    session.userId = 2;

    expect(((await (await fetch(`${baseUrl}/api/roadmap/mine`)).json()) as any).voted).toEqual([]);
  });
});
