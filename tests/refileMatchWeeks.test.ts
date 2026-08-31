import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Changing the rollover re-slices every week already logged. Entries are
 * filed against a week's exact boundaries, so without re-filing the diary
 * shows an empty week and it reads as though the history has been lost.
 */
const state = vi.hoisted(() => ({
  weeks: [] as any[],
  entries: [] as any[],
  exercises: [] as any[],
  nextWeekId: 100,
}));

vi.mock("../src/config", () => ({ config: { TIMEZONE: "Europe/London" } }));

vi.mock("../src/db", () => {
  const prisma: any = {
    matchWeek: {
      findMany: vi.fn(async ({ where, select }: any) => {
        let rows = state.weeks.filter((w) => w.userId === where.userId);
        if (where.reportDriveFileId === null) rows = rows.filter((w) => w.reportDriveFileId == null);
        if (where.entries?.none) rows = rows.filter((w) => !state.entries.some((e) => e.matchWeekId === w.id));
        if (where.exercises?.none) rows = rows.filter((w) => !state.exercises.some((x) => x.matchWeekId === w.id));
        if (select) return rows.map((w) => ({ id: w.id }));
        return rows.map((w) => ({
          ...w,
          entries: state.entries.filter((e) => e.matchWeekId === w.id).map((e) => ({ id: e.id, timestamp: e.timestamp })),
          exercises: state.exercises.filter((x) => x.matchWeekId === w.id).map((x) => ({ id: x.id, timestamp: x.timestamp })),
        }));
      }),
      upsert: vi.fn(async ({ where, create }: any) => {
        const key = where.userId_startsAt_endsAt;
        const existing = state.weeks.find(
          (w) => w.userId === key.userId
            && w.startsAt.getTime() === key.startsAt.getTime()
            && w.endsAt.getTime() === key.endsAt.getTime(),
        );
        if (existing) return existing;
        const created = { id: state.nextWeekId++, reportDriveFileId: null, insightsJson: null, ...create };
        state.weeks.push(created);
        return created;
      }),
      updateMany: vi.fn(async ({ where, data }: any) => {
        let count = 0;
        for (const week of state.weeks) {
          if (week.userId !== where.userId) continue;
          if (where.insightsJson?.not === null && week.insightsJson == null) continue;
          Object.assign(week, data);
          count += 1;
        }
        return { count };
      }),
      deleteMany: vi.fn(async ({ where }: any) => {
        const ids: number[] = where.id.in;
        const before = state.weeks.length;
        state.weeks = state.weeks.filter((w) => !ids.includes(w.id));
        return { count: before - state.weeks.length };
      }),
    },
    entry: {
      updateMany: vi.fn(async ({ where, data }: any) => {
        let count = 0;
        for (const entry of state.entries) {
          if (!where.id.in.includes(entry.id)) continue;
          Object.assign(entry, data);
          count += 1;
        }
        return { count };
      }),
    },
    exercise: {
      updateMany: vi.fn(async ({ where, data }: any) => {
        let count = 0;
        for (const exercise of state.exercises) {
          if (!where.id.in.includes(exercise.id)) continue;
          Object.assign(exercise, data);
          count += 1;
        }
        return { count };
      }),
    },
  };
  return { prisma };
});

import { refileMatchWeeks } from "../src/refileMatchWeeks";
import { getMatchWeekBoundaries } from "../src/matchWeek";

const TZ = "Europe/London";
const MID_DAY = { weekday: 0, hour: 17, minute: 0 };
const WHOLE_DAY = { weekday: 0, hour: 0, minute: 0 };

/** Files a set of timestamps into weeks the way the app would, under `config`. */
function seed(timestamps: string[], weekStart: { weekday: number; hour: number; minute: number }) {
  let entryId = 1;
  for (const iso of timestamps) {
    const timestamp = new Date(iso);
    const { start, end } = getMatchWeekBoundaries(timestamp, TZ, weekStart);
    let week = state.weeks.find(
      (w) => w.startsAt.getTime() === start.getTime() && w.endsAt.getTime() === end.getTime(),
    );
    if (!week) {
      week = { id: state.nextWeekId++, userId: 1, startsAt: start, endsAt: end, reportDriveFileId: null, insightsJson: null };
      state.weeks.push(week);
    }
    state.entries.push({ id: entryId++, matchWeekId: week.id, timestamp });
  }
}

beforeEach(() => {
  state.weeks.length = 0;
  state.entries.length = 0;
  state.exercises.length = 0;
  state.nextWeekId = 100;
  vi.clearAllMocks();
});

describe("refileMatchWeeks", () => {
  it("moves entries the new boundaries put in a different week", async () => {
    // Monday midday. Under a 17:00 rollover this belongs to the week that's
    // closing; under a whole-day week it opens the new one.
    seed(["2026-08-31T11:00:00Z"], MID_DAY);
    const originalWeekId = state.entries[0].matchWeekId;

    const result = await refileMatchWeeks(1, WHOLE_DAY);

    expect(result.entriesMoved).toBe(1);
    expect(state.entries[0].matchWeekId).not.toBe(originalWeekId);

    const newWeek = state.weeks.find((w) => w.id === state.entries[0].matchWeekId)!;
    expect(newWeek.startsAt.toISOString()).toBe("2026-08-30T23:00:00.000Z");
  });

  it("leaves entries alone when the new boundaries agree with the old", async () => {
    seed(["2026-09-02T12:00:00Z", "2026-09-03T12:00:00Z"], MID_DAY);
    const before = state.entries.map((e) => e.matchWeekId);

    const result = await refileMatchWeeks(1, MID_DAY);

    expect(result.entriesMoved).toBe(0);
    expect(state.entries.map((e) => e.matchWeekId)).toEqual(before);
  });

  it("keeps every entry — re-filing must never drop one", async () => {
    const week = [
      "2026-08-31T12:00:00Z", "2026-09-01T12:00:00Z", "2026-09-02T12:00:00Z",
      "2026-09-03T12:00:00Z", "2026-09-04T12:00:00Z", "2026-09-05T12:00:00Z",
      "2026-09-06T12:00:00Z",
    ];
    seed(week, WHOLE_DAY);

    await refileMatchWeeks(1, MID_DAY);
    expect(state.entries).toHaveLength(7);
    // Every entry still points at a week that exists.
    for (const entry of state.entries) {
      expect(state.weeks.some((w) => w.id === entry.matchWeekId)).toBe(true);
    }
  });

  it("tidies away weeks left empty", async () => {
    seed(["2026-08-31T11:00:00Z"], MID_DAY);
    expect(state.weeks).toHaveLength(1);

    const result = await refileMatchWeeks(1, WHOLE_DAY);

    // The old week gave up its only entry, so it goes; the new one stays.
    expect(result.weeksRemoved).toBe(1);
    expect(state.weeks).toHaveLength(1);
  });

  it("never removes a week that has a report filed in Drive", async () => {
    seed(["2026-08-31T11:00:00Z"], MID_DAY);
    state.weeks[0].reportDriveFileId = "drive-file-123";

    await refileMatchWeeks(1, WHOLE_DAY);

    // Emptied, but it's the record of a report that really was produced.
    expect(state.weeks.some((w) => w.reportDriveFileId === "drive-file-123")).toBe(true);
  });

  it("clears cached weekly reviews, which now describe different days", async () => {
    seed(["2026-08-31T11:00:00Z"], MID_DAY);
    state.weeks[0].insightsJson = '{"wentWell":["..."]}';
    state.weeks[0].reportDriveFileId = "keep-me";

    await refileMatchWeeks(1, WHOLE_DAY);

    expect(state.weeks.find((w) => w.reportDriveFileId === "keep-me")!.insightsJson).toBeNull();
  });
});
