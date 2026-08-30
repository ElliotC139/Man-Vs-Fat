import { describe, expect, it, vi } from "vitest";

// requireAuth now reads User.sessionsValidFrom on every request (that's what
// makes "sign out everywhere" possible against a stateless token), so the
// mock needs a user table as well as the settings one.
const userStore = new Map<number, { id: number; sessionsValidFrom: Date | null }>();

function fakeUser(id: number) {
  const existing = userStore.get(id);
  if (existing) return existing;
  const created = { id, sessionsValidFrom: null };
  userStore.set(id, created);
  return created;
}

vi.mock("../src/db", () => {
  const settingStore = new Map<string, string>();
  return {
    prisma: {
      setting: {
        upsert: vi.fn(async ({ where, create }: any) => {
          if (!settingStore.has(where.key)) settingStore.set(where.key, create.value);
          return { key: where.key, value: settingStore.get(where.key)! };
        }),
      },
      user: {
        // Every id in these tests is a real account; the interesting variable
        // is sessionsValidFrom, not whether the row exists.
        findUnique: vi.fn(async ({ where }: any) => fakeUser(where.id)),
        update: vi.fn(async ({ where, data }: any) => {
          const user = fakeUser(where.id);
          Object.assign(user, data);
          return user;
        }),
      },
    },
  };
});

import {
  requireAuth,
  setSessionCookie,
  clearSessionCookie,
  hashPassword,
  verifyPassword,
  revokeAllSessions,
  SESSION_COOKIE_NAME,
} from "../src/auth";

function fakeRes() {
  const cookies: Record<string, string> = {};
  return {
    cookies,
    cookie: vi.fn((name: string, value: string) => {
      cookies[name] = value;
    }),
    clearCookie: vi.fn((name: string) => {
      delete cookies[name];
    }),
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as any;
}

describe("hashPassword / verifyPassword", () => {
  it("verifies a correct password and rejects an incorrect one", async () => {
    const hash = await hashPassword("correct-horse-battery");
    expect(await verifyPassword("correct-horse-battery", hash)).toBe(true);
    expect(await verifyPassword("wrong-password", hash)).toBe(false);
  });
});

describe("requireAuth", () => {
  it("rejects a request with no session cookie", async () => {
    const req: any = { cookies: {} };
    const res = fakeRes();
    const next = vi.fn();

    await requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("rejects a malformed session cookie", async () => {
    const req: any = { cookies: { [SESSION_COOKIE_NAME]: "not-a-valid-token" } };
    const res = fakeRes();
    const next = vi.fn();

    await requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("populates req.userId for a valid session cookie", async () => {
    const setRes = fakeRes();
    await setSessionCookie(setRes, 42);

    const req: any = { cookies: { [SESSION_COOKIE_NAME]: setRes.cookies[SESSION_COOKIE_NAME] } };
    const next = vi.fn();
    await requireAuth(req, fakeRes(), next);

    expect(req.userId).toBe(42);
    expect(next).toHaveBeenCalled();
  });

  it("rejects a session cookie with a tampered user id", async () => {
    const setRes = fakeRes();
    await setSessionCookie(setRes, 42);

    const parts = setRes.cookies[SESSION_COOKIE_NAME]!.split(".");
    parts[0] = String(Number(parts[0]) + 1);
    const tampered = parts.join(".");

    const req: any = { cookies: { [SESSION_COOKIE_NAME]: tampered } };
    const res = fakeRes();
    const next = vi.fn();
    await requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("issues independently valid cookies for two different users", async () => {
    const resA = fakeRes();
    const resB = fakeRes();
    await setSessionCookie(resA, 1);
    await setSessionCookie(resB, 2);

    const reqA: any = { cookies: { [SESSION_COOKIE_NAME]: resA.cookies[SESSION_COOKIE_NAME] } };
    const reqB: any = { cookies: { [SESSION_COOKIE_NAME]: resB.cookies[SESSION_COOKIE_NAME] } };
    const nextA = vi.fn();
    const nextB = vi.fn();

    await requireAuth(reqA, fakeRes(), nextA);
    await requireAuth(reqB, fakeRes(), nextB);

    expect(reqA.userId).toBe(1);
    expect(reqB.userId).toBe(2);
  });
});

describe("clearSessionCookie", () => {
  it("clears the session cookie", () => {
    const res = fakeRes();
    clearSessionCookie(res);
    expect(res.clearCookie).toHaveBeenCalledWith(SESSION_COOKIE_NAME);
  });
});

describe("revokeAllSessions", () => {
  it("rejects a token issued before the revocation and accepts one issued after", async () => {
    const before = fakeRes();
    await setSessionCookie(before, 1);
    const oldToken = before.cookies[SESSION_COOKIE_NAME]!;

    await revokeAllSessions(1);

    const rejectedReq: any = { cookies: { [SESSION_COOKIE_NAME]: oldToken } };
    const rejectedRes = fakeRes();
    const rejectedNext = vi.fn();
    await requireAuth(rejectedReq, rejectedRes, rejectedNext);
    expect(rejectedNext).not.toHaveBeenCalled();
    expect(rejectedRes.status).toHaveBeenCalledWith(401);

    // revokeAllSessions stamps one second into the future so a token minted
    // in the same millisecond can't survive it — a replacement token has to
    // be issued past that stamp to be accepted.
    vi.useFakeTimers();
    vi.setSystemTime(new Date(Date.now() + 2000));
    const after = fakeRes();
    await setSessionCookie(after, 1);
    const newToken = after.cookies[SESSION_COOKIE_NAME]!;
    vi.useRealTimers();

    const acceptedReq: any = { cookies: { [SESSION_COOKIE_NAME]: newToken } };
    const acceptedRes = fakeRes();
    const acceptedNext = vi.fn();
    await requireAuth(acceptedReq, acceptedRes, acceptedNext);
    expect(acceptedNext).toHaveBeenCalled();
    expect(acceptedReq.userId).toBe(1);
  });

  it("leaves other users' sessions alone", async () => {
    const res = fakeRes();
    await setSessionCookie(res, 2);
    const token = res.cookies[SESSION_COOKIE_NAME]!;

    await revokeAllSessions(1);

    const req: any = { cookies: { [SESSION_COOKIE_NAME]: token } };
    const next = vi.fn();
    await requireAuth(req, fakeRes(), next);
    expect(req.userId).toBe(2);
  });
});
