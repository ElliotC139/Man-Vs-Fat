import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { hashPassword, verifyPassword, setSessionCookie, clearSessionCookie, requireAuth } from "../auth";

export const authRouter = Router();

const signupSchema = z.object({
  username: z.string().trim().min(3).max(40),
  password: z.string().min(8).max(200),
});

const loginSchema = z.object({
  username: z.string().trim().min(1),
  password: z.string().min(1),
});

const settingsSchema = z.object({
  weekStartWeekday: z.number().int().min(0).max(6).optional(),
  weekStartHour: z.number().int().min(0).max(23).optional(),
  weekStartMinute: z.number().int().min(0).max(59).optional(),
});

function toPublicUser(user: {
  id: number;
  username: string;
  weekStartWeekday: number;
  weekStartHour: number;
  weekStartMinute: number;
}) {
  return {
    id: user.id,
    username: user.username,
    weekStartWeekday: user.weekStartWeekday,
    weekStartHour: user.weekStartHour,
    weekStartMinute: user.weekStartMinute,
  };
}

authRouter.post("/signup", async (req, res) => {
  const parsed = signupSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const { username, password } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) {
    res.status(409).json({ error: "That username is already taken." });
    return;
  }

  const passwordHash = await hashPassword(password);

  // The very first account ever created claims any match weeks logged before
  // multi-user support existed, so existing history isn't orphaned.
  const user = await prisma.$transaction(async (tx) => {
    const isFirstUser = (await tx.user.count()) === 0;
    const created = await tx.user.create({ data: { username, passwordHash } });
    if (isFirstUser) {
      await tx.matchWeek.updateMany({ where: { userId: null }, data: { userId: created.id } });
    }
    return created;
  });

  await setSessionCookie(res, user.id);
  res.status(201).json(toPublicUser(user));
});

authRouter.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const { username, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { username } });
  const valid = user ? await verifyPassword(password, user.passwordHash) : false;
  if (!user || !valid) {
    res.status(401).json({ error: "Incorrect username or password." });
    return;
  }

  await setSessionCookie(res, user.id);
  res.json(toPublicUser(user));
});

authRouter.post("/logout", (_req, res) => {
  clearSessionCookie(res);
  res.status(204).end();
});

authRouter.get("/me", requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId! } });
  if (!user) {
    res.status(401).json({ error: "Not signed in" });
    return;
  }
  res.json(toPublicUser(user));
});

authRouter.patch("/me", requireAuth, async (req, res) => {
  const parsed = settingsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  if (Object.keys(parsed.data).length === 0) {
    res.status(400).json({ error: "Provide weekStartWeekday, weekStartHour and/or weekStartMinute to update." });
    return;
  }

  const user = await prisma.user.update({ where: { id: req.userId! }, data: parsed.data });
  res.json(toPublicUser(user));
});
