import { describe, expect, it, vi } from "vitest";

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
    },
  };
});

import { requireAuth, setSessionCookie, clearSessionCookie, hashPassword, verifyPassword, SESSION_COOKIE_NAME } from "../src/auth";

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
