import http from "node:http";
import express from "express";
import cookieParser from "cookie-parser";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  users: [] as any[],
  teams: [] as any[],
  members: [] as any[],
  entries: [] as any[],
  weighIns: [] as any[],
  nextUserId: 1,
  nextTeamId: 1,
  nextMemberId: 1,
}));

vi.mock("../src/config", () => ({
  config: { GOOGLE_SIGNIN_CLIENT_ID: undefined, TIMEZONE: "Europe/London" },
}));

vi.mock("../src/db", () => {
  const prisma: any = {
    user: {
      findUnique: vi.fn(async ({ where }: any) =>
        state.users.find((u) =>
          where.id !== undefined ? u.id === where.id : u.username === where.username,
        ) ?? null),
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
      upsert: vi.fn(async () => ({ id: 1, userId: 1 })),
      updateMany: vi.fn(async () => ({ count: 0 })),
    },
    setting: { upsert: vi.fn(async () => ({ key: "x", value: "y" })) },
    $transaction: vi.fn(async (arg: any) =>
      typeof arg === "function" ? arg(prisma) : Promise.all(arg),
    ),

    team: {
      create: vi.fn(async ({ data }: any) => {
        const { members, ...rest } = data;
        const team = { id: state.nextTeamId++, createdAt: new Date(), ...rest };
        state.teams.push(team);
        for (const m of members?.create ? [members.create] : []) {
          state.members.push({ id: state.nextMemberId++, teamId: team.id, joinedAt: new Date(), ...m });
        }
        return { ...team, members: state.members.filter((m) => m.teamId === team.id) };
      }),
      findUnique: vi.fn(async ({ where }: any) => {
        const team = state.teams.find((t) =>
          where.id !== undefined ? t.id === where.id : t.joinCode === where.joinCode,
        );
        return team ? { ...team, members: state.members.filter((m) => m.teamId === team.id) } : null;
      }),
      findUniqueOrThrow: vi.fn(async ({ where }: any) => {
        const team = state.teams.find((t) => t.id === where.id);
        if (!team) throw new Error("no team");
        return { ...team, members: state.members.filter((m) => m.teamId === team.id) };
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const team = state.teams.find((t) => t.id === where.id)!;
        Object.assign(team, data);
        return { ...team, members: state.members.filter((m) => m.teamId === team.id) };
      }),
      delete: vi.fn(async ({ where }: any) => {
        state.teams = state.teams.filter((t) => t.id !== where.id);
        return {};
      }),
    },
    teamMember: {
      findUnique: vi.fn(async ({ where }: any) => {
        const key = where.teamId_userId;
        const row = state.members.find((m) => m.teamId === key.teamId && m.userId === key.userId);
        if (!row) return null;
        const team = state.teams.find((t) => t.id === row.teamId);
        return { ...row, team };
      }),
      findMany: vi.fn(async ({ where }: any) => {
        const rows = state.members.filter(
          (m) =>
            (where?.teamId === undefined || m.teamId === where.teamId)
            && (where?.userId === undefined || m.userId === where.userId),
        );
        return rows.map((row) => {
          const team = state.teams.find((t) => t.id === row.teamId);
          const user = state.users.find((u) => u.id === row.userId);
          return {
            ...row,
            team: team ? { ...team, members: state.members.filter((m) => m.teamId === team.id) } : null,
            user: user ? { id: user.id, username: user.username } : null,
          };
        });
      }),
      findFirst: vi.fn(async ({ where }: any) =>
        state.members
          .filter((m) => m.teamId === where.teamId)
          .sort((a, b) => a.joinedAt.getTime() - b.joinedAt.getTime())[0] ?? null),
      create: vi.fn(async ({ data }: any) => {
        const row = { id: state.nextMemberId++, joinedAt: new Date(), ...data };
        state.members.push(row);
        return row;
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const row = state.members.find((m) => m.id === where.id)!;
        Object.assign(row, data);
        return row;
      }),
      deleteMany: vi.fn(async ({ where }: any) => {
        const before = state.members.length;
        state.members = state.members.filter(
          (m) => !(m.teamId === where.teamId && m.userId === where.userId),
        );
        return { count: before - state.members.length };
      }),
      count: vi.fn(async ({ where }: any) =>
        state.members.filter(
          (m) =>
            (where?.teamId === undefined || m.teamId === where.teamId)
            && (where?.userId === undefined || m.userId === where.userId),
        ).length),
    },
    entry: {
      findMany: vi.fn(async ({ where }: any) => {
        const ids: number[] = where?.matchWeek?.userId?.in ?? [];
        return state.entries
          .filter((e) => ids.includes(e.userId))
          .filter((e) => e.timestamp >= where.timestamp.gte && e.timestamp < where.timestamp.lt)
          .map((e) => ({ timestamp: e.timestamp, matchWeek: { userId: e.userId } }));
      }),
    },
    weighIn: {
      findMany: vi.fn(async ({ where }: any) => {
        const ids: number[] = where?.userId?.in ?? [];
        return state.weighIns
          .filter((w) => ids.includes(w.userId) && w.date >= where.date.gte && w.date <= where.date.lte)
          .sort((a, b) => (a.date < b.date ? -1 : 1));
      }),
    },
  };
  return { prisma };
});

import { authRouter } from "../src/routes/auth";
import { teamsRouter } from "../src/routes/teams";

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use("/api/auth", authRouter);
app.use("/api/teams", teamsRouter);

let server: http.Server;
let baseUrl: string;

beforeEach(async () => {
  state.users.length = 0;
  state.teams.length = 0;
  state.members.length = 0;
  state.entries.length = 0;
  state.weighIns.length = 0;
  state.nextUserId = 1;
  state.nextTeamId = 1;
  state.nextMemberId = 1;
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
  return { cookie: res.headers.get("set-cookie")!.split(";")[0]!, userId: body.id };
}

function post(path: string, cookie: string, body: unknown) {
  return fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify(body),
  });
}

describe("POST /api/teams", () => {
  it("creates a team and makes the creator its owner", async () => {
    const { cookie } = await signUp("alice");
    const res = await post("/api/teams", cookie, { name: "Thursday XI" });
    expect(res.status).toBe(201);

    const team = (await res.json()) as any;
    expect(team.name).toBe("Thursday XI");
    expect(team.role).toBe("owner");
    expect(team.memberCount).toBe(1);
    expect(team.joinCode).toMatch(/^[A-Z2-9]{6}$/);
  });

  it("gives the team the creator's own week, so a league has one fixture", async () => {
    const { cookie, userId } = await signUp("alice");
    state.users.find((u) => u.id === userId)!.weekStartWeekday = 2;
    state.users.find((u) => u.id === userId)!.weekStartHour = 9;

    const team = (await (await post("/api/teams", cookie, { name: "Wednesday club" })).json()) as any;
    expect(team.weekStart).toEqual({ weekday: 2, hour: 9, minute: 0 });
  });

  it("refuses an unauthenticated caller", async () => {
    const res = await fetch(`${baseUrl}/api/teams`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "x" }),
    });
    expect(res.status).toBe(401);
  });
});

describe("POST /api/teams/join", () => {
  it("joins by code, whatever case it was typed in", async () => {
    // The code gets read off a message or a whiteboard, and no two phones
    // agree about autocapitalisation.
    const alice = await signUp("alice");
    const team = (await (await post("/api/teams", alice.cookie, { name: "Thursday XI" })).json()) as any;

    const bob = await signUp("bob");
    const res = await post("/api/teams/join", bob.cookie, { code: team.joinCode.toLowerCase() });
    expect(res.status).toBe(201);
    expect(((await res.json()) as any).role).toBe("member");
  });

  it("is a flat 404 for a code that doesn't exist, so codes can't be probed", async () => {
    const { cookie } = await signUp("alice");
    expect((await post("/api/teams/join", cookie, { code: "ZZZZZZ" })).status).toBe(404);
  });

  it("is a no-op for somebody already in the team", async () => {
    const alice = await signUp("alice");
    const team = (await (await post("/api/teams", alice.cookie, { name: "Thursday XI" })).json()) as any;

    const res = await post("/api/teams/join", alice.cookie, { code: team.joinCode });
    expect(res.status).toBe(200);
    expect(state.members.filter((m) => m.teamId === team.id)).toHaveLength(1);
  });
});

describe("GET /api/teams/:id/table", () => {
  async function teamOfTwo() {
    const alice = await signUp("alice");
    const team = (await (await post("/api/teams", alice.cookie, { name: "Thursday XI" })).json()) as any;
    const bob = await signUp("bob");
    await post("/api/teams/join", bob.cookie, { code: team.joinCode });
    return { alice, bob, team };
  }

  it("ranks the members of the team", async () => {
    const { alice, bob, team } = await teamOfTwo();
    const today = new Date();
    const key = (d: Date) => d.toISOString().slice(0, 10);
    const earlier = new Date(today.getTime() - 2 * 86_400_000);

    state.weighIns.push(
      { userId: alice.userId, date: key(earlier), weightKg: 100 },
      { userId: alice.userId, date: key(today), weightKg: 99 },
      { userId: bob.userId, date: key(earlier), weightKg: 100 },
      { userId: bob.userId, date: key(today), weightKg: 98 },
    );

    const res = await fetch(`${baseUrl}/api/teams/${team.id}/table`, { headers: { Cookie: alice.cookie } });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.rows.map((r: any) => r.name)).toEqual(["bob", "alice"]);
  });

  it("gives nothing away about what anybody weighs or ate", async () => {
    // The table is a comparison of effort and outcome. Everything else on the
    // other side of it is somebody's diary.
    const { alice, team } = await teamOfTwo();
    const today = new Date();
    const key = (d: Date) => d.toISOString().slice(0, 10);
    state.weighIns.push(
      { userId: alice.userId, date: key(new Date(today.getTime() - 86_400_000)), weightKg: 96.4 },
      { userId: alice.userId, date: key(today), weightKg: 95.2 },
    );

    const body = await (await fetch(`${baseUrl}/api/teams/${team.id}/table`, {
      headers: { Cookie: alice.cookie },
    })).json();
    const serialised = JSON.stringify(body);
    expect(serialised).not.toContain("96.4");
    expect(serialised).not.toContain("95.2");
    expect(serialised).not.toContain("kcal");
  });

  it("is a 404 for a team you are not in, not a 403", async () => {
    // Same reason a share token is: an id that answers differently when it
    // exists is an id that can be enumerated.
    const { team } = await teamOfTwo();
    const carol = await signUp("carol");
    const res = await fetch(`${baseUrl}/api/teams/${team.id}/table`, { headers: { Cookie: carol.cookie } });
    expect(res.status).toBe(404);
  });

  it("refuses an unauthenticated caller", async () => {
    const { team } = await teamOfTwo();
    expect((await fetch(`${baseUrl}/api/teams/${team.id}/table`)).status).toBe(401);
  });
});

describe("leaving a team", () => {
  it("lets a member remove themselves", async () => {
    const alice = await signUp("alice");
    const team = (await (await post("/api/teams", alice.cookie, { name: "Thursday XI" })).json()) as any;
    const bob = await signUp("bob");
    await post("/api/teams/join", bob.cookie, { code: team.joinCode });

    const res = await fetch(`${baseUrl}/api/teams/${team.id}/members/${bob.userId}`, {
      method: "DELETE",
      headers: { Cookie: bob.cookie },
    });
    expect(res.status).toBe(200);
    expect(state.members.filter((m) => m.teamId === team.id)).toHaveLength(1);
  });

  it("won't let a member remove somebody else", async () => {
    const alice = await signUp("alice");
    const team = (await (await post("/api/teams", alice.cookie, { name: "Thursday XI" })).json()) as any;
    const bob = await signUp("bob");
    await post("/api/teams/join", bob.cookie, { code: team.joinCode });

    const res = await fetch(`${baseUrl}/api/teams/${team.id}/members/${alice.userId}`, {
      method: "DELETE",
      headers: { Cookie: bob.cookie },
    });
    expect(res.status).toBe(403);
  });

  it("hands the team on when its owner walks out", async () => {
    // Otherwise the team is left with nobody who can rename it or remove
    // anyone — a room with the key thrown away.
    const alice = await signUp("alice");
    const team = (await (await post("/api/teams", alice.cookie, { name: "Thursday XI" })).json()) as any;
    const bob = await signUp("bob");
    await post("/api/teams/join", bob.cookie, { code: team.joinCode });

    await fetch(`${baseUrl}/api/teams/${team.id}/members/${alice.userId}`, {
      method: "DELETE",
      headers: { Cookie: alice.cookie },
    });
    expect(state.members.find((m) => m.userId === bob.userId)!.role).toBe("owner");
  });

  it("deletes a team whose last member leaves", async () => {
    const alice = await signUp("alice");
    const team = (await (await post("/api/teams", alice.cookie, { name: "Thursday XI" })).json()) as any;

    const res = await fetch(`${baseUrl}/api/teams/${team.id}/members/${alice.userId}`, {
      method: "DELETE",
      headers: { Cookie: alice.cookie },
    });
    expect(((await res.json()) as any).teamDeleted).toBe(true);
    expect(state.teams).toHaveLength(0);
  });
});

describe("PATCH /api/teams/:id", () => {
  it("lets the owner rename it", async () => {
    const alice = await signUp("alice");
    const team = (await (await post("/api/teams", alice.cookie, { name: "Thursday XI" })).json()) as any;

    const res = await fetch(`${baseUrl}/api/teams/${team.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: alice.cookie },
      body: JSON.stringify({ name: "Thursday First XI" }),
    });
    expect(((await res.json()) as any).name).toBe("Thursday First XI");
  });

  it("won't let an ordinary member rename it", async () => {
    const alice = await signUp("alice");
    const team = (await (await post("/api/teams", alice.cookie, { name: "Thursday XI" })).json()) as any;
    const bob = await signUp("bob");
    await post("/api/teams/join", bob.cookie, { code: team.joinCode });

    const res = await fetch(`${baseUrl}/api/teams/${team.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: bob.cookie },
      body: JSON.stringify({ name: "Bob's team" }),
    });
    expect(res.status).toBe(403);
  });
});
