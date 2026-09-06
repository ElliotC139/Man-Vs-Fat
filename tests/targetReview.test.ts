import { describe, expect, it } from "vitest";
import {
  MIN_MEANINGFUL_CHANGE_KCAL,
  answeredThisWeek,
  dailyDeficitFor,
  reviewTarget,
  targetFor,
} from "../src/targetReview";
import type { AdaptiveTdeeResult } from "../src/adaptiveTdee";

const WEEK_START = new Date("2026-09-01T16:00:00Z");

function adaptive(overrides: Partial<Extract<AdaptiveTdeeResult, { kcalPerDay: number }>> = {}) {
  return {
    kcalPerDay: 2640,
    confidence: "high" as const,
    windowDays: 28,
    daysLogged: 27,
    completeness: 0.96,
    weighInCount: 12,
    weightChangeKg: -1.8,
    whoopKcalPerDay: null,
    underLoggingKcalPerDay: null,
    ...overrides,
  };
}

const unavailable: AdaptiveTdeeResult = {
  kcalPerDay: null,
  reason: "too-few-weigh-ins",
  daysLogged: 4,
  completeness: 0.2,
  weighInCount: 1,
};

describe("turning a burn figure into a target", () => {
  it("takes the deficit the weekly goal implies off the burn", () => {
    // 0.5kg a week is 3,850 kcal, which is 550 a day.
    expect(dailyDeficitFor(0.5)).toBe(550);
    expect(targetFor(2640, 0.5)).toBe(2090);
  });

  it("rounds to something a person would actually type", () => {
    expect(targetFor(2637, 0.5) % 10).toBe(0);
  });

  it("will not propose starving, however far the estimate has drifted", () => {
    // An adaptive figure that has gone wrong must not be able to talk someone
    // into 400 kcal a day.
    expect(targetFor(1000, 1.5)).toBe(1200);
  });
});

describe("when the app offers a new target", () => {
  it("offers one when the learned burn has moved the target meaningfully", () => {
    const review = reviewTarget({ dailyCalorieTarget: 2300, weeklyGoalKg: 0.5 }, adaptive(), WEEK_START);
    expect(review.available).toBe(true);
    if (!review.available) return;
    expect(review.proposed).toBe(2090);
    expect(review.current).toBe(2300);
    expect(review.change).toBe(-210);
  });

  it("stays quiet when there isn't enough data to learn from", () => {
    const review = reviewTarget({ dailyCalorieTarget: 2300 }, unavailable, WEEK_START);
    expect(review).toEqual({ available: false, reason: "not-enough-data" });
  });

  it("stays quiet on a low-confidence figure", () => {
    // A guess dressed as a measurement is bad enough on a card. As a target it
    // would stick.
    const review = reviewTarget(
      { dailyCalorieTarget: 2300 },
      adaptive({ confidence: "low" }),
      WEEK_START,
    );
    expect(review).toEqual({ available: false, reason: "low-confidence" });
  });

  it("stays quiet when the change is inside the noise", () => {
    // Asking someone to re-approve their target over 30 kcal teaches them to
    // dismiss the card without reading it.
    const review = reviewTarget(
      { dailyCalorieTarget: 2100, weeklyGoalKg: 0.5 },
      adaptive(),
      WEEK_START,
    );
    expect(review).toEqual({ available: false, reason: "no-meaningful-change" });
  });

  it("speaks up the moment the change clears the threshold", () => {
    const justUnder = reviewTarget(
      { dailyCalorieTarget: 2090 + MIN_MEANINGFUL_CHANGE_KCAL - 1, weeklyGoalKg: 0.5 },
      adaptive(),
      WEEK_START,
    );
    const justOver = reviewTarget(
      { dailyCalorieTarget: 2090 + MIN_MEANINGFUL_CHANGE_KCAL, weeklyGoalKg: 0.5 },
      adaptive(),
      WEEK_START,
    );
    expect(justUnder.available).toBe(false);
    expect(justOver.available).toBe(true);
  });

  it("always offers one when no target has ever been set", () => {
    // There is nothing to compare against, and a figure beats a blank field.
    const review = reviewTarget({ dailyCalorieTarget: null, weeklyGoalKg: 0.5 }, adaptive(), WEEK_START);
    expect(review.available).toBe(true);
    if (!review.available) return;
    expect(review.current).toBeNull();
    expect(review.change).toBeNull();
  });

  it("assumes half a kilo a week when no goal has been set", () => {
    const review = reviewTarget({ dailyCalorieTarget: 2300 }, adaptive(), WEEK_START);
    expect(review.available).toBe(true);
    if (!review.available) return;
    expect(review.weeklyGoalKg).toBe(0.5);
  });
});

describe("asking once a week", () => {
  it("doesn't re-ask a week that has already been answered", () => {
    const review = reviewTarget(
      { dailyCalorieTarget: 2300, weeklyGoalKg: 0.5, targetReviewedWeek: WEEK_START },
      adaptive(),
      WEEK_START,
    );
    expect(review).toEqual({ available: false, reason: "already-answered" });
  });

  it("asks again once a new week has started", () => {
    const lastWeek = new Date(WEEK_START.getTime() - 7 * 86_400_000);
    const review = reviewTarget(
      { dailyCalorieTarget: 2300, weeklyGoalKg: 0.5, targetReviewedWeek: lastWeek },
      adaptive(),
      WEEK_START,
    );
    expect(review.available).toBe(true);
  });

  it("treats declining as an answer, not as unfinished business", () => {
    // An app that re-asks something you have already said no to is one whose
    // cards stop being read. Declining writes the same marker accepting does.
    expect(answeredThisWeek({ targetReviewedWeek: WEEK_START }, WEEK_START)).toBe(true);
  });

  it("counts an account that has never been asked as unanswered", () => {
    expect(answeredThisWeek({}, WEEK_START)).toBe(false);
    expect(answeredThisWeek({ targetReviewedWeek: null }, WEEK_START)).toBe(false);
  });
});
