import http from "node:http";
import express from "express";
import cookieParser from "cookie-parser";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The webhook is the only thing in the app that may change what plan someone
 * is on. These check that it does, that nothing else can, and that an
 * unsigned request gets nowhere.
 */

const state = vi.hoisted(() => ({
  users: [] as any[],
  constructEvent: null as any,
  /** Credits issued through Stripe, so a test can assert one landed. */
  credits: [] as any[],
  /** What Stripe would return from subscriptions.retrieve right now. */
  current: null as any,
  lastEvent: null as any,
  /** Emails the app tried to send. */
  mails: [] as any[],
  /** Set to make the credit call fail, which is how a retry gets tested. */
  creditFails: false,
  nextCustomer: 1,
}));

vi.mock("../src/config", () => ({
  // reconcileAdmin and toPublicUser both read this on every sign-in.
  adminUsernames: [],
  config: {
    TIMEZONE: "Europe/London",
    GOOGLE_SIGNIN_CLIENT_ID: undefined,
    APP_BASE_URL: "https://quickcals.test",
    GBP_PER_USD: 0.8,
    ANTHROPIC_MODEL: "claude-sonnet-5",
    ANTHROPIC_MODEL_FREE: "claude-haiku-4-5",
    STRIPE_SECRET_KEY: "sk_test_x",
    STRIPE_WEBHOOK_SECRET: "whsec_x",
    STRIPE_PRICE_PLUS_MONTHLY: "price_plus_m",
    STRIPE_PRICE_PRO_MONTHLY: "price_pro_m",
  },
  stripeConfigured: true,
}));

vi.mock("../src/errorLog", () => ({ recordError: vi.fn(async () => {}) }));

vi.mock("../src/mailer", () => ({
  canSendMail: () => true,
  sendMail: async (mail: any) => { state.mails.push(mail); return true; },
}));

vi.mock("../src/billing", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/billing")>();
  return {
    ...actual,
    // The real client would reach for the network. The signature check and
    // the customer-balance credit are the parts these tests care about.
    stripe: () => ({
      webhooks: {
        constructEvent: (...args: any[]) => {
          const event = state.constructEvent(...args);
          state.lastEvent = event;
          return event;
        },
      },
      subscriptions: {
        // The handler re-reads the subscription rather than trusting the
        // event, so the mock has to answer for it. state.current is what
        // Stripe "currently" holds — set it apart from the event body to
        // prove the handler acts on the former.
        retrieve: async (id: string) =>
          state.current ?? state.lastEvent?.data?.object ?? { id, customer: "cus_1", status: "active", metadata: {}, items: { data: [] } },
      },
      customers: {
        create: async (data: any) => ({ id: `cus_new_${state.nextCustomer++}`, ...data }),
        createBalanceTransaction: async (customer: string, data: any) => {
          if (state.creditFails) throw new Error("Stripe is down");
          state.credits.push({ customer, ...data });
          return data;
        },
      },
    }),
  };
});

vi.mock("../src/db", () => {
  const prisma: any = {
    user: {
      findUnique: vi.fn(async ({ where }: any) =>
        state.users.find((u) => (where.id !== undefined ? u.id === where.id : u.username === where.username)) ?? null),
      findFirst: vi.fn(async ({ where }: any) => {
        const clauses = where.OR ?? [where];
        return state.users.find((u) =>
          clauses.some((c: any) =>
            (c.stripeCustomerId !== undefined && u.stripeCustomerId === c.stripeCustomerId)
            || (c.id !== undefined && u.id === c.id))) ?? null;
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const user = state.users.find((u) => u.id === where.id);
        Object.assign(user, data);
        return user;
      }),
      updateMany: vi.fn(async ({ where, data }: any) => {
        const matched = state.users.filter((u) =>
          u.id === where.id
          && (where.referralRewardedAt === undefined || u.referralRewardedAt === where.referralRewardedAt));
        for (const user of matched) Object.assign(user, data);
        return { count: matched.length };
      }),
      count: vi.fn(async ({ where }: any) =>
        state.users.filter((u) =>
          u.referredById === where.referredById && u.referralRewardedAt != null).length),
    },
  };
  return { prisma };
});

import { billingWebhookRouter } from "../src/routes/billing";

let server: http.Server;
let baseUrl: string;

beforeEach(async () => {
  state.users.length = 0;
  state.credits.length = 0;
  state.mails.length = 0;
  state.current = null;
  state.lastEvent = null;
  state.creditFails = false;
  state.nextCustomer = 1;
  state.constructEvent = () => { throw new Error("no signature configured"); };
  vi.clearAllMocks();

  const app = express();
  app.use("/api/billing", billingWebhookRouter);
  app.use(express.json());
  app.use(cookieParser());
  server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  baseUrl = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
});

afterEach(async () => {
  await new Promise((resolve) => server.close(resolve));
});

function subscriptionEvent(over: Record<string, unknown> = {}) {
  return {
    type: "customer.subscription.updated",
    data: {
      object: {
        id: "sub_1",
        customer: "cus_1",
        status: "active",
        metadata: {},
        items: { data: [{ price: { id: "price_pro_m" }, current_period_end: 1_800_000_000 }] },
        ...over,
      },
    },
  };
}

function post(body: unknown, signature: string | null = "sig") {
  return fetch(`${baseUrl}/api/billing/webhook`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(signature ? { "stripe-signature": signature } : {}),
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/billing/webhook", () => {
  it("puts a paying customer on the plan their price names", async () => {
    state.users.push({ id: 1, plan: "free", stripeCustomerId: "cus_1" });
    state.constructEvent = () => subscriptionEvent();

    expect((await post(subscriptionEvent())).status).toBe(200);
    expect(state.users[0]).toMatchObject({
      plan: "pro",
      stripeSubscriptionId: "sub_1",
      subscriptionStatus: "active",
    });
    expect(state.users[0].subscriptionEndsAt).toEqual(new Date(1_800_000_000 * 1000));
  });

  it("refuses an unsigned request", async () => {
    state.users.push({ id: 1, plan: "free", stripeCustomerId: "cus_1" });
    const res = await post(subscriptionEvent(), null);
    expect(res.status).toBe(400);
    expect(state.users[0].plan).toBe("free");
  });

  it("refuses a badly signed one", async () => {
    // An unverified webhook is an unauthenticated request that hands out paid
    // plans, so a body that says "pro" must get nowhere without a signature.
    state.users.push({ id: 1, plan: "free", stripeCustomerId: "cus_1" });
    state.constructEvent = () => { throw new Error("bad signature"); };

    expect((await post(subscriptionEvent())).status).toBe(400);
    expect(state.users[0].plan).toBe("free");
  });

  it("drops someone to free when Stripe gives up on their card", async () => {
    state.users.push({ id: 1, plan: "pro", stripeCustomerId: "cus_1" });
    const event = subscriptionEvent({
      status: "canceled",
      items: { data: [{ price: { id: "price_pro_m" }, current_period_end: 1_000_000 }] },
    });
    state.constructEvent = () => event;

    await post(event);
    expect(state.users[0].plan).toBe("free");
  });

  it("keeps a cancelled plan until the paid period ends", async () => {
    state.users.push({ id: 1, plan: "pro", stripeCustomerId: "cus_1" });
    const farFuture = Math.floor(Date.now() / 1000) + 86_400 * 20;
    const event = subscriptionEvent({ status: "canceled", cancel_at: farFuture });
    state.constructEvent = () => event;

    await post(event);
    expect(state.users[0].plan).toBe("pro");
  });

  it("ignores a subscription that matches no account", async () => {
    state.users.push({ id: 1, plan: "free", stripeCustomerId: "cus_other" });
    state.constructEvent = () => subscriptionEvent();

    expect((await post(subscriptionEvent())).status).toBe(200);
    expect(state.users[0].plan).toBe("free");
  });

  it("finds the account by the id carried through checkout", async () => {
    // Someone who re-subscribed from Stripe's own dashboard has a customer
    // this app has never seen; the metadata is what links it back.
    state.users.push({ id: 7, plan: "free", stripeCustomerId: null });
    const event = subscriptionEvent({ customer: "cus_new", metadata: { userId: "7" } });
    state.constructEvent = () => event;

    await post(event);
    expect(state.users[0]).toMatchObject({ plan: "pro", stripeCustomerId: "cus_new" });
  });

  it("ignores events that aren't about a subscription", async () => {
    state.users.push({ id: 1, plan: "free", stripeCustomerId: "cus_1" });
    state.constructEvent = () => ({ type: "invoice.paid", data: { object: {} } });

    expect((await post({})).status).toBe(200);
    expect(state.users[0].plan).toBe("free");
  });

  it("asks Stripe to retry when applying an event fails", async () => {
    // A 200 would mean a subscription change that never reached the account,
    // with nothing left to notice it.
    state.users.push({ id: 1, plan: "free", stripeCustomerId: "cus_1" });
    state.constructEvent = () => subscriptionEvent();
    const { prisma } = await import("../src/db");
    (prisma.user.update as any).mockRejectedValueOnce(new Error("db down"));

    expect((await post(subscriptionEvent())).status).toBe(500);
  });
});

/**
 * The referral reward. Every one of these is guarding the same promise: the
 * scheme pays out of money that has arrived, exactly once, and never more
 * than the payment funding it. See src/referrals.ts.
 */
describe("the referral reward", () => {
  function invoiceEvent(over: Record<string, unknown> = {}) {
    return {
      type: "invoice.payment_succeeded",
      data: { object: { id: "in_1", customer: "cus_bob", amount_paid: 499, currency: "gbp", ...over } },
    };
  }

  /** Alice invited Bob, and Bob's first month has just been paid for. */
  function aliceAndBob(over: { alice?: any; bob?: any } = {}) {
    state.users.push({
      id: 1, plan: "free", username: "alice", email: "alice@example.test",
      stripeCustomerId: "cus_alice", referredById: null, referralRewardedAt: null, ...over.alice,
    });
    state.users.push({
      id: 2, plan: "plus", username: "bob", email: null,
      stripeCustomerId: "cus_bob", referredById: 1, referralRewardedAt: null, ...over.bob,
    });
  }

  it("credits the referrer when the first real payment lands", async () => {
    aliceAndBob();
    const event = invoiceEvent();
    state.constructEvent = () => event;

    expect((await post(event)).status).toBe(200);
    // A free-tier referrer earns a month of Plus, which lands as credit and
    // becomes real the moment they subscribe.
    expect(state.credits).toEqual([
      { customer: "cus_alice", amount: -499, currency: "gbp", description: "QuicKcals referral reward" },
    ]);
    expect(state.users[1]!.referralRewardedAt).toBeInstanceOf(Date);
  });

  it("ignores the £0 invoice that opens a free month", async () => {
    // This is the whole design. Paying out here would make the free month the
    // trigger, which is the thing the scheme is built not to do.
    aliceAndBob();
    const event = invoiceEvent({ amount_paid: 0 });
    state.constructEvent = () => event;

    expect((await post(event)).status).toBe(200);
    expect(state.credits).toHaveLength(0);
    expect(state.users[1]!.referralRewardedAt).toBeNull();
  });

  it("pays once, however many times Stripe delivers the event", async () => {
    aliceAndBob();
    const event = invoiceEvent();
    state.constructEvent = () => event;

    await post(event);
    await post(event);
    await post(event);
    expect(state.credits).toHaveLength(1);
  });

  it("never credits more than the payment that funds it", async () => {
    // A Pro referrer whose friend bought Plus gets the £4.99 that arrived,
    // not the £9.99 they pay.
    aliceAndBob({ alice: { plan: "pro" } });
    const event = invoiceEvent({ amount_paid: 499 });
    state.constructEvent = () => event;

    await post(event);
    expect(state.credits[0]).toMatchObject({ amount: -499 });
  });

  it("pays a paying referrer a month of their own plan", async () => {
    aliceAndBob({ alice: { plan: "pro" } });
    const event = invoiceEvent({ amount_paid: 999 });
    state.constructEvent = () => event;

    await post(event);
    expect(state.credits[0]).toMatchObject({ amount: -999 });
  });

  it("creates a Stripe customer for a referrer who has never checked out", async () => {
    // "Your first month is on us when you upgrade" is the offer, so the
    // credit has to have somewhere to sit before they subscribe.
    aliceAndBob({ alice: { stripeCustomerId: null } });
    const event = invoiceEvent();
    state.constructEvent = () => event;

    await post(event);
    expect(state.users[0]!.stripeCustomerId).toBe("cus_new_1");
    expect(state.credits[0]).toMatchObject({ customer: "cus_new_1" });
  });

  it("pays nothing on a payment from an account nobody invited", async () => {
    aliceAndBob({ bob: { referredById: null } });
    const event = invoiceEvent();
    state.constructEvent = () => event;

    expect((await post(event)).status).toBe(200);
    expect(state.credits).toHaveLength(0);
  });

  it("stops paying at the cap, without breaking the invite", async () => {
    aliceAndBob();
    // 25 conversions already banked.
    for (let i = 0; i < 25; i += 1) {
      state.users.push({ id: 100 + i, referredById: 1, referralRewardedAt: new Date() });
    }
    const event = invoiceEvent();
    state.constructEvent = () => event;

    expect((await post(event)).status).toBe(200);
    expect(state.credits).toHaveLength(0);
  });

  it("hands the claim back when the credit fails, so the retry can pay it", async () => {
    aliceAndBob();
    const event = invoiceEvent();
    state.constructEvent = () => event;
    state.creditFails = true;

    // A 500 is how Stripe is told to come back.
    expect((await post(event)).status).toBe(500);
    expect(state.users[1]!.referralRewardedAt).toBeNull();

    state.creditFails = false;
    expect((await post(event)).status).toBe(200);
    expect(state.credits).toHaveLength(1);
  });

  it("marks the free month spent once the trial actually starts", async () => {
    state.users.push({ id: 1, plan: "free", stripeCustomerId: "cus_1", referralTrialUsed: false });
    const event = subscriptionEvent({ status: "trialing", trial_end: 1_800_000_000 });
    state.constructEvent = () => event;

    await post(event);
    expect(state.users[0]!.referralTrialUsed).toBe(true);
  });

  it("leaves the free month alone for a subscription without one", async () => {
    state.users.push({ id: 1, plan: "free", stripeCustomerId: "cus_1", referralTrialUsed: false });
    state.constructEvent = () => subscriptionEvent();

    await post(subscriptionEvent());
    expect(state.users[0]!.referralTrialUsed).toBe(false);
  });
});

/**
 * Webhook delivery is not ordered, so the handler re-reads the subscription
 * rather than believing the event body. These set the two apart deliberately:
 * whichever event arrives, the state written must be what Stripe currently
 * holds.
 */
describe("out-of-order events", () => {
  it("acts on Stripe's current state, not a stale event body", async () => {
    state.users.push({ id: 1, plan: "free", stripeCustomerId: "cus_1" });

    // A delayed "updated" saying the account is on Pro and active…
    const stale = subscriptionEvent({ status: "active" });
    state.constructEvent = () => stale;
    // …arriving after the subscription was actually cancelled outright.
    state.current = {
      id: "sub_1", customer: "cus_1", status: "canceled", metadata: {},
      items: { data: [{ price: { id: "price_pro_m" }, current_period_end: 1_000_000 }] },
    };

    expect((await post(stale)).status).toBe(200);
    // Believing the payload would have handed Pro back to someone who cancelled.
    expect(state.users[0]!.plan).toBe("free");
    expect(state.users[0]!.subscriptionStatus).toBe("canceled");
  });

  it("still applies a change when the event and Stripe agree", async () => {
    state.users.push({ id: 1, plan: "free", stripeCustomerId: "cus_1" });
    const event = subscriptionEvent();
    state.constructEvent = () => event;
    state.current = event.data.object;

    await post(event);
    expect(state.users[0]!.plan).toBe("pro");
  });
});

describe("a failed payment", () => {
  function failedInvoice(over: Record<string, unknown> = {}) {
    return {
      type: "invoice.payment_failed",
      data: { object: { id: "in_9", customer: "cus_1", attempt_count: 1, currency: "gbp", ...over } },
    };
  }

  it("emails the customer once, on the first attempt", async () => {
    state.users.push({ id: 1, plan: "plus", username: "alice", email: "alice@example.test", stripeCustomerId: "cus_1" });
    const event = failedInvoice();
    state.constructEvent = () => event;

    expect((await post(event)).status).toBe(200);
    expect(state.mails).toHaveLength(1);
    expect(state.mails[0]).toMatchObject({ to: "alice@example.test" });
    expect(state.mails[0].subject).toContain("QuicKcals");
    // Says the plan still works, because at the first failure it does.
    expect(state.mails[0].text).toContain("Manage subscription");
  });

  it("stays quiet on the retries", async () => {
    // Stripe retries a failed invoice for about a fortnight and every attempt
    // fires this event. One nudge is help; six is nagging.
    state.users.push({ id: 1, plan: "plus", username: "alice", email: "alice@example.test", stripeCustomerId: "cus_1" });
    const event = failedInvoice({ attempt_count: 3 });
    state.constructEvent = () => event;

    await post(event);
    expect(state.mails).toHaveLength(0);
  });

  it("says nothing to an account with no address on file", async () => {
    // Username and password alone is a normal way to have an account.
    state.users.push({ id: 1, plan: "plus", username: "alice", email: null, stripeCustomerId: "cus_1" });
    const event = failedInvoice();
    state.constructEvent = () => event;

    expect((await post(event)).status).toBe(200);
    expect(state.mails).toHaveLength(0);
  });

  it("never fails the webhook over an email", async () => {
    // Billing state must not depend on whether a courtesy email could be sent.
    const event = failedInvoice({ customer: null });
    state.constructEvent = () => event;
    expect((await post(event)).status).toBe(200);
  });
});

describe("the referral reward's currency", () => {
  it("refuses to pay against an invoice in another currency", async () => {
    // amount_paid is in the invoice's own smallest unit, and it is compared
    // against plan prices in GBP pence to cap the reward. 5,000 JPY against a
    // 499p cap reads as "plenty" — the cap would stop capping.
    state.users.push({ id: 1, plan: "free", username: "alice", email: null, stripeCustomerId: "cus_alice", referredById: null, referralRewardedAt: null });
    state.users.push({ id: 2, plan: "plus", username: "bob", email: null, stripeCustomerId: "cus_bob", referredById: 1, referralRewardedAt: null });

    const event = {
      type: "invoice.payment_succeeded",
      data: { object: { id: "in_2", customer: "cus_bob", amount_paid: 5000, currency: "jpy" } },
    };
    state.constructEvent = () => event;

    expect((await post(event)).status).toBe(200);
    expect(state.credits).toHaveLength(0);
    expect(state.users[1]!.referralRewardedAt).toBeNull();
  });

  it("credits in GBP rather than whatever the invoice named", async () => {
    state.users.push({ id: 1, plan: "free", username: "alice", email: null, stripeCustomerId: "cus_alice", referredById: null, referralRewardedAt: null });
    state.users.push({ id: 2, plan: "plus", username: "bob", email: null, stripeCustomerId: "cus_bob", referredById: 1, referralRewardedAt: null });

    const event = {
      type: "invoice.payment_succeeded",
      data: { object: { id: "in_3", customer: "cus_bob", amount_paid: 499, currency: "GBP" } },
    };
    state.constructEvent = () => event;

    await post(event);
    expect(state.credits[0]).toMatchObject({ currency: "gbp", amount: -499 });
  });
});
