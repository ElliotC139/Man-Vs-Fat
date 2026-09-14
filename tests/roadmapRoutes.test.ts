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
              (data.email != null && v.email === data.email)),
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
    },
  },
}));

// No session in any of these, which is the situation the route is built for.
vi.mock("../src/auth", () => ({ sessionUserId: vi.fn(async () => null) }));

import { roadmapRouter } from "../src/routes/roadmap";
import { ROADMAP } from "../src/roadmap";
import { resetAll } from "../src/rateLimit";

let server: http.Server;
let baseUrl: string;

beforeEach(async () => {
  state.votes.length = 0;
  state.nextId = 1;
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
