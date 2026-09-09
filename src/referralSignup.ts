/**
 * Turning a referral code from a sign-up form into a referrer's id.
 *
 * Its own file rather than a function in routes/referrals.ts because the
 * auth routes need it and importing a router to get at one helper drags a
 * whole route table into the sign-up path.
 *
 * Never throws and never refuses: a code that doesn't resolve — mistyped,
 * stale, or belonging to a deleted account — produces null and the account is
 * created without a referrer. A broken invite link should cost somebody a
 * free month, not an account.
 */

import { prisma } from "./db";
import { normalizeReferralCode } from "./referrals";

export async function referrerIdForCode(raw: unknown): Promise<number | null> {
  const code = normalizeReferralCode(raw);
  if (!code) return null;
  try {
    const referrer = await prisma.user.findUnique({
      where: { referralCode: code },
      select: { id: true },
    });
    return referrer?.id ?? null;
  } catch (error) {
    console.error("Failed to resolve a referral code:", error);
    return null;
  }
}
