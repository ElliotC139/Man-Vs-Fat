/**
 * The invite screen's data, and the code that resolves an invite link.
 *
 * What this file does *not* do is pay anybody. The reward is granted in
 * src/routes/billing.ts, off a signed Stripe webhook, because a payment
 * landing is the only event that may move money — see src/referrals.ts for
 * why the whole scheme is built that way round.
 */

import { Router } from "express";
import { prisma } from "../db";
import { requireAuth } from "../auth";
import { config, stripeConfigured } from "../config";
import { planFor } from "../plans";
import {
  REFERRAL_REWARD_CAP,
  REFERRAL_TRIAL_DAYS,
  generateReferralCode,
  normalizeReferralCode,
  referralUrl,
} from "../referrals";

export const referralsRouter = Router();

/**
 * This account's code, minting one if it hasn't got one.
 *
 * Minted here rather than at signup so the column stays empty for the
 * accounts that never share a link — which is most of them — and so accounts
 * that predate the scheme get one the first time they look, with no backfill.
 *
 * The retry loop is for the collision that will essentially never happen:
 * seven characters from a 31-character alphabet is about 28 billion codes. It
 * exists because "essentially never" and "never" are different, and the
 * failure mode without it is a 500 on a screen someone opened to share a link.
 */
async function codeFor(userId: number, existing: string | null): Promise<string | null> {
  if (existing) return existing;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = generateReferralCode();
    try {
      await prisma.user.update({ where: { id: userId }, data: { referralCode: code } });
      return code;
    } catch {
      // Taken. Draw again.
    }
  }
  return null;
}

/** Everything the invite screen shows. */
referralsRouter.get("/", requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.userId! },
    select: { id: true, plan: true, referralCode: true, referredById: true, referralTrialUsed: true },
  });
  if (!user) {
    res.status(401).json({ error: "Not signed in" });
    return;
  }

  const code = await codeFor(user.id, user.referralCode);

  const [invited, converted] = await Promise.all([
    prisma.user.count({ where: { referredById: user.id } }),
    prisma.user.count({ where: { referredById: user.id, referralRewardedAt: { not: null } } }),
  ]);

  const plan = planFor(user.plan);
  // What the next conversion is worth: a month of their own plan, or a month
  // of Plus for someone who isn't paying yet — which only becomes real if
  // they upgrade, and is the reason to.
  const nextRewardPence = plan.pricePence > 0 ? plan.pricePence : planFor("plus").pricePence;

  res.json({
    // Off where there is no card processor: the invited account's free month
    // is a Stripe trial and the reward is Stripe credit, so with no keys there
    // is nothing to promise. The screen says so rather than handing out links
    // to an offer that can't be honoured.
    configured: stripeConfigured,
    code,
    url: code ? referralUrl(config.APP_BASE_URL, code) : null,
    trialDays: REFERRAL_TRIAL_DAYS,
    invited,
    converted,
    nextRewardPence,
    earnedPence: converted * nextRewardPence,
    rewardCap: REFERRAL_REWARD_CAP,
    capReached: converted >= REFERRAL_REWARD_CAP,
    // Whether *this* account still has a free month waiting. Someone who
    // arrived on a link and hasn't subscribed yet should be told so on the
    // plan screen, not left to find out at the checkout.
    trialWaiting: Boolean(user.referredById) && !user.referralTrialUsed,
  });
});

/**
 * Who a code belongs to. Public, because the person following the link isn't
 * signed in yet — that is the whole point of the link.
 *
 * It answers with a username, which is a deliberate, bounded disclosure: it is
 * the name the referrer chose to attach to a link they are handing out, and
 * without it the sign-up page can only say "someone invited you", which reads
 * like a trick. Codes are seven random characters, so this is not a way to
 * enumerate accounts, and it says nothing about a code that doesn't exist
 * beyond that it doesn't.
 */
referralsRouter.get("/invite/:code", async (req, res) => {
  const code = normalizeReferralCode(req.params.code);
  if (!code) {
    res.json({ valid: false });
    return;
  }

  const referrer = await prisma.user.findUnique({
    where: { referralCode: code },
    select: { username: true },
  });

  res.json(
    referrer
      ? { valid: true, name: referrer.username, trialDays: REFERRAL_TRIAL_DAYS }
      : { valid: false },
  );
});
