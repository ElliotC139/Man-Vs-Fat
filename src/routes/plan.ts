/**
 * What plan this account is on, and how much of it is left.
 *
 * The allowance is only useful if someone can see it before they hit it — a
 * limit you discover by being refused is a limit that feels like a fault. So
 * the Today screen reads this and says how many estimates are left once they
 * start running out.
 */

import { Router } from "express";
import { requireAuth } from "../auth";
import { readAllowance } from "../entitlements";
import { allPlans } from "../plans";
import { adsConfigured, config } from "../config";

export const planRouter = Router();

/** The plan catalogue. Public: it is a price list. */
planRouter.get("/catalogue", (_req, res) => {
  res.json({
    plans: allPlans().map((plan) => ({
      id: plan.id,
      name: plan.name,
      pricePence: plan.pricePence,
      yearlyPence: plan.yearlyPence,
      tagline: plan.tagline,
      highlights: plan.highlights,
      dailyEstimates: plan.dailyEstimates,
      photo: plan.photo,
      recipeScan: plan.recipeScan,
      health: plan.health,
      weeklyReport: plan.weeklyReport,
      ads: plan.ads,
    })),
  });
});

planRouter.get("/", requireAuth, async (req, res) => {
  const allowance = await readAllowance(req.userId!);
  const { plan } = allowance;

  res.json({
    plan: {
      id: plan.id,
      name: plan.name,
      pricePence: plan.pricePence,
      photo: plan.photo,
      recipeScan: plan.recipeScan,
      health: plan.health,
      weeklyReport: plan.weeklyReport,
      ads: plan.ads,
    },
    estimates: {
      used: allowance.usedToday,
      allowance: plan.dailyEstimates,
      remaining: allowance.remainingToday,
    },
    // Deliberately not the pounds. What this account has cost to run is the
    // operator's business, not something to put in front of the person — "you
    // have used 43p of your £2" is a strange thing to tell a customer, and it
    // invites them to game it. The admin dashboard sees the money.
    monthlyCapReached: allowance.spentMicros >= allowance.capMicros,
    // Sent only to accounts that actually get ads. A paying account never
    // receives the publisher id at all, so the advertising script is never
    // loaded for them rather than being loaded and hidden — which is the
    // difference between "no ads" meaning something and it being decoration.
    ads: plan.ads && adsConfigured
      ? {
          client: config.ADSENSE_CLIENT_ID,
          // Each tab that carries an ad, falling back to the Today unit where
          // no separate one is configured — see src/config.ts for why that is
          // the default rather than requiring four. Settings is absent by
          // design, not by omission.
          slots: {
            today: config.ADSENSE_SLOT_TODAY,
            week: config.ADSENSE_SLOT_WEEK ?? config.ADSENSE_SLOT_TODAY,
            food: config.ADSENSE_SLOT_FOOD ?? config.ADSENSE_SLOT_TODAY,
            stats: config.ADSENSE_SLOT_STATS ?? config.ADSENSE_SLOT_TODAY,
          },
        }
      : null,
  });
});
