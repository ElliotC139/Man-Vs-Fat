import { describe, expect, it } from "vitest";
import { buildTeamTable, type TeamMemberWeek } from "../src/teamTable";

function member(overrides: Partial<TeamMemberWeek> & { userId: number; name: string }): TeamMemberWeek {
  return {
    daysLogged: 7,
    startWeightKg: 100,
    endWeightKg: 100,
    ...overrides,
  };
}

describe("ranking a team's week", () => {
  it("puts the biggest percentage loss first", () => {
    const rows = buildTeamTable([
      member({ userId: 1, name: "alice", startWeightKg: 100, endWeightKg: 99 }),
      member({ userId: 2, name: "bob", startWeightKg: 100, endWeightKg: 98 }),
    ]);
    expect(rows.map((r) => r.name)).toEqual(["bob", "alice"]);
    expect(rows[0]!.position).toBe(1);
  });

  it("ranks on percentage, not kilos", () => {
    // A table ranked on kilos is a table ranked on starting weight: the
    // heaviest person loses more of them for the same effort, every week,
    // forever. Bob loses more kilos; Alice loses more of herself.
    const rows = buildTeamTable([
      member({ userId: 1, name: "alice", startWeightKg: 70, endWeightKg: 68.6 }), // -2.0%
      member({ userId: 2, name: "bob", startWeightKg: 130, endWeightKg: 128 }), // -1.54%
    ]);
    expect(rows.map((r) => r.name)).toEqual(["alice", "bob"]);
    expect(rows[0]!.changeKg).toBe(-1.4);
    expect(rows[1]!.changeKg).toBe(-2);
  });

  it("reports a gain as a gain rather than hiding it", () => {
    const rows = buildTeamTable([
      member({ userId: 1, name: "alice", startWeightKg: 100, endWeightKg: 101 }),
    ]);
    expect(rows[0]!.changeKg).toBe(1);
    expect(rows[0]!.changePct).toBe(1);
  });

  it("puts someone with no weigh-ins below everyone with a result", () => {
    // Not zero change: ranking them as though they held steady would put them
    // above everyone who gained, which is a claim nobody made.
    const rows = buildTeamTable([
      member({ userId: 1, name: "alice", startWeightKg: 100, endWeightKg: 101 }),
      member({ userId: 2, name: "bob", startWeightKg: null, endWeightKg: null }),
    ]);
    expect(rows.map((r) => r.name)).toEqual(["alice", "bob"]);
    expect(rows[1]!.changePct).toBeNull();
  });

  it("orders people with no result by how much they logged", () => {
    // Effort is the only thing left to say about them, and it is worth saying.
    const rows = buildTeamTable([
      member({ userId: 1, name: "alice", startWeightKg: null, endWeightKg: null, daysLogged: 2 }),
      member({ userId: 2, name: "bob", startWeightKg: null, endWeightKg: null, daysLogged: 6 }),
    ]);
    expect(rows.map((r) => r.name)).toEqual(["bob", "alice"]);
  });

  it("breaks a tie on the scales with days logged", () => {
    const rows = buildTeamTable([
      member({ userId: 1, name: "alice", startWeightKg: 100, endWeightKg: 99, daysLogged: 3 }),
      member({ userId: 2, name: "bob", startWeightKg: 100, endWeightKg: 99, daysLogged: 7 }),
    ]);
    expect(rows.map((r) => r.name)).toEqual(["bob", "alice"]);
  });

  it("numbers a genuine tie the way a league table does", () => {
    // 1, 2, 2, 4 — the shared position, then the next row skips.
    const rows = buildTeamTable([
      member({ userId: 1, name: "alice", startWeightKg: 100, endWeightKg: 98 }),
      member({ userId: 2, name: "bob", startWeightKg: 100, endWeightKg: 99 }),
      member({ userId: 3, name: "cara", startWeightKg: 200, endWeightKg: 198 }),
      member({ userId: 4, name: "dan", startWeightKg: 100, endWeightKg: 100 }),
    ]);
    expect(rows.map((r) => r.position)).toEqual([1, 2, 2, 4]);
  });

  it("gives no result to a week with only one weigh-in", () => {
    // A week's change cannot be read off a single reading — the route only
    // passes a pair, and a half-filled pair means the same thing as none.
    const rows = buildTeamTable([
      member({ userId: 1, name: "alice", startWeightKg: 100, endWeightKg: null }),
    ]);
    expect(rows[0]!.changeKg).toBeNull();
    expect(rows[0]!.changePct).toBeNull();
  });

  it("refuses to divide by a starting weight of zero", () => {
    const rows = buildTeamTable([
      member({ userId: 1, name: "alice", startWeightKg: 0, endWeightKg: 80 }),
    ]);
    expect(rows[0]!.changePct).toBeNull();
  });

  it("rounds a half-day of logging rather than showing float noise", () => {
    const rows = buildTeamTable([member({ userId: 1, name: "alice", daysLogged: 6.5 })]);
    expect(rows[0]!.daysLogged).toBe(6.5);
  });

  it("carries no weight figure through, only the change", () => {
    // A percentage says how the week went without telling twelve people what
    // somebody stood at on Monday morning.
    const rows = buildTeamTable([
      member({ userId: 1, name: "alice", startWeightKg: 96.4, endWeightKg: 95.2 }),
    ]);
    expect(JSON.stringify(rows)).not.toContain("96.4");
    expect(JSON.stringify(rows)).not.toContain("95.2");
  });

  it("returns an empty table for a team with nobody in it", () => {
    expect(buildTeamTable([])).toEqual([]);
  });
});
