import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { sessionUserId } from "../auth";
import { consume, type RateLimitRule } from "../rateLimit";
import { ROADMAP, isRoadmapId } from "../roadmap";

/**
 * "I'd use that" — from people who have not signed up, which is the point.
 *
 * Every other signal this app collects comes from someone who already made an
 * account. That measures the people who stayed, and says nothing about the
 * ones who looked at the landing page, didn't see the thing they own, and
 * left. Those are exactly the people whose answer would change what gets
 * built next, and they are unreachable by every other means here.
 *
 * So this router is deliberately unauthenticated. That has consequences, and
 * they are handled rather than ignored:
 *
 *   - the item id is checked against src/roadmap.ts, so the table cannot be
 *     filled with arbitrary strings;
 *   - the address, if given, is validated and length-capped;
 *   - a burst limit is keyed on the caller's address;
 *   - a repeat vote is a no-op rather than a second row, enforced by a unique
 *     index instead of by trusting the browser.
 *
 * None of that makes the number unspoofable. It doesn't need to be. It is a
 * rough demand gauge read by one person deciding what to build, not a ballot.
 */
export const roadmapRouter = Router();

/**
 * Generous per address, because a household or an office behind one NAT is a
 * normal way for several real votes to arrive at once, and the failure mode
 * of being too strict is silently losing the signal this exists to collect.
 */
const VOTE_BURST: RateLimitRule = { limit: 30, windowMs: 10 * 60 * 1000 };

/** Long enough for any real address, short enough not to be a payload. */
const MAX_EMAIL = 254;

const voteSchema = z.object({
  itemId: z.string(),
  // Optional throughout: a vote is worth having on its own, and demanding an
  // address for it would cost more signal than the address is worth.
  email: z.string().trim().max(MAX_EMAIL).email().optional().or(z.literal("")),
  browserKey: z.string().trim().min(8).max(64).optional(),
});

/** The list itself, for anything that would rather read it than hardcode it. */
roadmapRouter.get("/", (_req, res) => {
  res.json({ items: ROADMAP });
});

roadmapRouter.post("/vote", async (req, res) => {
  const verdict = consume(`roadmap:${req.ip ?? "unknown"}`, VOTE_BURST);
  if (!verdict.allowed) {
    res.status(429).json({ error: "That's plenty of votes for now. Try again shortly." });
    return;
  }

  const parsed = voteSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "That isn't something we can record." });
    return;
  }

  const { itemId } = parsed.data;
  if (!isRoadmapId(itemId)) {
    // Flat 400 rather than naming the valid ids: this is the only guard that
    // keeps the table to a known set, and it owes an unknown caller nothing.
    res.status(400).json({ error: "That isn't something we can record." });
    return;
  }

  const email = parsed.data.email ? parsed.data.email.toLowerCase() : null;
  const browserKey = parsed.data.browserKey ?? null;
  // Present only when the vote came from inside the app; the landing page has
  // no session by definition, since a signed-in visitor is served the app.
  const userId = await sessionUserId(req);

  try {
    await prisma.roadmapVote.create({ data: { itemId, email, userId, browserKey } });
  } catch (error) {
    // P2002 is a unique-index collision, and both of this table's unique
    // indexes mean the same thing: we already have this person's opinion on
    // this item. Saying "noted" to a second tap is honest — it *is* noted —
    // and telling somebody off for tapping twice would be strange.
    //
    // Narrow rather than a bare catch, because the bare version answered
    // "recorded" when the database was down. A vote that was never written is
    // not a vote, and the one place that must not quietly lie about whether
    // something was saved is the feature whose entire output is a count.
    if ((error as { code?: string })?.code === "P2002") {
      res.json({ recorded: true, duplicate: true });
      return;
    }
    console.error("Could not record a roadmap vote:", error);
    res.status(500).json({ error: "Couldn't record that. Try again in a moment." });
    return;
  }

  res.json({ recorded: true, duplicate: false });
});
