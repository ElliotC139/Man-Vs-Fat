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

async function createSessionToken(userId: number): Promise<string> {
  const secret = await getSessionSecret();
  const payload = `${userId}.${Date.now() + SESSION_MAX_AGE_MS}`;
  return `${payload}.${sign(payload, secret)}`;
}

async function verifySessionToken(token: string): Promise<number | null> {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [userIdRaw, expiryRaw, signature] = parts;
  if (!userIdRaw || !expiryRaw || !signature) return null;

  const secret = await getSessionSecret();
  const expected = sign(`${userIdRaw}.${expiryRaw}`, secret);
  const given = Buffer.from(signature);
  const wanted = Buffer.from(expected);
  if (given.length !== wanted.length || !crypto.timingSafeEqual(given, wanted)) return null;

  const expiry = Number(expiryRaw);
  if (!Number.isFinite(expiry) || expiry < Date.now()) return null;

  const userId = Number(userIdRaw);
  return Number.isFinite(userId) ? userId : null;
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
