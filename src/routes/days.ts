import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { config } from "../config";
import { requireAuth } from "../auth";
import { localDayKey } from "../matchWeek";

/**
 * The two things that belong to a day rather than to a meal: a note about
 * what was going on, and how much water was drunk. Both are one row per
 * calendar day and both are upserts, so logging twice corrects rather than
 * duplicates.
 */
export const daysRouter = Router();
daysRouter.use(requireAuth);

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

daysRouter.get("/notes", async (req, res) => {
  const notes = await prisma.dayNote.findMany({
    where: { userId: req.userId! },
    orderBy: { date: "desc" },
  });
  res.json(notes);
});

const noteSchema = z.object({
  date: z.string().regex(DATE_RE),
  note: z.string().max(500),
});

daysRouter.post("/notes", async (req, res) => {
  const parsed = noteSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Notes are limited to 500 characters." });
    return;
  }
  const { date } = parsed.data;
  const note = parsed.data.note.trim();

  // Clearing the box deletes the note rather than storing an empty one, so
  // the diary doesn't show a blank note marker on days with nothing to say.
  if (!note) {
    await prisma.dayNote.deleteMany({ where: { userId: req.userId!, date } });
    res.status(204).end();
    return;
  }

  const saved = await prisma.dayNote.upsert({
    where: { userId_date: { userId: req.userId!, date } },
    update: { note },
    create: { userId: req.userId!, date, note },
  });
  res.json(saved);
});

daysRouter.get("/water", async (req, res) => {
  const logs = await prisma.waterLog.findMany({
    where: { userId: req.userId! },
    orderBy: { date: "desc" },
    take: 90,
  });
  res.json(logs);
});

const waterSchema = z.object({
  date: z.string().regex(DATE_RE).optional(),
  // Positive to add a glass, negative to undo one. An absolute `ml` would
  // make the common action ("+250") a read-then-write from the client, which
  // double-counts if two taps land at once.
  deltaMl: z.number().int().min(-5000).max(5000),
});

daysRouter.post("/water", async (req, res) => {
  const parsed = waterSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const date = parsed.data.date ?? localDayKey(new Date(), config.TIMEZONE);

  const existing = await prisma.waterLog.findUnique({
    where: { userId_date: { userId: req.userId!, date } },
  });
  const ml = Math.max(0, Math.min(20000, (existing?.ml ?? 0) + parsed.data.deltaMl));

  const log = await prisma.waterLog.upsert({
    where: { userId_date: { userId: req.userId!, date } },
    update: { ml },
    create: { userId: req.userId!, date, ml },
  });
  res.json(log);
});
