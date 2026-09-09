/**
 * The referral scheme: what it pays, and why it can't lose money.
 *
 * The rule the whole design turns on: **nobody is paid for a signup.** A
 * signup costs money to serve and brings in nothing, so a scheme that rewards
 * one is a scheme that pays people to create accounts — and the people who
 * take that offer up hardest are the ones creating accounts in bulk. Every
 * reward here is triggered by a *payment landing*, which is the one event
 * that can't be manufactured for free.
 *
 * ── The two halves ────────────────────────────────────────────────────────
 *
 * **The person invited** gets their first month free, on whichever paid plan
 * they choose. It is granted by Stripe as a trial on the subscription, which
 * means a card goes on file before it starts. That card is the anti-farming
 * property: a free month you have to enter a real card to claim is not worth
 * farming, and it is also the strongest possible version of the offer for
 * someone genuinely deciding whether to pay.
 *
 * The exposure is one month of that plan's AI ceiling — at most £2 on Plus,
 * £4.50 on Pro — and it is bounded by the same meter every account runs
 * against (src/entitlements.ts). There is no separate, un-ceilinged path.
 *
 * **The person who invited them** gets a month of their own plan's price back,
 * as credit on their Stripe customer, the moment the invited account's first
 * *real* invoice is paid. Not at signup, not when the trial starts, not when
 * checkout completes — when money arrives. Because that invoice is a full
 * month at list price and the reward is capped at a month of the *referrer's*
 * plan, the worst case is that a £9.99 Pro referrer is credited £9.99 out of a
 * £9.99 payment: the scheme breaks even on that customer's first month and
 * profits on every month after. It cannot go negative.
 *
 * Credit rather than a free month toggled in this app's own database for two
 * reasons: it survives a plan change (£4.99 of credit is £4.99 whatever they
 * later switch to), and it works for a referrer who hasn't subscribed yet —
 * the credit sits on their customer record and eats their first invoice
 * whenever they do. "Your first month is on us when you upgrade" is a better
 * offer to a free-tier user than anything this app could grant itself.
 *
 * ── The worked trace, because "will it always be profitable" is the ask ───
 *
 * Alice is on the free tier and invites Bob, who takes Plus.
 *
 *   Day 0   Bob checks out with a card. Stripe raises a £0 invoice for the
 *           trial. amount_paid is zero, so nothing is paid out.
 *   Day 30  Bob's first real invoice, £4.99, is paid. Alice is credited
 *           £4.99, which sits on her customer until she subscribes.
 *
 * At that moment: £4.99 has arrived. Against it, Bob's free month cost at
 * most his plan's £2 ceiling, and Alice's free month will cost at most £2 of
 * hers. Worst case the pair clears about £1 in the first month — and from the
 * second month on, two accounts are paying £4.99 each where before there was
 * one free account earning pennies in ads. The acquisition cost is real,
 * bounded by ceilings the meter enforces, and paid for out of the payment
 * that triggered it.
 *
 * The self-referral is the same arithmetic and lands in the same place:
 * inviting yourself means funding a second real subscription out of your own
 * pocket to earn one month back. It clears, and it is not worth doing.
 *
 * ── Why there is a cap at all ─────────────────────────────────────────────
 *
 * Each reward is funded by a payment, so the arithmetic is safe at any
 * volume. The cap is not there for the arithmetic; it is there because an
 * uncapped scheme is an open-ended liability that somebody could scale into a
 * business relationship this app never agreed to. Past the cap the invites
 * still work and still convert — they just stop paying out, and the screen
 * says so rather than silently banking nothing.
 */

/**
 * How long the invited account's free month runs, in days.
 *
 * Thirty rather than "one month" because Stripe counts trials in days, and
 * because a fixed number is a promise that reads the same in February.
 */
export const REFERRAL_TRIAL_DAYS = 30;

/** How many referrals one account may ever be paid for. */
export const REFERRAL_REWARD_CAP = 25;

/**
 * The alphabet referral codes are drawn from.
 *
 * No 0/O, 1/I/L: a code's whole job is to survive being read off a screen and
 * typed on a phone, and those are the characters that don't. Uppercase
 * because a code in a URL should look like a code.
 */
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 7;

/** A fresh code. Random, not derived from the username — a code is public. */
export function generateReferralCode(random: () => number = Math.random): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i += 1) {
    code += CODE_ALPHABET[Math.floor(random() * CODE_ALPHABET.length)];
  }
  return code;
}

/**
 * A code as typed, cleaned up for comparison.
 *
 * Case is folded and anything that isn't in the alphabet is dropped, so a code
 * pasted with a stray space, a trailing full stop, or in lowercase off the end
 * of a URL still finds its owner. Returns null when nothing usable is left.
 */
export function normalizeReferralCode(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (cleaned.length < 4 || cleaned.length > 16) return null;
  return cleaned;
}

/** The link someone shares. */
export function referralUrl(baseUrl: string, code: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/?ref=${encodeURIComponent(code)}`;
}

/**
 * What one conversion pays the referrer, in pence.
 *
 * A month of the referrer's own plan, and never more than the invited
 * account's first payment — which is what keeps the scheme self-funding at
 * the moment it pays out. A free-tier referrer is worth a month of Plus:
 * enough to be an offer, and the cheapest thing there is to give away because
 * it only ever becomes real if they subscribe.
 */
export function rewardPence(input: {
  referrerPlanPence: number;
  fallbackPence: number;
  paidPence: number;
}): number {
  const earned = input.referrerPlanPence > 0 ? input.referrerPlanPence : input.fallbackPence;
  return Math.max(0, Math.min(earned, input.paidPence));
}
