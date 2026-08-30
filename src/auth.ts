import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import type { NextFunction, Request, Response } from "express";
import { prisma } from "./db";

declare module "express-serve-static-core" {
  interface Request {
    userId?: number;
  }
}

export const SESSION_COOKIE_NAME = "session";
const SESSION_SECRET_SETTING_KEY = "sessionSecret";
const SESSION_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 365;

let cachedSecret: string | null = null;

/**
 * Generated once on first use and persisted in the Setting table, rather
 * than requiring a manually-provisioned SESSION_SECRET deploy secret.
 */
async function getSessionSecret(): Promise<string> {
  if (cachedSecret) return cachedSecret;

  const generated = crypto.randomBytes(32).toString("hex");
  const setting = await prisma.setting.upsert({
    where: { key: SESSION_SECRET_SETTING_KEY },
    update: {},
    create: { key: SESSION_SECRET_SETTING_KEY, value: generated },
  });
  cachedSecret = setting.value;
  return cachedSecret;
}

/** Call once at startup so the secret is ready before any request needs it. */
export async function ensureSessionSecret(): Promise<void> {
  await getSessionSecret();
}

function sign(payload: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

/**
 * Tokens carry when they were issued as well as when they expire. The issue
 * time is what makes revocation possible without a session table: raising
 * User.sessionsValidFrom invalidates every token minted before that instant,
 * which is exactly what "sign out everywhere" needs to mean on a device you
 * no longer have.
 */
async function createSessionToken(userId: number): Promise<string> {
  const secret = await getSessionSecret();
  const issuedAt = Date.now();
  const payload = `${userId}.${issuedAt + SESSION_MAX_AGE_MS}.${issuedAt}`;
  return `${payload}.${sign(payload, secret)}`;
}

async function verifySessionToken(token: string): Promise<number | null> {
  const parts = token.split(".");
  // Three parts is the pre-revocation token shape. Those are still accepted
  // so a deploy doesn't sign everyone out, but they have no issue time, so
  // they're treated as issued at the epoch — meaning the first use of "sign
  // out everywhere" clears them too.
  if (parts.length !== 3 && parts.length !== 4) return null;
  const signature = parts[parts.length - 1]!;
  const payload = parts.slice(0, -1).join(".");
  const [userIdRaw, expiryRaw, issuedAtRaw] = parts;
  if (!userIdRaw || !expiryRaw || !signature) return null;

  const secret = await getSessionSecret();
  const expected = sign(payload, secret);
  const given = Buffer.from(signature);
  const wanted = Buffer.from(expected);
  if (given.length !== wanted.length || !crypto.timingSafeEqual(given, wanted)) return null;

  const expiry = Number(expiryRaw);
  if (!Number.isFinite(expiry) || expiry < Date.now()) return null;

  const userId = Number(userIdRaw);
  if (!Number.isFinite(userId)) return null;

  const issuedAt = issuedAtRaw === undefined ? 0 : Number(issuedAtRaw);
  if (!Number.isFinite(issuedAt)) return null;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { sessionsValidFrom: true },
  });
  // A deleted account's token stops working immediately rather than at expiry.
  if (!user) return null;
  if (user.sessionsValidFrom && issuedAt < user.sessionsValidFrom.getTime()) return null;

  return userId;
}

/** Revokes every session token issued to this user before now. */
export async function revokeAllSessions(userId: number): Promise<void> {
  // One second in the future, because a token minted in the same millisecond
  // as the revocation would otherwise survive it.
  await prisma.user.update({
    where: { id: userId },
    data: { sessionsValidFrom: new Date(Date.now() + 1000) },
  });
}

export async function setSessionCookie(res: Response, userId: number): Promise<void> {
  const token = await createSessionToken(userId);
  res.cookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_MAX_AGE_MS,
  });
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(SESSION_COOKIE_NAME);
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = req.cookies?.[SESSION_COOKIE_NAME];
  const userId = typeof token === "string" ? await verifySessionToken(token) : null;
  if (userId === null) {
    res.status(401).json({ error: "Not signed in" });
    return;
  }
  req.userId = userId;
  next();
}

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
