import { Router } from "express";
import { OAuth2Client } from "google-auth-library";
import { z } from "zod";
import { config } from "../config";
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

const googleSchema = z.object({
  credential: z.string().min(10),
});

// Undefined (not just falsy) when GOOGLE_SIGNIN_CLIENT_ID is unset, so the
// button-config endpoint and the verify endpoint agree on "configured".
const googleClient = config.GOOGLE_SIGNIN_CLIENT_ID ? new OAuth2Client(config.GOOGLE_SIGNIN_CLIENT_ID) : undefined;

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

// Google sign-in has no username of its own, so one is derived from the
// email's local part and de-duplicated against existing accounts.
async function uniqueUsernameFromEmail(email: string): Promise<string> {
  const local = email.split("@")[0] ?? "";
  let base = local.toLowerCase().replace(/[^a-z0-9_]/g, "");
  if (base.length < 3) base = `user${base}`;
  base = base.slice(0, 36);

  let candidate = base;
  let suffix = 2;
  while (await prisma.user.findUnique({ where: { username: candidate } })) {
    candidate = `${base}${suffix}`.slice(0, 40);
    suffix += 1;
  }
  return candidate;
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
  // user.passwordHash is null for Google-only accounts — no password to check.
  const valid = user?.passwordHash ? await verifyPassword(password, user.passwordHash) : false;
  if (!user || !valid) {
    res.status(401).json({ error: "Incorrect username or password." });
    return;
  }

  await setSessionCookie(res, user.id);
  res.json(toPublicUser(user));
});

authRouter.get("/google/config", (_req, res) => {
  res.json({ clientId: config.GOOGLE_SIGNIN_CLIENT_ID ?? null });
});

authRouter.post("/google", async (req, res) => {
  if (!googleClient || !config.GOOGLE_SIGNIN_CLIENT_ID) {
    res.status(503).json({ error: "Google sign-in is not configured." });
    return;
  }

  const parsed = googleSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  let payload;
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: parsed.data.credential,
      audience: config.GOOGLE_SIGNIN_CLIENT_ID,
    });
    payload = ticket.getPayload();
  } catch {
    res.status(401).json({ error: "Invalid Google credential." });
    return;
  }

  if (!payload?.sub || !payload.email || !payload.email_verified) {
    res.status(401).json({ error: "Invalid Google credential." });
    return;
  }
  const googleId = payload.sub;
  const email = payload.email;

  const existing = await prisma.user.findUnique({ where: { googleId } });
  if (existing) {
    await setSessionCookie(res, existing.id);
    res.json(toPublicUser(existing));
    return;
  }

  const username = await uniqueUsernameFromEmail(email);

  // Same "first account ever claims pre-multi-user history" rule as /signup.
  const user = await prisma.$transaction(async (tx) => {
    const isFirstUser = (await tx.user.count()) === 0;
    const created = await tx.user.create({ data: { username, googleId, email } });
    if (isFirstUser) {
      await tx.matchWeek.updateMany({ where: { userId: null }, data: { userId: created.id } });
    }
    return created;
  });

  await setSessionCookie(res, user.id);
  res.status(201).json(toPublicUser(user));
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
