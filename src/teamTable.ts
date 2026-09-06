/**
 * Ranking a team's week.
 *
 * Kept apart from the route so the ordering rules — which are the whole
 * argument of a league table — can be read and tested without a database.
 *
 * Two figures cross, and no others. **Weight change**, because that is what
 * the league is about, as both a delta and a percentage of where the person
 * started the week. And **days logged**, because it is the effort half: a week
 * with a bad number on the scales but seven days logged is a better week than
 * one with neither, and a table that only ranked outcome would say the
 * opposite.
 *
 * What deliberately doesn't cross: what anyone ate, what anyone weighs, and
 * what anyone is aiming at. A percentage change says how the week went without
 * telling twelve people what someone stood at on Monday morning.
 */

export interface TeamMemberWeek {
  userId: number;
  name: string;
  /** Weighted for a mid-week rollover, same as the diary's own figure. */
  daysLogged: number;
  /**
   * Weight at the first and last weigh-in inside the week, or null where
   * there aren't two. Null is a real answer — somebody who didn't weigh in has
   * no result, which is different from a result of zero.
   */
  startWeightKg: number | null;
  endWeightKg: number | null;
}

export interface TeamTableRow {
  userId: number;
  name: string;
  daysLogged: number;
  /** Negative means lost. Null when the week has no pair of weigh-ins. */
  changeKg: number | null;
  /** The same change as a share of the starting weight. Null likewise. */
  changePct: number | null;
  /** 1-based, and shared by rows that tie. */
  position: number;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Percentage rather than kilograms, because a table ranked on kilos is a table
 * ranked on starting weight: the heaviest person in a team loses more of them
 * for the same effort, every week, forever. Percentage is the comparison the
 * league format has always used and the only one that is fair across bodies.
 */
export function buildTeamTable(members: TeamMemberWeek[]): TeamTableRow[] {
  const scored = members.map((member) => {
    const hasPair =
      member.startWeightKg !== null && member.endWeightKg !== null && member.startWeightKg > 0;
    const changeKg = hasPair ? round2(member.endWeightKg! - member.startWeightKg!) : null;
    const changePct = hasPair
      ? round2(((member.endWeightKg! - member.startWeightKg!) / member.startWeightKg!) * 100)
      : null;
    return {
      userId: member.userId,
      name: member.name,
      daysLogged: round1(member.daysLogged),
      changeKg,
      changePct,
    };
  });

  scored.sort((a, b) => {
    // Somebody who didn't weigh in has no result, and no result goes below
    // every result rather than being treated as zero change. Ranking them as
    // though they held steady would put them above everyone who gained.
    if (a.changePct === null && b.changePct === null) return b.daysLogged - a.daysLogged;
    if (a.changePct === null) return 1;
    if (b.changePct === null) return -1;
    // Most lost first, so the most negative percentage leads.
    if (a.changePct !== b.changePct) return a.changePct - b.changePct;
    // Level on the scales, the week with more logging in it comes first.
    return b.daysLogged - a.daysLogged;
  });

  // Ties share a position, and the next row skips — 1, 2, 2, 4 — which is how
  // every league table anyone has read is numbered.
  const rows: TeamTableRow[] = [];
  let position = 0;
  let previous: { changePct: number | null; daysLogged: number } | null = null;

  scored.forEach((row, index) => {
    const tied =
      previous !== null
      && previous.changePct === row.changePct
      && previous.daysLogged === row.daysLogged;
    if (!tied) position = index + 1;
    previous = { changePct: row.changePct, daysLogged: row.daysLogged };
    rows.push({ ...row, position });
  });

  return rows;
}
