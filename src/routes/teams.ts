/**
 * Teams, and the table.
 *
 * The app is named after a league, and a league is a table. Everything a table
 * needs has been in this codebase for months — accounts, per-user weeks,
 * weighted days logged, weekly totals — and nothing joined people together.
 *
 * Access is by join code and nothing else. There is no endpoint that lists
 * teams, no guessable route into one, and every read here is scoped to a
 * membership row: a team you are not in is a 404, not a 403, so a team id
 * cannot be probed for existence any more than a share token can.
 *
 * What a member can see about the others is narrow on purpose, and stated on
 * the screen before anyone joins: a name, days logged, and weight change as a
 * percentage. Not the diary, not the food, not the number on the scales.
 */

import { Router } from "express";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { prisma } from "../db";
import { config } from "../config";
import { requireAuth } from "../auth";
import {
  getMatchWeekBoundariesForWeeksAgo,
  localDayKey,
  weekRangeLabel,
  weightedDaysLogged,
} from "../matchWeek";
import { buildTeamTable, type TeamMemberWeek } from "../teamTable";

export const teamsRouter = Router();

/** How many teams one person can be in. A limit, not a design statement. */
const MAX_TEAMS_PER_USER = 10;

/**
 * Six characters from an alphabet with no O/0 or I/1 in it, because this is a
 * code people read aloud in a changing room and type on a phone.
 */
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function newJoinCode(): string {
  const bytes = randomBytes(6);
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");
}

/** The membership, or null — every route below starts here. */
async function membershipOf(teamId: number, userId: number) {
  return prisma.teamMember.findUnique({
    where: { teamId_userId: { teamId, userId } },
    include: { team: true },
  });
}

const createSchema = z.object({ name: z.string().trim().min(1).max(60) });

teamsRouter.post("/", requireAuth, async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const count = await prisma.teamMember.count({ where: { userId: req.userId! } });
  if (count >= MAX_TEAMS_PER_USER) {
    res.status(400).json({ error: "That's as many teams as one account can be in." });
    return;
  }

  // The team's week starts life as the creator's, which is almost always what
  // was meant — someone setting up a league week has usually already set their
  // own to match it.
  const user = await prisma.user.findUniqueOrThrow({ where: { id: req.userId! } });

  const team = await prisma.team.create({
    data: {
      name: parsed.data.name,
      joinCode: newJoinCode(),
      weekStartWeekday: user.weekStartWeekday,
      weekStartHour: user.weekStartHour,
      weekStartMinute: user.weekStartMinute,
      members: { create: { userId: req.userId!, role: "owner" } },
    },
    include: { members: true },
  });

  res.status(201).json(presentTeam(team, "owner"));
});

const joinSchema = z.object({ code: z.string().trim().min(1).max(20) });

teamsRouter.post("/join", requireAuth, async (req, res) => {
  const parsed = joinSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  // Case-insensitive, because the code is read off a message or a whiteboard
  // and nobody's phone agrees about autocapitalisation.
  const code = parsed.data.code.toUpperCase().replace(/\s+/g, "");
  const team = await prisma.team.findUnique({ where: { joinCode: code }, include: { members: true } });
  if (!team) {
    res.status(404).json({ error: "No team with that code." });
    return;
  }

  const already = team.members.find((m) => m.userId === req.userId);
  if (already) {
    res.json(presentTeam(team, already.role));
    return;
  }

  const count = await prisma.teamMember.count({ where: { userId: req.userId! } });
  if (count >= MAX_TEAMS_PER_USER) {
    res.status(400).json({ error: "That's as many teams as one account can be in." });
    return;
  }

  await prisma.teamMember.create({ data: { teamId: team.id, userId: req.userId!, role: "member" } });
  const updated = await prisma.team.findUniqueOrThrow({ where: { id: team.id }, include: { members: true } });
  res.status(201).json(presentTeam(updated, "member"));
});

/** The teams this account is in. The only listing endpoint there is. */
teamsRouter.get("/", requireAuth, async (req, res) => {
  const memberships = await prisma.teamMember.findMany({
    where: { userId: req.userId! },
    include: { team: { include: { members: true } } },
    orderBy: { joinedAt: "asc" },
  });
  res.json(memberships.map((m) => presentTeam(m.team, m.role)));
});

/**
 * The table for one week.
 *
 * Computed against the team's own week rather than each viewer's, so two
 * members whose rollovers differ still see the same fixture.
 */
teamsRouter.get("/:id/table", requireAuth, async (req, res) => {
  const teamId = Number(req.params.id);
  const membership = await membershipOf(teamId, req.userId!);
  // A team you are not in is a 404, so an id can't be probed for existence.
  if (!Number.isFinite(teamId) || !membership) {
    res.status(404).json({ error: "Team not found" });
    return;
  }

  const weeksAgo = Math.max(0, Math.min(52, Number(req.query.weeksAgo) || 0));
  const team = membership.team;
  const week = getMatchWeekBoundariesForWeeksAgo(new Date(), weeksAgo, config.TIMEZONE, {
    weekday: team.weekStartWeekday,
    hour: team.weekStartHour,
    minute: team.weekStartMinute,
  });

  const members = await prisma.teamMember.findMany({
    where: { teamId },
    include: { user: { select: { id: true, username: true } } },
  });
  const userIds = members.map((m) => m.userId);

  const startKey = localDayKey(week.start, config.TIMEZONE);
  const endKey = localDayKey(week.end, config.TIMEZONE);

  const [entries, weighIns] = await Promise.all([
    prisma.entry.findMany({
      where: {
        matchWeek: { userId: { in: userIds } },
        timestamp: { gte: week.start, lt: week.end },
      },
      select: { timestamp: true, matchWeek: { select: { userId: true } } },
    }),
    prisma.weighIn.findMany({
      where: { userId: { in: userIds }, date: { gte: startKey, lte: endKey } },
      orderBy: { date: "asc" },
      select: { userId: true, date: true, weightKg: true },
    }),
  ]);

  const daysByUser = new Map<number, Set<string>>();
  for (const entry of entries) {
    const userId = entry.matchWeek.userId;
    if (userId === null) continue;
    const key = localDayKey(entry.timestamp, config.TIMEZONE);
    const set = daysByUser.get(userId) ?? new Set<string>();
    set.add(key);
    daysByUser.set(userId, set);
  }

  const weighInsByUser = new Map<number, { date: string; weightKg: number }[]>();
  for (const row of weighIns) {
    const list = weighInsByUser.get(row.userId) ?? [];
    list.push({ date: row.date, weightKg: row.weightKg });
    weighInsByUser.set(row.userId, list);
  }

  const weeks: TeamMemberWeek[] = members.map((member) => {
    const days = daysByUser.get(member.userId) ?? new Set<string>();
    const scale = weighInsByUser.get(member.userId) ?? [];
    // Two weigh-ins or no result: one is a single reading, and a week's change
    // cannot be read off a single reading.
    const enough = scale.length >= 2;
    return {
      userId: member.userId,
      name: member.user.username,
      daysLogged: weightedDaysLogged(days, week.start, config.TIMEZONE),
      startWeightKg: enough ? scale[0]!.weightKg : null,
      endWeightKg: enough ? scale[scale.length - 1]!.weightKg : null,
    };
  });

  res.json({
    team: presentTeam({ ...team, members }, membership.role),
    weeksAgo,
    // The same label the diary uses for a week, so the two screens agree about
    // which week is which.
    rangeLabel: weekRangeLabel(week.start, week.end, config.TIMEZONE),
    rows: buildTeamTable(weeks),
  });
});

const renameSchema = z.object({ name: z.string().trim().min(1).max(60) });

teamsRouter.patch("/:id", requireAuth, async (req, res) => {
  const teamId = Number(req.params.id);
  const membership = await membershipOf(teamId, req.userId!);
  if (!Number.isFinite(teamId) || !membership) {
    res.status(404).json({ error: "Team not found" });
    return;
  }
  if (membership.role !== "owner") {
    res.status(403).json({ error: "Only whoever set the team up can rename it." });
    return;
  }

  const parsed = renameSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const team = await prisma.team.update({
    where: { id: teamId },
    data: { name: parsed.data.name },
    include: { members: true },
  });
  res.json(presentTeam(team, membership.role));
});

/**
 * Leaving, or being removed.
 *
 * Anyone can remove themselves; only an owner can remove somebody else. A team
 * whose last member leaves is deleted rather than left as an orphan row nobody
 * can reach — its join code stops working, which is the honest outcome.
 */
teamsRouter.delete("/:id/members/:userId", requireAuth, async (req, res) => {
  const teamId = Number(req.params.id);
  const targetId = Number(req.params.userId);
  const membership = await membershipOf(teamId, req.userId!);
  if (!Number.isFinite(teamId) || !Number.isFinite(targetId) || !membership) {
    res.status(404).json({ error: "Team not found" });
    return;
  }

  const isSelf = targetId === req.userId;
  if (!isSelf && membership.role !== "owner") {
    res.status(403).json({ error: "Only whoever set the team up can remove somebody." });
    return;
  }

  await prisma.teamMember.deleteMany({ where: { teamId, userId: targetId } });

  const left = await prisma.teamMember.count({ where: { teamId } });
  if (left === 0) {
    await prisma.team.delete({ where: { id: teamId } });
    res.json({ removed: true, teamDeleted: true });
    return;
  }

  // An owner who walks out would otherwise leave a team nobody can rename or
  // moderate, so the longest-standing member inherits it.
  if (isSelf && membership.role === "owner") {
    const next = await prisma.teamMember.findFirst({ where: { teamId }, orderBy: { joinedAt: "asc" } });
    if (next) await prisma.teamMember.update({ where: { id: next.id }, data: { role: "owner" } });
  }

  res.json({ removed: true, teamDeleted: false });
});

function presentTeam(
  team: {
    id: number;
    name: string;
    joinCode: string;
    weekStartWeekday: number;
    weekStartHour: number;
    weekStartMinute: number;
    members: { userId: number; role: string }[];
  },
  role: string,
) {
  return {
    id: team.id,
    name: team.name,
    // Shown to every member, not just the owner: a team that only one person
    // can invite into is a team that stops growing the day they go on holiday.
    joinCode: team.joinCode,
    memberCount: team.members.length,
    role,
    weekStart: {
      weekday: team.weekStartWeekday,
      hour: team.weekStartHour,
      minute: team.weekStartMinute,
    },
  };
}
