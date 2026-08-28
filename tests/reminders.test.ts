import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  users: [] as { id: number; reminderHour: number | null }[],
  entries: [] as { timestamp: Date }[],
  sent: [] as { userId: number; title: string }[],
  /** Set to 0 to simulate a user with no subscribed device. */
  deliverCount: 1,
}));

vi.mock("../src/config", () => ({ config: { TIMEZONE: "Europe/London" } }));

vi.mock("../src/db", () => ({
  prisma: {
    user: {
      findMany: vi.fn(async ({ where }: any) =>
        state.users.filter((u) => u.reminderHour === where.reminderHour),
      ),
    },
    entry: {
      findMany: vi.fn(async ({ where }: any) =>
        state.entries.filter((e) => e.timestamp >= where.timestamp.gte),
      ),
    },
  },
}));

vi.mock("../src/push", () => ({
  sendToUser: vi.fn(async (userId: number, payload: { title: string }) => {
    if (state.deliverCount === 0) return 0;
    state.sent.push({ userId, title: payload.title });
    return state.deliverCount;
  }),
}));

import { sendDueReminders } from "../src/jobs/reminders";

/** 2026-06-15 is a Monday in BST, so local hour = UTC hour + 1. */
function atLocalHour(hour: number): Date {
  return new Date(Date.UTC(2026, 5, 15, hour - 1, 30));
}

beforeEach(() => {
  state.users.length = 0;
  state.entries.length = 0;
  state.sent.length = 0;
  state.deliverCount = 1;
});

describe("sendDueReminders", () => {
  it("says nothing to a user who never asked for a reminder", async () => {
    state.users.push({ id: 1, reminderHour: null });
    const sent = await sendDueReminders(atLocalHour(20));
    expect(sent).toBe(0);
    expect(state.sent).toHaveLength(0);
  });

  it("only fires in the hour the user chose", async () => {
    state.users.push({ id: 1, reminderHour: 20 });
    expect(await sendDueReminders(atLocalHour(19))).toBe(0);
    expect(await sendDueReminders(atLocalHour(21))).toBe(0);
    expect(await sendDueReminders(atLocalHour(20))).toBe(1);
  });

  it("nudges a user who hasn't logged today", async () => {
    state.users.push({ id: 1, reminderHour: 20 });
    const sent = await sendDueReminders(atLocalHour(20));
    expect(sent).toBe(1);
    expect(state.sent[0]!.title).toBe("Nothing logged today");
  });

  it("stays quiet once something has been logged today", async () => {
    state.users.push({ id: 1, reminderHour: 20 });
    // Midday local on the same day.
    state.entries.push({ timestamp: new Date(Date.UTC(2026, 5, 15, 11, 0)) });
    expect(await sendDueReminders(atLocalHour(20))).toBe(0);
  });

  it("still nudges when the only entry is from yesterday", async () => {
    state.users.push({ id: 1, reminderHour: 20 });
    state.entries.push({ timestamp: new Date(Date.UTC(2026, 5, 14, 11, 0)) });
    expect(await sendDueReminders(atLocalHour(20))).toBe(1);
  });

  it("counts a user as un-nudged when no device took the notification", async () => {
    state.users.push({ id: 1, reminderHour: 20 });
    state.deliverCount = 0;
    expect(await sendDueReminders(atLocalHour(20))).toBe(0);
  });
});
