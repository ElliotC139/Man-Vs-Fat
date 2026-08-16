import crypto from "node:crypto";
import { Router } from "express";
import { prisma } from "../db";
import { config, whoopConfigured } from "../config";
import { requireAuth } from "../auth";
import { localDayKey } from "../matchWeek";
import { buildAuthorizeUrl, exchangeCodeForTokens } from "../whoop/client";
import { syncUser } from "../whoop/sync";

export const whoopRouter = Router();

const STATE_COOKIE = "whoop_oauth_state";
const STATE_COOKIE_MAX_AGE_MS = 10 * 60 * 1000;

whoopRouter.get("/connect", requireAuth, (_req, res) => {
  if (!whoopConfigured) {
    res.status(503).json({ error: "WHOOP isn't configured on this server yet." });
    return;
  }
  const state = crypto.randomBytes(24).toString("hex");
  res.cookie(STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: STATE_COOKIE_MAX_AGE_MS,
  });
  res.redirect(buildAuthorizeUrl(state));
});

whoopRouter.get("/callback", requireAuth, async (req, res) => {
  const expectedState = req.cookies?.[STATE_COOKIE];
  res.clearCookie(STATE_COOKIE);

  const { code, state, error, error_description } = req.query;
  if (error) {
    // Temporary: surfaces WHOOP's real rejection reason (e.g. a scope the
    // developer app hasn't been granted) instead of a generic message.
    const reason = typeof error_description === "string" ? error_description : String(error);
    res.redirect(`/?whoop=error&reason=${encodeURIComponent(reason)}`);
    return;
  }
  if (typeof code !== "string" || typeof state !== "string" || state !== expectedState) {
    res.redirect("/?whoop=error&reason=" + encodeURIComponent("State mismatch or missing code — please try again."));
    return;
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    await prisma.whoopConnection.upsert({
      where: { userId: req.userId! },
      update: { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, expiresAt: tokens.expiresAt },
      create: {
        userId: req.userId!,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: tokens.expiresAt,
      },
    });

    // Backfill so this week isn't empty; failure here shouldn't block the
    // connection itself — the webhook and next scheduled sync will catch up.
    await syncUser(req.userId!).catch((e) => console.error("Initial WHOOP sync failed:", e));

    res.redirect("/?whoop=connected");
  } catch (e) {
    console.error("WHOOP token exchange failed:", e);
    const reason = e instanceof Error ? e.message : String(e);
    res.redirect(`/?whoop=error&reason=${encodeURIComponent(reason)}`);
  }
});

whoopRouter.get("/status", requireAuth, async (req, res) => {
  const conn = await prisma.whoopConnection.findUnique({ where: { userId: req.userId! } });
  res.json({
    configured: whoopConfigured,
    connected: Boolean(conn),
    lastSyncedAt: conn?.lastSyncedAt ?? null,
    // Temporary diagnostic — lets a stuck refresh be told apart from a
    // genuinely revoked token by checking whether expiresAt looks sane.
    expiresAt: conn?.expiresAt ?? null,
  });
});

whoopRouter.post("/disconnect", requireAuth, async (req, res) => {
  await prisma.whoopCycle.deleteMany({ where: { userId: req.userId! } });
  await prisma.whoopConnection.deleteMany({ where: { userId: req.userId! } });
  res.status(204).end();
});

// Temporary diagnostic — shows the raw cycle data WHOOP actually returned,
// so a "day X is still showing an estimate" report can be told apart from
// "WHOOP hasn't scored that cycle yet" (score_state stays PENDING_SCORE,
// often because that night's sleep wasn't recorded) vs a real sync bug.
whoopRouter.get("/debug/cycles", requireAuth, async (req, res) => {
  const cycles = await prisma.whoopCycle.findMany({
    where: { userId: req.userId! },
    orderBy: { start: "desc" },
    take: 14,
  });
  res.json(
    cycles.map((c) => ({
      date: localDayKey(c.start, config.TIMEZONE),
      start: c.start,
      end: c.end,
      scoreState: c.scoreState,
      kcalBurned: c.kcalBurned,
      updatedAt: c.updatedAt,
    })),
  );
});

whoopRouter.post("/sync", requireAuth, async (req, res) => {
  try {
    await syncUser(req.userId!);
    res.status(204).end();
  } catch (e) {
    console.error("Manual WHOOP sync failed:", e);
    // Temporary: surfaces the real failure reason so it can be diagnosed
    // without Fly log access, rather than a generic message.
    const message = e instanceof Error ? e.message : String(e);
    res.status(502).json({ error: `Couldn't sync with WHOOP: ${message}` });
  }
});

// WHOOP posts here on cycle/workout/etc. updates. No session cookie is
// available (WHOOP is the caller, not the browser), so this route is
// intentionally outside requireAuth and instead resolves the WHOOP user id
// in the payload back to our own user via the WhoopConnection.whoopUserId
// captured at first sync.
whoopRouter.post("/webhook", async (req, res) => {
  // Ack immediately — WHOOP retries on non-2xx, and there's no need to make
  // it wait on our resync.
  res.status(200).end();

  try {
    const whoopUserId = req.body?.user_id;
    if (whoopUserId === undefined || whoopUserId === null) return;

    const conn = await prisma.whoopConnection.findFirst({ where: { whoopUserId: BigInt(whoopUserId) } });
    if (!conn) return;

    await syncUser(conn.userId);
  } catch (e) {
    console.error("WHOOP webhook handling failed:", e);
  }
});
