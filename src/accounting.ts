/**
 * Which accounts are actually paying, and what they are actually worth.
 *
 * `User.plan` says what someone GETS. It does not say whether anybody paid
 * for it, and the admin screen used to assume it did:
 *
 *     users.reduce((sum, u) => sum + planFor(u.plan).pricePence, 0)
 *
 * That is wrong twice, and both errors push the same way — up.
 *
 *   - A comped account counts as revenue. The operator's own Pro account, and
 *     every friend or refund-fix set by hand from the admin screen, appeared
 *     as money coming in. On a small user base that is most of the figure.
 *
 *   - A yearly subscriber is counted at the monthly price. Pro yearly is
 *     £89.91 once, which is £7.49 a month, not £9.99. Every annual customer
 *     was overstated by a third.
 *
 * The margin line is computed from that total, which makes it the one number
 * the whole pricing structure exists to keep positive — reported wrong, in the
 * flattering direction, exactly where nobody would question it.
 *
 * So this module answers the two questions separately: is this person paying,
 * and if so how much reaches us per month.
 */

import { planFor } from "./plans";
import { statusEntitles } from "./billing";

/**
 * What an account is, for money purposes.
 *
 * "comped" is the one worth naming. Those accounts are not a mistake — comping
 * a friend, or fixing a payment that went wrong, is a normal thing to do from
 * the admin screen — but they are a cost rather than a customer, and a screen
 * that cannot tell them apart from a customer is a screen that lies about how
 * the business is doing.
 */
export type AccountKind = "free" | "paying" | "comped" | "lapsed";

export interface BillingFacts {
  plan: string;
  stripeSubscriptionId: string | null;
  subscriptionStatus: string | null;
  subscriptionInterval: string | null;
}

/** Months in a year, named because it is a divisor and not a magic number. */
const MONTHS_IN_YEAR = 12;

export function classifyAccount(user: BillingFacts): AccountKind {
  if (planFor(user.plan).pricePence === 0) return "free";

  // No subscription at all behind a paid plan means somebody set the column by
  // hand. That is a comp, whatever the plan says they get.
  if (!user.stripeSubscriptionId) return "comped";

  // statusEntitles is billing.ts's own list, reused rather than restated:
  // "past_due" entitles someone deliberately, because Stripe retries a failed
  // card for days and cutting them off on the first bounce punishes a person
  // whose bank blocked a payment. The same reasoning holds here — they are a
  // customer with a card problem, not a lapsed account.
  return statusEntitles(user.subscriptionStatus) ? "paying" : "lapsed";
}

/**
 * What this account actually brings in each month, in pence.
 *
 * Gross: VAT and Stripe's fee come off after this, and the tests in
 * tests/plans.test.ts are where that arithmetic lives. Zero for anybody not
 * paying, which is the whole point.
 *
 * A yearly subscription is divided down rather than counted at its headline,
 * so a month's revenue means the same thing whichever way people pay. That
 * understates the month the money actually lands and overstates the eleven
 * after it, which is the right way round for a figure read as "what is this
 * worth per month".
 */
export function monthlyPence(user: BillingFacts): number {
  if (classifyAccount(user) !== "paying") return 0;

  const plan = planFor(user.plan);
  if (user.subscriptionInterval === "year") {
    // Falls back to twelve times the monthly price where a yearly price was
    // never set, rather than reporting zero for a paying customer.
    const yearly = plan.yearlyPence ?? plan.pricePence * MONTHS_IN_YEAR;
    return Math.round(yearly / MONTHS_IN_YEAR);
  }
  return plan.pricePence;
}

export interface RevenueSummary {
  /** True monthly recurring revenue, gross, in pence. */
  monthlyPence: number;
  counts: Record<AccountKind, number>;
  /** Per plan id: how many are paying for it against how many were given it. */
  byPlan: Record<string, { paying: number; comped: number; lapsed: number; monthlyPence: number }>;
}

export function summariseRevenue(users: BillingFacts[]): RevenueSummary {
  const counts: Record<AccountKind, number> = { free: 0, paying: 0, comped: 0, lapsed: 0 };
  const byPlan: RevenueSummary["byPlan"] = {};
  let total = 0;

  for (const user of users) {
    const kind = classifyAccount(user);
    counts[kind] += 1;
    if (kind === "free") continue;

    const id = planFor(user.plan).id;
    const row = byPlan[id] ?? { paying: 0, comped: 0, lapsed: 0, monthlyPence: 0 };
    if (kind === "paying") row.paying += 1;
    else if (kind === "comped") row.comped += 1;
    else row.lapsed += 1;

    const pence = monthlyPence(user);
    row.monthlyPence += pence;
    total += pence;
    byPlan[id] = row;
  }

  return { monthlyPence: total, counts, byPlan };
}
