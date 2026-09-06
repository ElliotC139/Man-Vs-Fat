import crypto from "node:crypto";
import { Router } from "express";
import { OAuth2Client } from "google-auth-library";
import { z } from "zod";
import { config } from "../config";
import { prisma } from "../db";
import {
  hashPassword,
  verifyPassword,
  setSessionCookie,
  clearSessionCookie,
  requireAuth,
  revokeAllSessions,
} from "../auth";
import { BURN_SOURCES, readBurnSource } from "../burnSource";
import { readMealTagNames, writeMealTagNames } from "../mealTags";
import { BUFFER_MODES, MAX_BUFFER_PCT, resolveBuffer } from "../kcalBuffer";
import { MEAL_TYPES } from "../mealType";
import { deleteAccount } from "../deleteAccount";
import { canSendMail, sendMail } from "../mailer";
import { consume, reset as resetRateLimit, LOGIN_BURST, RESET_BURST } from "../rateLimit";
import { MACRO_MODES, MACRO_OPS, resolveMacroTargets } from "../macros";
import { refileMatchWeeks } from "../refileMatchWeeks";

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
  weightKg: z.number().positive().nullable().optional(),
  heightCm: z.number().positive().nullable().optional(),
  ageYears: z.number().int().min(10).max(120).nullable().optional(),
  activityLevel: z.enum(["sedentary", "light", "moderate", "active"]).nullable().optional(),
  // Only ever used for the Mifflin-St Jeor constant. Null means not answered,
  // which is a supported state rather than a gap to nag about.
  sex: z.enum(["male", "female"]).nullable().optional(),
  weeklyGoalKg: z.number().min(0.1).max(1.5).nullable().optional(),
  goalWeightKg: z.number().min(30).max(700).nullable().optional(),
  dailyCalorieTarget: z.number().int().min(800).max(8000).nullable().optional(),
  // Null switches macros off entirely and the diary goes back to calories
  // only — the app has to keep working for someone who doesn't want them.
  macroMode: z.enum(MACRO_MODES).nullable().optional(),
  proteinTargetG: z.number().int().min(0).max(600).nullable().optional(),
  carbsTargetG: z.number().int().min(0).max(1200).nullable().optional(),
  fatTargetG: z.number().int().min(0).max(500).nullable().optional(),
  proteinOp: z.enum(MACRO_OPS).nullable().optional(),
  carbsOp: z.enum(MACRO_OPS).nullable().optional(),
  fatOp: z.enum(MACRO_OPS).nullable().optional(),
  proteinPct: z.number().int().min(0).max(100).nullable().optional(),
  carbsPct: z.number().int().min(0).max(100).nullable().optional(),
  fatPct: z.number().int().min(0).max(100).nullable().optional(),
  // Null turns the daily reminder off entirely.
  reminderHour: z.number().int().min(0).max(23).nullable().optional(),
  // Which figure the Today card calls the day's burn. Null means measured.
  burnSource: z.enum(BURN_SOURCES).nullable().optional(),
  // How much the under-reporting buffer adds, and whether it varies per item.
  kcalBufferMode: z.enum(BUFFER_MODES).nullable().optional(),
  kcalBufferPct: z.number().int().min(0).max(MAX_BUFFER_PCT).nullable().optional(),
  kcalBufferMinPct: z.number().int().min(0).max(MAX_BUFFER_PCT).nullable().optional(),
  kcalBufferMaxPct: z.number().int().min(0).max(MAX_BUFFER_PCT).nullable().optional(),
  // Whether the log form asks which meal an entry belongs to.
  mealTagsEnabled: z.boolean().optional(),
  // What the four slots are called. Only the four known slots are accepted, so
  // this can never introduce a fifth the rest of the app doesn't know about.
  mealTagNames: z
    .object(Object.fromEntries(MEAL_TYPES.map((slot) => [slot, z.string().trim().max(20)])) as
      Record<(typeof MEAL_TYPES)[number], z.ZodString>)
    .partial()
    .nullable()
    .optional(),
  // Which cards each screen shows and in what order. Validated by shape rather
  // than against a list of card names on purpose: the cards live in the page's
  // markup, and a server that had to be redeployed to know about a new one
  // would be a second copy of that list to keep in step. A key the page
  // doesn't recognise is simply ignored when the layout is applied.
  layout: z
    .record(
      z.string().max(40),
      z.object({
        order: z.array(z.string().max(60)).max(40),
        hidden: z.array(z.string().max(60)).max(40),
      }),
    )
    .nullable()
    .optional(),
});

const googleSchema = z.object({
  credential: z.string().min(10),
});

// Undefined (not just falsy) when GOOGLE_SIGNIN_CLIENT_ID is unset, so the
// button-config endpoint and the verify endpoint agree on "configured".
const googleClient = config.GOOGLE_SIGNIN_CLIENT_ID ? new OAuth2Client(config.GOOGLE_SIGNIN_CLIENT_ID) : undefined;

/**
 * The saved layout, or nothing.
 *
 * Text that won't parse reads as no layout rather than as an error: a screen
 * arranged oddly is a small problem, a screen that won't load because one row
 * holds bad JSON is a large one.
 */
function parseLayout(value: string | null | undefined): unknown {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function toPublicUser(user: {
  id: number;
  username: string;
  weekStartWeekday: number;
  weekStartHour: number;
  weekStartMinute: number;
  weightKg?: number | null;
  heightCm?: number | null;
  ageYears?: number | null;
  activityLevel?: string | null;
  weeklyGoalKg?: number | null;
  goalWeightKg?: number | null;
  dailyCalorieTarget?: number | null;
  sex?: string | null;
  macroMode?: string | null;
  proteinTargetG?: number | null;
  carbsTargetG?: number | null;
  fatTargetG?: number | null;
  proteinOp?: string | null;
  carbsOp?: string | null;
  fatOp?: string | null;
  proteinPct?: number | null;
  carbsPct?: number | null;
  fatPct?: number | null;
  reminderHour?: number | null;
  layout?: string | null;
  burnSource?: string | null;
  mealTagsEnabled?: boolean | null;
  mealTagNames?: string | null;
  kcalBufferMode?: string | null;
  kcalBufferPct?: number | null;
  kcalBufferMinPct?: number | null;
  kcalBufferMaxPct?: number | null;
  email?: string | null;
  googleId?: string | null;
  passwordHash?: string | null;
}) {
  return {
    id: user.id,
    username: user.username,
    weekStartWeekday: user.weekStartWeekday,
    weekStartHour: user.weekStartHour,
    weekStartMinute: user.weekStartMinute,
    weightKg: user.weightKg ?? null,
    heightCm: user.heightCm ?? null,
    ageYears: user.ageYears ?? null,
    activityLevel: user.activityLevel ?? null,
    weeklyGoalKg: user.weeklyGoalKg ?? null,
    goalWeightKg: user.goalWeightKg ?? null,
    dailyCalorieTarget: user.dailyCalorieTarget ?? null,
    sex: user.sex ?? null,
    macroMode: user.macroMode ?? null,
    proteinTargetG: user.proteinTargetG ?? null,
    carbsTargetG: user.carbsTargetG ?? null,
    fatTargetG: user.fatTargetG ?? null,
    proteinOp: user.proteinOp ?? null,
    carbsOp: user.carbsOp ?? null,
    fatOp: user.fatOp ?? null,
    proteinPct: user.proteinPct ?? null,
    carbsPct: user.carbsPct ?? null,
    fatPct: user.fatPct ?? null,
    // Resolved server-side so the diary and the settings screen can't drift
    // apart on how a percentage becomes grams.
    macroTargets: resolveMacroTargets(user),
    reminderHour: user.reminderHour ?? null,
    // Stored as a string, since SQLite has no JSON column. A row that somehow
    // holds unparseable text reads as no layout at all rather than breaking
    // every screen it touches.
    layout: parseLayout(user.layout),
    burnSource: readBurnSource(user.burnSource),
    mealTagsEnabled: user.mealTagsEnabled ?? false,
    // Sent resolved rather than raw, so the client never has to know what an
    // unset slot falls back to.
    mealTagNames: readMealTagNames(user.mealTagNames),
    // Resolved rather than raw, so the settings screen shows the figures the
    // estimator will actually use — including the defaults an untouched
    // account is running on.
    kcalBuffer: resolveBuffer(user),
    email: user.email ?? null,
    // The settings screen needs to know which recovery routes exist for this
    // account without being told the secrets behind them.
    hasGoogle: Boolean(user.googleId),
    hasPassword: Boolean(user.passwordHash),
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

  // Throttled per username *and* per source address: keying on the username
  // alone would let anyone lock a known account out by failing at it, and
  // keying on the address alone does nothing against a spread-out attempt.
  const throttleKey = `login:${username.toLowerCase()}:${req.ip ?? "unknown"}`;
  const verdict = consume(throttleKey, LOGIN_BURST);
  if (!verdict.allowed) {
    res.status(429).json({
      error: `Too many attempts. Try again in ${Math.ceil(verdict.retryAfterSec / 60)} minute(s).`,
    });
    return;
  }

  const user = await prisma.user.findUnique({ where: { username } });
  // user.passwordHash is null for Google-only accounts — no password to check.
  const valid = user?.passwordHash ? await verifyPassword(password, user.passwordHash) : false;
  if (!user || !valid) {
    res.status(401).json({ error: "Incorrect username or password." });
    return;
  }

  // A correct password clears the count, so a run of typos before getting it
  // right doesn't leave the account near its limit for the next quarter hour.
  resetRateLimit(throttleKey);
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
    res.status(400).json({ error: "No settings fields provided." });
    return;
  }

  const current = await prisma.user.findUnique({ where: { id: req.userId! } });
  if (!current) {
    res.status(401).json({ error: "Not signed in" });
    return;
  }

  // Validated against the merged result rather than the patch alone: the
  // percentages and the calorie target they divide up can arrive in separate
  // requests, and checking only what's in this one would let the pair end up
  // in a state neither request looked wrong on its own.
  const merged = { ...current, ...parsed.data, layout: current.layout };
  const macroError = validateMacroSettings(merged);
  if (macroError) {
    res.status(400).json({ error: macroError });
    return;
  }

  // The layout and the meal tag names are the fields that aren't stored as
  // they arrive: SQLite has no JSON column, so they go in as text.
  const { layout, mealTagNames, ...fields } = parsed.data;
  const data: Record<string, unknown> = { ...fields };
  if (layout !== undefined) data.layout = layout === null ? null : JSON.stringify(layout);
  // writeMealTagNames drops anything that matches the built-in name, so
  // renaming a slot and changing your mind back leaves a clean row rather than
  // a frozen copy of the defaults.
  if (mealTagNames !== undefined) data.mealTagNames = writeMealTagNames(mealTagNames);

  const user = await prisma.user.update({ where: { id: req.userId! }, data });

  // Changing the rollover re-slices every week the user has ever logged, and
  // entries are filed against a week's exact boundaries — so without this the
  // diary would show an empty week and it would look like the history had
  // been thrown away.
  const rolloverChanged =
    (parsed.data.weekStartWeekday !== undefined && parsed.data.weekStartWeekday !== current.weekStartWeekday)
    || (parsed.data.weekStartHour !== undefined && parsed.data.weekStartHour !== current.weekStartHour)
    || (parsed.data.weekStartMinute !== undefined && parsed.data.weekStartMinute !== current.weekStartMinute);

  if (rolloverChanged) {
    await refileMatchWeeks(user.id, {
      weekday: user.weekStartWeekday,
      hour: user.weekStartHour,
      minute: user.weekStartMinute,
    });
  }

  res.json(toPublicUser(user));
});

/** Human-readable reason the macro targets don't hang together, or null. */
function validateMacroSettings(user: {
  macroMode?: string | null;
  dailyCalorieTarget?: number | null;
  proteinPct?: number | null;
  carbsPct?: number | null;
  fatPct?: number | null;
  proteinTargetG?: number | null;
  carbsTargetG?: number | null;
  fatTargetG?: number | null;
}): string | null {
  if (!user.macroMode) return null;

  if (user.macroMode === "percent") {
    if (!user.dailyCalorieTarget) {
      return "Percentage targets need a daily calorie target to divide up — set one first.";
    }
    const total = (user.proteinPct ?? 0) + (user.carbsPct ?? 0) + (user.fatPct ?? 0);
    if (total !== 100) {
      return `Your percentages add up to ${total}%. They need to make 100%.`;
    }
    return null;
  }

  // Blanks are allowed and mean "don't track this one", so the only thing
  // that has to hold is that at least one macro is being tracked — otherwise
  // macros are on with nothing to show, which is just a worse "off".
  const grams = (user.proteinTargetG ?? 0) + (user.carbsTargetG ?? 0) + (user.fatTargetG ?? 0);
  if (grams === 0) return "Set at least one macro target, or turn macros off.";
  return null;
}

// ---------------------------------------------------------------------------
// Account recovery
//
// Two routes back into a locked-out account, because neither works on its
// own for every account: an emailed reset link needs both a mail provider and
// an address on file, and Google sign-in only helps if the account is linked.
// GET /recovery-options says which apply before the user commits to one.
// ---------------------------------------------------------------------------

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

function hashResetToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

authRouter.get("/recovery-options", (_req, res) => {
  res.json({
    email: canSendMail(),
    google: Boolean(config.GOOGLE_SIGNIN_CLIENT_ID),
  });
});

const forgotSchema = z.object({ username: z.string().trim().min(1).max(200) });

authRouter.post("/forgot", async (req, res) => {
  const parsed = forgotSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const verdict = consume(`forgot:${req.ip ?? "unknown"}`, RESET_BURST);
  if (!verdict.allowed) {
    res.status(429).json({ error: "Too many reset requests. Try again later." });
    return;
  }

  if (!canSendMail()) {
    res.status(503).json({
      error: "Email reset isn't set up on this server. If your account is linked to Google, sign in with Google instead.",
    });
    return;
  }

  const identifier = parsed.data.username;
  // Accepts either, because someone who has forgotten their password may well
  // have forgotten which of the two they signed up with.
  const user =
    (await prisma.user.findUnique({ where: { username: identifier } })) ??
    (await prisma.user.findUnique({ where: { email: identifier } }));

  if (user?.email) {
    const token = crypto.randomBytes(32).toString("hex");
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hashResetToken(token),
        expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
      },
    });

    const link = `${config.APP_BASE_URL}/?reset=${token}`;
    await sendMail({
      to: user.email,
      subject: "Reset your food diary password",
      text: `Someone asked to reset the password for "${user.username}".\n\nOpen this link within the hour to choose a new one:\n${link}\n\nIf that wasn't you, ignore this email — nothing has changed.`,
    });
  }

  // Deliberately the same answer whether or not the account exists, so this
  // endpoint can't be used to find out which usernames are real.
  res.json({ ok: true });
});

const resetSchema = z.object({
  token: z.string().min(10),
  password: z.string().min(8).max(200),
});

authRouter.post("/reset", async (req, res) => {
  const parsed = resetSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Choose a password of at least 8 characters." });
    return;
  }

  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashResetToken(parsed.data.token) },
  });
  if (!record || record.usedAt || record.expiresAt < new Date()) {
    res.status(400).json({ error: "That reset link has expired. Request a new one." });
    return;
  }

  const passwordHash = await hashPassword(parsed.data.password);
  await prisma.$transaction([
    prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
    prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    // Any other outstanding link for this account stops working too — a reset
    // that leaves a second live link behind hasn't really secured anything.
    prisma.passwordResetToken.updateMany({
      where: { userId: record.userId, usedAt: null },
      data: { usedAt: new Date() },
    }),
  ]);

  // A reset is the response to "someone may have my password", so every
  // existing session goes with it.
  await revokeAllSessions(record.userId);

  const user = await prisma.user.findUnique({ where: { id: record.userId } });
  if (!user) {
    res.status(400).json({ error: "That account no longer exists." });
    return;
  }
  await setSessionCookie(res, user.id);
  res.json(toPublicUser(user));
});

// ---------------------------------------------------------------------------
// Signed-in account management
// ---------------------------------------------------------------------------

const passwordChangeSchema = z.object({
  // Absent for a Google-only account setting its first password — there is no
  // current password to prove.
  currentPassword: z.string().optional(),
  newPassword: z.string().min(8).max(200),
});

authRouter.post("/password", requireAuth, async (req, res) => {
  const parsed = passwordChangeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Choose a password of at least 8 characters." });
    return;
  }

  const user = await prisma.user.findUnique({ where: { id: req.userId! } });
  if (!user) {
    res.status(401).json({ error: "Not signed in" });
    return;
  }

  if (user.passwordHash) {
    const ok = parsed.data.currentPassword
      ? await verifyPassword(parsed.data.currentPassword, user.passwordHash)
      : false;
    if (!ok) {
      res.status(403).json({ error: "That's not your current password." });
      return;
    }
  }

  const passwordHash = await hashPassword(parsed.data.newPassword);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
  await revokeAllSessions(user.id);
  // The device that just changed the password shouldn't be signed out by its
  // own action, so it gets a fresh token on the way out.
  await setSessionCookie(res, user.id);
  res.json({ ok: true });
});

const emailSchema = z.object({ email: z.string().trim().email().max(200).nullable() });

authRouter.post("/email", requireAuth, async (req, res) => {
  const parsed = emailSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "That doesn't look like an email address." });
    return;
  }

  const email = parsed.data.email;
  if (email) {
    const clash = await prisma.user.findUnique({ where: { email } });
    if (clash && clash.id !== req.userId) {
      res.status(409).json({ error: "Another account already uses that address." });
      return;
    }
  }

  const user = await prisma.user.update({ where: { id: req.userId! }, data: { email } });
  res.json(toPublicUser(user));
});

authRouter.post("/link-google", requireAuth, async (req, res) => {
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

  const claimed = await prisma.user.findUnique({ where: { googleId: payload.sub } });
  if (claimed && claimed.id !== req.userId) {
    res.status(409).json({ error: "That Google account is already linked to another account." });
    return;
  }
  // Linking is only ever done deliberately by someone already signed in —
  // never inferred from a matching email address, which anyone can type into
  // the settings screen.
  const existingEmail = await prisma.user.findUnique({ where: { email: payload.email } });
  const user = await prisma.user.update({
    where: { id: req.userId! },
    data: {
      googleId: payload.sub,
      email: existingEmail && existingEmail.id !== req.userId ? undefined : payload.email,
    },
  });
  res.json(toPublicUser(user));
});

authRouter.post("/logout-everywhere", requireAuth, async (req, res) => {
  await revokeAllSessions(req.userId!);
  clearSessionCookie(res);
  res.status(204).end();
});

const deleteSchema = z.object({
  // Typed back by the user, so a mis-tap on a destructive button can't take
  // the account with it.
  confirm: z.string(),
  password: z.string().optional(),
});

authRouter.delete("/me", requireAuth, async (req, res) => {
  const parsed = deleteSchema.safeParse(req.body);
  const user = await prisma.user.findUnique({ where: { id: req.userId! } });
  if (!user) {
    res.status(401).json({ error: "Not signed in" });
    return;
  }
  if (!parsed.success || parsed.data.confirm !== user.username) {
    res.status(400).json({ error: "Type your username exactly to confirm." });
    return;
  }
  if (user.passwordHash) {
    const ok = parsed.data.password ? await verifyPassword(parsed.data.password, user.passwordHash) : false;
    if (!ok) {
      res.status(403).json({ error: "That's not your password." });
      return;
    }
  }

  await deleteAccount(user.id);
  clearSessionCookie(res);
  res.status(204).end();
});
