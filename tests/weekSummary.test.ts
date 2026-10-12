import { describe, expect, it } from "vitest";
import { zonedTimeToUtc } from "../src/matchWeek";
import { buildWeekSummary, type ReportContext } from "../src/pdf/weekSummary";
import { generateMatchWeekReport } from "../src/pdf/generateReport";

const TZ = "Europe/London";

// Monday 5 October 17:00 to Monday 12 October 17:00: eight calendar days, the
// two Mondays each half in the week.
const week = { startsAt: zonedTimeToUtc(2026, 10, 5, 17, 0, TZ), endsAt: zonedTimeToUtc(2026, 10, 12, 17, 0, TZ) };
const at = (day: number, hour: number) => zonedTimeToUtc(2026, 10, day, hour, 0, TZ);
const afterTheWeek = at(12, 18);

const context = (overrides: Partial<ReportContext> = {}): ReportContext => ({
  reference: { kcal: 2000, kind: "target" },
  measuredBurn: {},
  exercise: { count: 0, kcal: 0 },
  weighIns: [],
  ...overrides,
});

describe("buildWeekSummary", () => {
  it("lays out every calendar day the week touches, logged or not", () => {
    const summary = buildWeekSummary(week, [{ timestamp: at(6, 12), kcal: 500 }], context(), TZ, afterTheWeek);
    expect(summary.days.map((d) => d.date)).toEqual([
      "2026-10-05",
      "2026-10-06",
      "2026-10-07",
      "2026-10-08",
      "2026-10-09",
      "2026-10-10",
      "2026-10-11",
      "2026-10-12",
    ]);
    expect(summary.days[0]).toMatchObject({ weekday: "Mon", dayOfMonth: 5 });
    expect(summary.days[1]).toMatchObject({ weekday: "Tue", kcal: 500, verdict: "under" });
    expect(summary.days[2]).toMatchObject({ kcal: 0, verdict: "none" });
  });

  it("calls a day under or over against the target", () => {
    const summary = buildWeekSummary(
      week,
      [
        { timestamp: at(6, 12), kcal: 1800 },
        { timestamp: at(7, 12), kcal: 2400 },
      ],
      context(),
      TZ,
      afterTheWeek,
    );
    expect(summary.under).toBe(1);
    expect(summary.over).toBe(1);
    expect(summary.days[1]!.verdict).toBe("under");
    expect(summary.days[2]!.verdict).toBe("over");
  });

  it("works out the balance the way the app's balance card does: target times days logged", () => {
    // Two whole days logged: 4,200 eaten against 2 × 2,000.
    const summary = buildWeekSummary(
      week,
      [
        { timestamp: at(6, 12), kcal: 1800 },
        { timestamp: at(7, 12), kcal: 2400 },
      ],
      context(),
      TZ,
      afterTheWeek,
    );
    expect(summary.daysLogged).toBe(2);
    expect(summary.balance).toBe(200);
  });

  it("counts a boundary Monday as half a day of target, not a whole one", () => {
    const summary = buildWeekSummary(week, [{ timestamp: at(5, 19), kcal: 600 }], context(), TZ, afterTheWeek);
    expect(summary.daysLogged).toBe(0.5);
    expect(summary.balance).toBe(600 - 1000);
  });

  it("measures a day against the tracker's burn where there is one, and the target where there isn't", () => {
    const summary = buildWeekSummary(
      week,
      [
        { timestamp: at(6, 12), kcal: 2500 },
        { timestamp: at(7, 12), kcal: 2500 },
      ],
      context({ measuredBurn: { "2026-10-06": 3000 } }),
      TZ,
      afterTheWeek,
    );
    expect(summary.usesMeasured).toBe(true);
    expect(summary.days[1]).toMatchObject({ against: 3000, againstKind: "measured", verdict: "under" });
    expect(summary.days[2]).toMatchObject({ against: 2000, againstKind: "target", verdict: "over" });
    // Against a tracker the balance is everything eaten less everything burned.
    expect(summary.balance).toBe(5000 - 3000);
  });

  it("leaves today open while it is under, and calls it the moment it goes over", () => {
    const thursdayAfternoon = at(8, 16);
    const under = buildWeekSummary(week, [{ timestamp: at(8, 12), kcal: 900 }], context(), TZ, thursdayAfternoon);
    expect(under.days[3]!.verdict).toBe("open");
    expect(under.under).toBe(0);

    const over = buildWeekSummary(week, [{ timestamp: at(8, 12), kcal: 2100 }], context(), TZ, thursdayAfternoon);
    expect(over.days[3]!.verdict).toBe("over");
    expect(over.days[4]!.verdict).toBe("future");
  });

  it("settles the last day once the week has closed", () => {
    // The automatic report goes out on the closing Monday itself.
    const summary = buildWeekSummary(week, [{ timestamp: at(12, 9), kcal: 500 }], context(), TZ, afterTheWeek);
    expect(summary.days[7]!.verdict).toBe("under");
  });

  it("leaves unestimated entries out of the totals and counts them", () => {
    const summary = buildWeekSummary(
      week,
      [
        { timestamp: at(6, 12), kcal: 700 },
        { timestamp: at(6, 13), kcal: null },
      ],
      context(),
      TZ,
      afterTheWeek,
    );
    expect(summary.totalKcal).toBe(700);
    expect(summary.unestimated).toBe(1);
  });

  it("reports a weight change only from two weigh-ins or more", () => {
    const one = buildWeekSummary(week, [], context({ weighIns: [{ date: "2026-10-06", weightKg: 100 }] }), TZ, afterTheWeek);
    expect(one.weightChangeKg).toBeNull();

    const two = buildWeekSummary(
      week,
      [],
      context({
        weighIns: [
          { date: "2026-10-06", weightKg: 100.4 },
          { date: "2026-10-11", weightKg: 99.6 },
        ],
      }),
      TZ,
      afterTheWeek,
    );
    expect(two.weightChangeKg).toBe(-0.8);
  });

  it("has no balance with nothing to measure against", () => {
    const summary = buildWeekSummary(week, [{ timestamp: at(6, 12), kcal: 700 }], context({ reference: null }), TZ, afterTheWeek);
    expect(summary.balance).toBeNull();
    expect(summary.days[1]!.verdict).toBe("logged");
  });
});

describe("generateMatchWeekReport", () => {
  const entry = (id: number, timestamp: Date, kcal: number | null) => ({
    id,
    timestamp,
    label: `Meal ${id}`,
    kcal,
    proteinG: 30,
    carbsG: 40,
    fatG: 15,
  });

  it("draws a report with the summary and chart", async () => {
    const pdf = await generateMatchWeekReport(
      { id: 1, userId: 1, startsAt: week.startsAt, endsAt: week.endsAt, entries: [entry(1, at(6, 12), 1800), entry(2, at(7, 12), 2600)] } as never,
      TZ,
      null,
      context({ measuredBurn: { "2026-10-06": 2900 }, exercise: { count: 2, kcal: 600 } }),
      afterTheWeek,
    );
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(2000);
  });

  it("still draws a report with no target, no tracker and nothing logged", async () => {
    const empty = await generateMatchWeekReport(
      { id: 1, userId: 1, startsAt: week.startsAt, endsAt: week.endsAt, entries: [] } as never,
      TZ,
    );
    expect(empty.subarray(0, 5).toString()).toBe("%PDF-");

    const bare = await generateMatchWeekReport(
      { id: 1, userId: 1, startsAt: week.startsAt, endsAt: week.endsAt, entries: [entry(1, at(6, 12), null)] } as never,
      TZ,
    );
    expect(bare.subarray(0, 5).toString()).toBe("%PDF-");
  });
});
