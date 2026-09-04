import http from "node:http";
import express from "express";
import cookieParser from "cookie-parser";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The wiring between the diary and the suggestion engine: which foods reach
 * it, at which figures, and what the card is told about the day. The ranking
 * itself is covered in whatNow.test.ts.
 */
const state = vi.hoisted(() => ({
  users: [] as any[],
  entries: [] as any[],
  overrides: [] as any[],
  meals: [] as any[],
  exercises: [] as any[],
  cycles: [] as any[],
  adaptive: null as any,
  nextId: 1,
}));

vi.mock("../src/config", () => ({
  config: { TIMEZONE: "Europe/London", GOOGLE_SIGNIN_CLIENT_ID: undefined },
}));

vi.mock("../src/whoop/sync", () => ({ getRecentSleepRecovery: vi.fn(async () => []) }));

// The adaptive estimate does its own querying and has its own tests; here it is
// just one more candidate for the day's expected burn, so the tests set what it
// says rather than building up weeks of weigh-ins to make it say it.
vi.mock("../src/adaptiveTdee", () => ({
  estimateAdaptiveTdee: vi.fn(async () => state.adaptive ?? { kcalPerDay: null, reason: "no-weigh-ins" }),
  isAdaptiveTdeeAvailable: (result: any) => result?.kcalPerDay !== null,
}));

vi.mock("../src/db", () => {
  const prisma: any = {
    user: {
      findUnique: vi.fn(async ({ where }: any) =>
        state.users.find((u) => (where.id !== undefined ? u.id === where.id : u.username === where.username)) ?? null,
      ),
      findUniqueOrThrow: vi.fn(async ({ where }: any) => state.users.find((u) => u.id === where.id)),
      create: vi.fn(async ({ data }: any) => {
        const user = {
          id: state.nextId++,
          weekStartWeekday: 0,
          weekStartHour: 17,
          weekStartMinute: 0,
          dailyCalorieTarget: null,
          macroMode: null,
          weightKg: null,
          heightCm: null,
          ageYears: null,
          activityLevel: null,
          sex: null,
          sessionsValidFrom: null,
          ...data,
        };
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
    matchWeek: { updateMany: vi.fn(async () => ({ count: 0 })) },
    setting: { upsert: vi.fn(async ({ where, create }: any) => ({ key: where.key, value: create.value })) },
    entry: {
      findMany: vi.fn(async ({ where }: any = {}) => {
        const range = where?.timestamp;
        if (!range) return state.entries;
        return state.entries.filter((row) => {
          if (range.gte && row.timestamp < range.gte) return false;
          if (range.lt && row.timestamp >= range.lt) return false;
          return true;
        });
      }),
    },
    foodOverride: { findMany: vi.fn(async () => state.overrides) },
    exercise: { findMany: vi.fn(async () => state.exercises) },
    whoopCycle: { findMany: vi.fn(async () => state.cycles) },
    savedMeal: { findMany: vi.fn(async () => state.meals) },
    $transaction: vi.fn(async (arg: any) => (Array.isArray(arg) ? Promise.all(arg) : arg(prisma))),
  };
  return { prisma };
});

import { authRouter } from "../src/routes/auth";
import { statsRouter } from "../src/routes/stats";

let server: http.Server;
let baseUrl: string;

beforeEach(async () => {
  for (const key of ["users", "entries", "overrides", "meals", "exercises", "cycles"] as const) state[key].length = 0;
  state.adaptive = null;
  state.nextId = 1;
  vi.clearAllMocks();

  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use("/api/auth", authRouter);
  app.use("/api/stats", statsRouter);
  server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  baseUrl = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
});

afterEach(async () => {
  await new Promise((resolve) => server.close(resolve));
});

async function signUp(fields: Record<string, unknown> = {}): Promise<string> {
  const res = await fetch(`${baseUrl}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "alice", password: "password123" }),
  });
  Object.assign(state.users[0], fields);
  return res.headers.getSetCookie().find((c) => c.startsWith("session="))!.split(";")[0]!;
}

/** Puts an entry on the diary, `daysAgo` days back (0 is today). */
function log(daysAgo: number, fields: Record<string, unknown>) {
  state.entries.push({
    id: state.nextId++,
    matchWeekId: 1,
    timestamp: new Date(Date.now() - daysAgo * 86_400_000),
    label: "Food",
    kcal: null,
    proteinG: null,
    carbsG: null,
    fatG: null,
    ...fields,
  });
  // The route reads the library newest-first, as GET /api/foods does.
  state.entries.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
}

function whatNow(cookie: string) {
  return fetch(`${baseUrl}/api/stats/what-now`, { headers: { Cookie: cookie } });
}

describe("GET /api/stats/what-now", () => {
  it("rejects an unauthenticated request", async () => {
    expect((await whatNow("")).status).toBe(401);
  });

  it("measures the room against the whole day's expected burn", async () => {
    const cookie = await signUp({ weightKg: 80, heightCm: 180, ageYears: 40, activityLevel: "light", sex: "male" });
    log(0, { label: "Porridge", kcal: 400 });

    const body = (await (await whatNow(cookie)).json()) as any;
    expect(body.expectedBurn.baseSource).toBe("formula");
    expect(body.expectedBurn.kcal).toBeGreaterThan(1500);
    expect(body.eatenKcal).toBe(400);
    expect(body.remainingKcal).toBe(body.expectedBurn.kcal - 400);
  });

  it("prefers a tracker's measured daily average over any estimate", async () => {
    const cookie = await signUp({
      dailyCalorieTarget: 2000,
      weightKg: 80,
      heightCm: 180,
      ageYears: 40,
      activityLevel: "light",
      sex: "male",
    });
    // Five whole days at 3,000, plus today's part-day. The earliest day is the
    // one the 14-day window cut in half, so it is dropped along with today.
    for (let day = 0; day <= 6; day += 1) {
      const start = new Date(Date.now() - day * 86_400_000);
      start.setUTCHours(1, 0, 0, 0);
      state.cycles.push({ start, end: new Date(start.getTime() + 22 * 3_600_000), kcalBurned: 3000 });
    }

    const body = (await (await whatNow(cookie)).json()) as any;
    expect(body.expectedBurn.baseSource).toBe("measured-average");
    expect(body.expectedBurn.base).toBe(3000);
  });

  it("uses the learned figure over the formula, but not a low-confidence one", async () => {
    const fields = { weightKg: 80, heightCm: 180, ageYears: 40, activityLevel: "light", sex: "male" };
    state.adaptive = { kcalPerDay: 2750, confidence: "high" };
    const cookie = await signUp(fields);

    const body = (await (await whatNow(cookie)).json()) as any;
    expect(body.expectedBurn).toMatchObject({ baseSource: "adaptive", base: 2750 });

    state.adaptive = { kcalPerDay: 2750, confidence: "low" };
    const second = (await (await whatNow(cookie)).json()) as any;
    expect(second.expectedBurn.baseSource).toBe("formula");
  });

  it("adds exercise logged by hand today, but not what a tracker already counted", async () => {
    const cookie = await signUp({ dailyCalorieTarget: 2000 });
    state.exercises.push({ kcalBurned: 320, whoopWorkoutId: null });
    // Already inside the measured burn — counting it here would be the same
    // run twice.
    state.exercises.push({ kcalBurned: 500, whoopWorkoutId: "abc" });

    const body = (await (await whatNow(cookie)).json()) as any;
    expect(body.expectedBurn).toMatchObject({ base: 2000, exerciseKcal: 320, kcal: 2320 });
    expect(body.remainingKcal).toBe(2320);
  });

  it("has nothing to offer with nothing at all to measure against", async () => {
    const cookie = await signUp();
    const body = (await (await whatNow(cookie)).json()) as any;
    expect(body).toMatchObject({ expectedBurn: null, remainingKcal: null, available: false, reason: "no-reference" });
  });

  it("draws suggestions from every day of the diary, not just today", async () => {
    const cookie = await signUp({ dailyCalorieTarget: 2000 });
    log(40, { label: "Greek yoghurt", kcal: 150, proteinG: 20, carbsG: 8, fatG: 4 });

    const body = (await (await whatNow(cookie)).json()) as any;
    expect(body.suggestions.map((s: any) => s.label)).toContain("Greek yoghurt");
  });

  it("groups the same food logged twice into one suggestion", async () => {
    const cookie = await signUp({ dailyCalorieTarget: 2000 });
    log(3, { label: "Chicken and rice", kcal: 520 });
    log(9, { label: "rice and chicken", kcal: 500 });

    const body = (await (await whatNow(cookie)).json()) as any;
    expect(body.suggestions.filter((s: any) => s.kind === "food")).toHaveLength(1);
  });

  it("uses a correction rather than whatever was last logged", async () => {
    const cookie = await signUp({ dailyCalorieTarget: 2000 });
    log(2, { label: "Sausage roll", kcal: 200, proteinG: 5, carbsG: 20, fatG: 10 });
    state.overrides.push({
      labelKey: "roll sausage",
      label: "Greggs sausage roll",
      kcal: 327,
      proteinG: 9,
      carbsG: 25,
      fatG: 22,
    });

    const body = (await (await whatNow(cookie)).json()) as any;
    expect(body.suggestions[0]).toMatchObject({ label: "Greggs sausage roll", kcal: 327, fatG: 22 });
  });

  it("costs a recipe per portion, which is what logging it would add", async () => {
    const cookie = await signUp({ dailyCalorieTarget: 2000 });
    state.meals.push({
      id: 4,
      name: "Chilli",
      kind: "recipe",
      servings: 4,
      items: [
        { label: "Mince", kcal: 1200, proteinG: 100, carbsG: 0, fatG: 88 },
        { label: "Beans", kcal: 400, proteinG: 24, carbsG: 68, fatG: 2 },
      ],
    });

    const body = (await (await whatNow(cookie)).json()) as any;
    expect(body.suggestions[0]).toMatchObject({ kind: "meal", label: "Chilli", kcal: 400, proteinG: 31, fatG: 22.5 });
  });

  it("leaves out a meal with an un-costed ingredient rather than under-counting it", async () => {
    const cookie = await signUp({ dailyCalorieTarget: 2000 });
    state.meals.push({
      id: 5,
      name: "Fry up",
      kind: "template",
      servings: 1,
      items: [{ label: "Eggs", kcal: 180, proteinG: 18, carbsG: 1, fatG: 12 }, { label: "Mystery", kcal: null }],
    });

    const body = (await (await whatNow(cookie)).json()) as any;
    expect(body.suggestions).toEqual([]);
    expect(body.reason).toBe("empty-library");
  });

  it("counts what's been eaten today against the macro targets", async () => {
    const cookie = await signUp({
      dailyCalorieTarget: 2000,
      macroMode: "grams",
      proteinTargetG: 150,
      proteinOp: "min",
      fatTargetG: 70,
      fatOp: "max",
    });
    log(0, { label: "Porridge", kcal: 400, proteinG: 12, carbsG: 60, fatG: 8 });

    const body = (await (await whatNow(cookie)).json()) as any;
    expect(body.macroRoom).toEqual([
      { key: "protein", op: "min", target: 150, eaten: 12, headroom: null, gap: 138 },
      { key: "fat", op: "max", target: 70, eaten: 8, headroom: 62, gap: 0 },
    ]);
  });

  it("says nothing is left rather than suggesting food once the day is spent", async () => {
    const cookie = await signUp({ dailyCalorieTarget: 2000 });
    log(0, { label: "Big day", kcal: 2100 });

    const body = (await (await whatNow(cookie)).json()) as any;
    expect(body).toMatchObject({ remainingKcal: -100, available: false, reason: "no-room" });
  });

  it("hands the card what it needs to log a suggestion in one tap", async () => {
    const cookie = await signUp({ dailyCalorieTarget: 2000 });
    log(1, { label: "Greek yoghurt", kcal: 150, proteinG: 20, carbsG: 8, fatG: 4 });

    const body = (await (await whatNow(cookie)).json()) as any;
    expect(body.suggestions[0].parts).toEqual([
      { kind: "food", labelKey: "greek yoghurt", label: "Greek yoghurt", kcal: 150 },
    ]);
  });
});
