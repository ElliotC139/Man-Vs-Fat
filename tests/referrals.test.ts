import { describe, expect, it } from "vitest";
import {
  REFERRAL_TRIAL_DAYS,
  generateReferralCode,
  normalizeReferralCode,
  referralUrl,
  rewardPence,
} from "../src/referrals";

/**
 * The scheme's arithmetic and its code handling. The rule the money tests are
 * protecting is the one in src/referrals.ts: a reward is capped at the payment
 * that funds it, so the scheme cannot pay out more than it takes in.
 */

describe("codes", () => {
  it("only uses characters that survive being read off a screen", () => {
    // No 0/O, 1/I/L. A code's whole job is to be typed on a phone by someone
    // reading it out of a message.
    for (let i = 0; i < 200; i += 1) {
      expect(generateReferralCode()).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{7}$/);
    }
  });

  it("draws a different code each time", () => {
    const seen = new Set(Array.from({ length: 500 }, () => generateReferralCode()));
    // 28 billion possibilities: a repeat in 500 draws would mean the generator
    // isn't random rather than that we got unlucky.
    expect(seen.size).toBe(500);
  });

  it("forgives how a code arrives", () => {
    expect(normalizeReferralCode(" ab3kx9p ")).toBe("AB3KX9P");
    expect(normalizeReferralCode("AB3KX9P.")).toBe("AB3KX9P");
    expect(normalizeReferralCode("ab3-kx9p")).toBe("AB3KX9P");
  });

  it("refuses what can't be a code", () => {
    expect(normalizeReferralCode("")).toBeNull();
    expect(normalizeReferralCode("ab")).toBeNull();
    expect(normalizeReferralCode("...")).toBeNull();
    expect(normalizeReferralCode(undefined)).toBeNull();
    expect(normalizeReferralCode(42)).toBeNull();
    expect(normalizeReferralCode("A".repeat(40))).toBeNull();
  });

  it("builds a link that survives a base URL with a trailing slash", () => {
    expect(referralUrl("https://quickcals.app/", "AB3KX9P")).toBe("https://quickcals.app/?ref=AB3KX9P");
    expect(referralUrl("https://quickcals.app", "AB3KX9P")).toBe("https://quickcals.app/?ref=AB3KX9P");
  });
});

describe("what a conversion pays", () => {
  it("pays a month of the referrer's own plan", () => {
    expect(rewardPence({ referrerPlanPence: 999, fallbackPence: 499, paidPence: 999 })).toBe(999);
    expect(rewardPence({ referrerPlanPence: 499, fallbackPence: 499, paidPence: 999 })).toBe(499);
  });

  it("pays a free-tier referrer a month of Plus, which only lands if they upgrade", () => {
    expect(rewardPence({ referrerPlanPence: 0, fallbackPence: 499, paidPence: 999 })).toBe(499);
  });

  it("never pays more than the payment that funds it", () => {
    // The property the whole scheme rests on. A Pro referrer whose friend
    // bought Plus is credited the £4.99 that arrived, not the £9.99 they pay.
    expect(rewardPence({ referrerPlanPence: 999, fallbackPence: 499, paidPence: 499 })).toBe(499);
    expect(rewardPence({ referrerPlanPence: 999, fallbackPence: 499, paidPence: 0 })).toBe(0);
  });

  it("never pays a negative amount, whatever it is handed", () => {
    expect(rewardPence({ referrerPlanPence: -100, fallbackPence: -1, paidPence: 999 })).toBe(0);
  });
});

describe("the trial", () => {
  it("is a whole month, counted in days so it reads the same in February", () => {
    expect(REFERRAL_TRIAL_DAYS).toBe(30);
  });
});
