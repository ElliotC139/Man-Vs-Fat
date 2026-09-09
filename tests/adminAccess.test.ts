import { describe, expect, it, vi } from "vitest";

/**
 * "I am the only admin" is not a state you can reach by unticking boxes:
 * whoever holds the flag can hand it out again, and a flag granted by mistake
 * stays granted until somebody notices. A list in the deployment's own
 * configuration is a fact about the deployment.
 */

vi.mock("../src/config", () => ({
  config: {},
  adminUsernames: ["elliot", "someoneelse"],
}));
vi.mock("../src/db", () => ({ prisma: {} }));

import { adminListConfigured, isAdminUser } from "../src/adminAccess";

describe("with a list configured", () => {
  it("says the listed accounts are admins, whatever the stored flag says", () => {
    expect(adminListConfigured()).toBe(true);
    expect(isAdminUser({ username: "elliot", isAdmin: false })).toBe(true);
  });

  it("takes it away from an account that isn't listed", () => {
    // The half that makes the promise hold. Without it, "only me" lasts until
    // somebody grants it to somebody else.
    expect(isAdminUser({ username: "someone", isAdmin: true })).toBe(false);
  });

  it("matches a name however it was typed", () => {
    // A username in a Fly secret and a username in a sign-in box are the same
    // name to the person typing them.
    expect(isAdminUser({ username: "Elliot", isAdmin: false })).toBe(true);
    expect(isAdminUser({ username: "  ELLIOT  ", isAdmin: false })).toBe(true);
  });
});

describe("with no list configured", () => {
  it("falls back to the stored flag", async () => {
    vi.resetModules();
    vi.doMock("../src/config", () => ({ config: {}, adminUsernames: [] }));
    vi.doMock("../src/db", () => ({ prisma: {} }));
    const fresh = await import("../src/adminAccess");

    expect(fresh.adminListConfigured()).toBe(false);
    expect(fresh.isAdminUser({ username: "anyone", isAdmin: true })).toBe(true);
    expect(fresh.isAdminUser({ username: "anyone", isAdmin: false })).toBe(false);
    // Absent reads as no, not as yes.
    expect(fresh.isAdminUser({ username: "anyone" })).toBe(false);
  });
});
