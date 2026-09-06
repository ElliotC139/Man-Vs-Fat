import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  users: [] as {
    id: number;
    reminderHour: number | null;
    mealReminders?: string | null;
    mealTagNames?: string | null;
  }[],
  entries: [] as { timestamp: Date; mealType?: string | null }[],
  sent: [] as { userId: number; title: string; tag?: string }[],
  /** Set to 0 to simulate a user with no subscribed device. */
  deliverCount: 1,
}));

vi.mock("../src/config", () => ({ config: { TIMEZONE: "Europe/London" } }));

vi.mock("../src/db", () => ({
  prisma: {
    user: {
      // Two callers now: the daily nudge filters by the hour, the meal one by
      // having any meal reminder stored at all.
      findMany: vi.fn(async ({ where }: any) =>
        where.mealReminders
          ? state.users.filter((u) => u.mealReminders != null)
          : state.users.filter((u) => u.reminderHour === where.reminderHour),
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
  sendToUser: vi.fn(async (userId: number, payload: { title: string; tag?: string }) => {
    if (state.deliverCount === 0) return 0;
    state.sent.push({ userId, title: payload.title, tag: payload.tag });
    return state.deliverCount;
  }),
}));

import { sendDueMealReminders, sendDueReminders } from "../src/jobs/reminders";

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


describe("sendDueMealReminders", () => {
  it("says nothing to a user who has set no meal reminders", async () => {
    state.users.push({ id: 1, reminderHour: null, mealReminders: null });
    expect(await sendDueMealReminders(atLocalHour(13))).toBe(0);
  });

  it("nudges about the meal whose hour it is, and no other", async () => {
    state.users.push({
      id: 1,
      reminderHour: null,
      mealReminders: JSON.stringify({ breakfast: 9, lunch: 13, dinner: 19 }),
    });

    expect(await sendDueMealReminders(atLocalHour(13))).toBe(1);
    expect(state.sent).toEqual([
      { userId: 1, title: "Lunch not logged", tag: "meal-reminder-lunch" },
    ]);
  });

  it("stays quiet about a meal that has already been logged", async () => {
    // A reminder that arrives after you've done the thing is the fastest way
    // to get an app's notifications switched off.
    state.users.push({ id: 1, reminderHour: null, mealReminders: JSON.stringify({ lunch: 13 }) });
    state.entries.push({ timestamp: atLocalHour(12), mealType: "lunch" });

    expect(await sendDueMealReminders(atLocalHour(13))).toBe(0);
  });

  it("counts a slot the clock guessed, not only one the user chose", async () => {
    // The question is whether anything that looks like lunch got logged, not
    // whether this person has ever tagged anything.
    state.users.push({ id: 1, reminderHour: null, mealReminders: JSON.stringify({ lunch: 13 }) });
    state.entries.push({ timestamp: atLocalHour(12), mealType: "lunch" });

    expect(await sendDueMealReminders(atLocalHour(13))).toBe(0);
  });

  it("still nudges when the day has entries filed under other meals", async () => {
    state.users.push({ id: 1, reminderHour: null, mealReminders: JSON.stringify({ lunch: 13 }) });
    state.entries.push({ timestamp: atLocalHour(8), mealType: "breakfast" });

    expect(await sendDueMealReminders(atLocalHour(13))).toBe(1);
  });

  it("ignores an untagged entry, which belongs to no slot", async () => {
    state.users.push({ id: 1, reminderHour: null, mealReminders: JSON.stringify({ lunch: 13 }) });
    state.entries.push({ timestamp: atLocalHour(12), mealType: null });

    expect(await sendDueMealReminders(atLocalHour(13))).toBe(1);
  });

  it("uses the user's own name for the slot", async () => {
    state.users.push({
      id: 1,
      reminderHour: null,
      mealReminders: JSON.stringify({ dinner: 19 }),
      mealTagNames: JSON.stringify({ dinner: "Tea" }),
    });

    await sendDueMealReminders(atLocalHour(19));
    expect(state.sent[0]!.title).toBe("Tea not logged");
  });

  it("sends about two meals set to the same hour", async () => {
    state.users.push({
      id: 1,
      reminderHour: null,
      mealReminders: JSON.stringify({ dinner: 19, snack: 19 }),
    });

    expect(await sendDueMealReminders(atLocalHour(19))).toBe(2);
  });

  it("survives a meal reminder column that isn't readable", async () => {
    // The worst a bad row should cost is one nudge that doesn't arrive, never
    // the run stopping for everyone else.
    state.users.push({ id: 1, reminderHour: null, mealReminders: "not json" });
    state.users.push({ id: 2, reminderHour: null, mealReminders: JSON.stringify({ lunch: 13 }) });

    expect(await sendDueMealReminders(atLocalHour(13))).toBe(1);
    expect(state.sent[0]!.userId).toBe(2);
  });

  it("counts nothing sent when the user has no subscribed device", async () => {
    state.users.push({ id: 1, reminderHour: null, mealReminders: JSON.stringify({ lunch: 13 }) });
    state.deliverCount = 0;

    expect(await sendDueMealReminders(atLocalHour(13))).toBe(0);
  });
});
