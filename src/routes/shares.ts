/**
 * Handing a few logged items to someone else.
 *
 * "Here's what I had, add it to yours" over WhatsApp used to mean typing it
 * out at the other end. A share freezes a copy of the items behind an
 * unguessable token; the link can be pasted anywhere, and whoever opens it can
 * add the lot to their own day in one tap.
 *
 * Three deliberate limits:
 *
 *   - The token is the only way in, and it is random rather than derived from
 *     anything about the sender. There is no listing endpoint and no guessable
 *     id, so a link is a capability and nothing else is reachable through it.
 *   - Only labels and figures cross. No photos, no notes, no timestamps, no
 *     username — the recipient learns what was eaten, not whose diary it came
 *     from or when.
 *   - Shares expire. A link that works forever is a link that leaks forever.
 *
 * Accepting is an ordinary authenticated write to the recipient's own diary,
 * so a share can never put anything anywhere without someone signed in asking
 * for it.
 */

import { Router } from "express";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { prisma } from "../db";
import { config } from "../config";
import { requireAuth } from "../auth";
import { findOrCreateMatchWeek, getLocalParts, getUserWeekStart } from "../matchWeek";
import { MEAL_TYPES, inferMealType } from "../mealType";
import { timestampOnLocalDay } from "../entryTiming";

export const sharesRouter = Router();

/** A fortnight: long enough for a link to survive a slow reply, short enough
 *  that a forwarded message doesn't stay live for years. */
const SHARE_TTL_MS = 14 * 24 * 60 * 60 * 1000;

/** 16 random bytes, base64url. Long enough that guessing is hopeless, short
 *  enough that the link still fits in a message without wrapping. */
function newToken(): string {
  return randomBytes(16).toString("base64url");
}

const shareItemSchema = z.object({
  label: z.string().trim().min(1).max(200),
  kcal: z.number().int().min(0).max(20000).nullable(),
  proteinG: z.number().min(0).max(1000).nullable().optional(),
  carbsG: z.number().min(0).max(1000).nullable().optional(),
  fatG: z.number().min(0).max(1000).nullable().optional(),
  quantity: z.number().min(0.01).max(5000).optional(),
  // What one of them is, so a shared "2 slices" arrives as two slices rather
  // than as a number with nothing attached.
  unitLabel: z.string().trim().max(20).nullable().optional(),
});

type ShareItem = z.infer<typeof shareItemSchema>;

const createSchema = z.object({
  title: z.string().trim().max(80).optional(),
  entryIds: z.array(z.number().int().positive()).min(1).max(50),
});

/** Builds a share out of entries the sender actually owns. */
sharesRouter.post("/", requireAuth, async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const { title, entryIds } = parsed.data;

  // Scoped to the sender: an id belonging to someone else simply isn't found,
  // so a share can only ever contain the sender's own food.
  const entries = await prisma.entry.findMany({
    where: { id: { in: entryIds }, matchWeek: { userId: req.userId! } },
    orderBy: { timestamp: "asc" },
    select: {
      label: true, kcal: true, proteinG: true, carbsG: true, fatG: true,
      quantity: true, unitLabel: true,
    },
  });
  if (entries.length === 0) {
    res.status(404).json({ error: "None of those entries were found." });
    return;
  }

  const items: ShareItem[] = entries.map((entry) => ({
    label: entry.label,
    kcal: entry.kcal,
    proteinG: entry.proteinG,
    carbsG: entry.carbsG,
    fatG: entry.fatG,
    quantity: entry.quantity,
    unitLabel: entry.unitLabel,
  }));

  const share = await prisma.foodShare.create({
    data: {
      token: newToken(),
      userId: req.userId!,
      title: title || null,
      items: JSON.stringify(items),
      expiresAt: new Date(Date.now() + SHARE_TTL_MS),
    },
  });

  res.status(201).json({
    token: share.token,
    url: `${config.APP_BASE_URL}/s/${share.token}`,
    expiresAt: share.expiresAt,
    items,
  });
});

/**
 * Reads the items behind a token, or the fact that there aren't any.
 *
 * Deliberately unauthenticated: the whole point is that a link works for
 * whoever it was sent to, including someone who has never opened the app. What
 * it returns is only food, and an expired or unknown token is a flat 404
 * either way, so a token cannot be probed for existence.
 */
sharesRouter.get("/:token", async (req, res) => {
  const share = await prisma.foodShare.findUnique({ where: { token: String(req.params.token) } });
  if (!share || share.expiresAt.getTime() < Date.now()) {
    res.status(404).json({ error: "That link has expired or doesn't exist." });
    return;
  }

  res.json({
    title: share.title,
    items: parseShareItems(share.items),
    expiresAt: share.expiresAt,
  });
});

const acceptSchema = z.object({
  // Which day to put them on, defaulting to today.
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  mealType: z.enum(MEAL_TYPES).nullable().optional(),
});

/**
 * Adds a share's items to the signed-in user's own diary.
 *
 * The write is theirs, on their day, with their session — a link on its own
 * can put nothing anywhere.
 */
sharesRouter.post("/:token/accept", requireAuth, async (req, res) => {
  const parsed = acceptSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const { date, mealType: chosenMeal } = parsed.data;

  const share = await prisma.foodShare.findUnique({ where: { token: String(req.params.token) } });
  if (!share || share.expiresAt.getTime() < Date.now()) {
    res.status(404).json({ error: "That link has expired or doesn't exist." });
    return;
  }

  const items = parseShareItems(share.items);
  if (items.length === 0) {
    res.status(404).json({ error: "There's nothing in that link." });
    return;
  }

  const timestamp = date ? timestampOnLocalDay(date, new Date(), chosenMeal) : new Date();
  const weekStart = await getUserWeekStart(req.userId!);
  const matchWeek = await findOrCreateMatchWeek(timestamp, config.TIMEZONE, req.userId!, weekStart);
  const mealType = chosenMeal === undefined
    ? inferMealType(getLocalParts(timestamp, config.TIMEZONE).hour)
    : chosenMeal;

  const created = await prisma.$transaction(
    items.map((item) =>
      prisma.entry.create({
        data: {
          timestamp,
          rawInput: null,
          label: item.label,
          kcal: item.kcal,
          quantity: item.quantity ?? 1,
          unitLabel: item.unitLabel ?? null,
          proteinG: item.proteinG ?? null,
          carbsG: item.carbsG ?? null,
          fatG: item.fatG ?? null,
          imageUrl: null,
          mealType,
          mealTypeSet: chosenMeal !== undefined,
          // Someone else's estimate is still an estimate, and saying so keeps
          // the diary honest about how much to trust the figure.
          source: "ai",
          matchWeekId: matchWeek.id,
        },
      }),
    ),
  );

  res.status(201).json(created);
});

/**
 * Whatever is in the column, as items — never an exception.
 *
 * The column is text, so it can in principle hold anything; a share that can't
 * be read is an empty one rather than a 500, and the caller already handles
 * "nothing in that link".
 */
function parseShareItems(stored: string): ShareItem[] {
  try {
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => shareItemSchema.safeParse(item))
      .filter((result): result is { success: true; data: ShareItem } => result.success)
      .map((result) => result.data);
  } catch {
    return [];
  }
}
