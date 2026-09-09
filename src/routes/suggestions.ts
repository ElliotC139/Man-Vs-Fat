/**
 * "Suggest an update" — and the pile it lands in.
 *
 * Deliberately not a mailto: link. The useful half of a suggestion is the
 * context around it — which version they were on, what kind of thing it is,
 * who to go back to — and an email loses all three and arrives among
 * everything else. This keeps them together and puts the unhandled ones in
 * front of whoever is going to act on them.
 *
 * Nothing here calls a model. A suggestion box that costs money per suggestion
 * is one you end up rationing, which is the opposite of the point.
 */

import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { requireAuth } from "../auth";
import { isAdminUser } from "../adminAccess";
import { consume, type RateLimitRule } from "../rateLimit";

export const suggestionsRouter = Router();
suggestionsRouter.use(requireAuth);

export const KINDS = ["idea", "problem", "other"] as const;

/**
 * Enough for a paragraph and a bit, and short of a novel.
 *
 * A ceiling is here at all because this writes to the database on an
 * authenticated request, and anything that does needs one.
 */
const MAX_BODY = 2000;

/**
 * Six a day. Generous for anyone with something to say and low enough that
 * the table can't be used as free storage.
 */
const SUGGESTION_LIMIT: RateLimitRule = { limit: 6, windowMs: 24 * 60 * 60 * 1000 };

const createSchema = z.object({
  kind: z.enum(KINDS).default("idea"),
  body: z.string().trim().min(4).max(MAX_BODY),
});

suggestionsRouter.post("/", async (req, res) => {
  const parsed = createSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: "Write a sentence or two about what you'd change." });
    return;
  }

  const verdict = consume(`suggest:${req.userId!}`, SUGGESTION_LIMIT);
  if (!verdict.allowed) {
    res.status(429)
      .set("Retry-After", String(verdict.retryAfterSec))
      .json({ error: "That's a few suggestions today — keep them coming tomorrow." });
    return;
  }

  const suggestion = await prisma.suggestion.create({
    data: {
      userId: req.userId!,
      kind: parsed.data.kind,
      body: parsed.data.body,
      // Trimmed: a user agent is long, and the useful part is the front of it.
      appVersion: typeof req.body?.appVersion === "string" ? req.body.appVersion.slice(0, 40) : null,
      userAgent: typeof req.headers["user-agent"] === "string"
        ? req.headers["user-agent"].slice(0, 300)
        : null,
    },
    select: { id: true, createdAt: true },
  });

  res.status(201).json(suggestion);
});

/** The pile, for whoever is going to act on it. */
suggestionsRouter.get("/", async (req, res) => {
  const me = await prisma.user.findUnique({
    where: { id: req.userId! },
    select: { username: true, isAdmin: true },
  });
  if (!me || !isAdminUser(me)) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const suggestions = await prisma.suggestion.findMany({
    // Unhandled first, then newest — which is the order somebody works
    // through them in.
    orderBy: [{ handled: "asc" }, { createdAt: "desc" }],
    take: 200,
    include: { user: { select: { username: true } } },
  });

  res.json({
    suggestions: suggestions.map((suggestion) => ({
      id: suggestion.id,
      kind: suggestion.kind,
      body: suggestion.body,
      handled: suggestion.handled,
      createdAt: suggestion.createdAt,
      from: suggestion.user.username,
      appVersion: suggestion.appVersion,
    })),
  });
});

suggestionsRouter.patch("/:id", async (req, res) => {
  const me = await prisma.user.findUnique({
    where: { id: req.userId! },
    select: { username: true, isAdmin: true },
  });
  if (!me || !isAdminUser(me)) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const id = Number(req.params.id);
  const handled = req.body?.handled;
  if (!Number.isInteger(id) || typeof handled !== "boolean") {
    res.status(400).json({ error: "Send { handled: true } or { handled: false }." });
    return;
  }

  const updated = await prisma.suggestion.update({ where: { id }, data: { handled } })
    .catch(() => null);
  if (!updated) {
    res.status(404).json({ error: "No such suggestion." });
    return;
  }
  res.json({ id: updated.id, handled: updated.handled });
});
