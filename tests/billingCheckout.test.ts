import http from "node:http";
import express from "express";
import cookieParser from "cookie-parser";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * What the app asks Stripe for when someone presses "Get Plus".
 *
 * Worth pinning because the shape of that request is the whole of the VAT
 * decision, and getting it wrong doesn't fail quietly — Stripe rejects
 * `automatic_tax` on an existing customer unless it is also given permission
 * to write an address back, and the first anyone would know is a customer
 * staring at a broken checkout.
 */

const state = vi.hoisted(() => ({
  users: [] as any[],
  nextId: 1,
  /** Everything handed to checkout.sessions.create, newest last. */
  sessions: [] as any[],
}));

vi.mock("../src/config", () => ({
  adminUsernames: [],
  config: {
    TIMEZONE: "Europe/London",
    GOOGLE_SIGNIN_CLIENT_ID: undefined,
    APP_BASE_URL: "https://quickcals.test",
    ANTHROPIC_MODEL: "claude-sonnet-5",
    ANTHROPIC_MODEL_FREE: "claude-haiku-4-5",
    STRIPE_SECRET_KEY: "sk_test_x",
    STRIPE_WEBHOOK_SECRET: "whsec_x",
    STRIPE_PRICE_PLUS_MONTHLY: "price_plus_m",
    STRIPE_PRICE_PLUS_YEARLY: "price_plus_y",
    STRIPE_PRICE_PRO_MONTHLY: "price_pro_m",
  },
  stripeConfigured: true,
}));

vi.mock("../src/errorLog", () => ({ recordError: vi.fn(async () => {}) }));
vi.mock("../src/mailer", () => ({ canSendMail: () => false, sendMail: async () => true }));

vi.mock("../src/billing", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/billing")>();
  return {
    ...actual,
    stripe: () => ({
      customers: { create: async (data: any) => ({ id: "cus_new", ...data }) },
      checkout: {
        sessions: {
          create: async (args: any) => {
            state.sessions.push(args);
            return { url: "https://checkout.stripe.test/session" };
          },
        },
      },
    }),
  };
});

vi.mock("../src/db", () => {
  const prisma: any = {
    user: {
      findUnique: vi.fn(async ({ where }: any) =>
        state.users.find((u) =>
          where.id !== undefined ? u.id === where.id
          : where.username !== undefined ? u.username === where.username
          : where.googleId !== undefined ? u.googleId === where.googleId
          : where.referralCode !== undefined ? u.referralCode === where.referralCode
          : false) ?? null),
      create: vi.fn(async ({ data }: any) => {
        const user = {
          id: state.nextId++,
          weekStartWeekday: 0,
          weekStartHour: 17,
          weekStartMinute: 0,
          sessionsValidFrom: null,
          plan: "free",
          email: null,
          stripeCustomerId: null,
          referralCode: null,
          referredById: null,
          referralRewardedAt: null,
          referralTrialUsed: false,
          isAdmin: state.users.length === 0,
          ...data,
        };
        state.users.push(user);
        return user;
      }),
      count: vi.fn(async () => state.users.length),
      update: vi.fn(async ({ where, data }: any) => {
        const user = state.users.find((u) => u.id === where.id);
        Object.assign(user, data);
        return user;
      }),
    },
    setting: {
      findUnique: vi.fn(async () => null),
      upsert: vi.fn(async ({ where, create }: any) => ({ key: where.key, value: create.value })),
    },
    matchWeek: { updateMany: vi.fn(async () => ({ count: 0 })) },
    $transaction: vi.fn(async (arg: any) => (Array.isArray(arg) ? Promise.all(arg) : arg(prisma))),
  };
  return { prisma };
});

import { authRouter } from "../src/routes/auth";
import { billingRouter } from "../src/routes/billing";

let server: http.Server;
let baseUrl: string;

beforeEach(async () => {
  state.users.length = 0;
  state.sessions.length = 0;
  state.nextId = 1;
  vi.clearAllMocks();

  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use("/api/auth", authRouter);
  app.use("/api/billing", billingRouter);
  server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  baseUrl = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
});

afterEach(async () => { await new Promise((resolve) => server.close(resolve)); });

async function signUp(username: string): Promise<string> {
  const res = await fetch(`${baseUrl}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password: "password123" }),
  });
  return res.headers.getSetCookie().find((c) => c.startsWith("session="))!.split(";")[0]!;
}

function checkout(cookie: string, body: unknown) {
  return fetch(`${baseUrl}/api/billing/checkout`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify(body),
  });
}

describe("VAT on the checkout session", () => {
  it("asks Stripe to work the tax out, and gives it what it needs to", async () => {
    const cookie = await signUp("alice");
    const res = await checkout(cookie, { plan: "plus" });
    expect(res.status).toBe(200);

    const session = state.sessions.at(-1);
    expect(session.automatic_tax).toEqual({ enabled: true });
    // An address is how Stripe decides the rate at all, and customer_update
    // is the permission to save it onto the customer. Without that pairing
    // Stripe rejects the whole session.
    expect(session.billing_address_collection).toBe("required");
    expect(session.customer_update?.address).toBe("auto");
  });

  it("still carries the account through, so the webhook can find it", async () => {
    const cookie = await signUp("alice");
    await checkout(cookie, { plan: "pro" });

    const session = state.sessions.at(-1);
    expect(session.mode).toBe("subscription");
    expect(session.client_reference_id).toBe("1");
    expect(session.subscription_data.metadata.userId).toBe("1");
    expect(session.line_items).toEqual([{ price: "price_pro_m", quantity: 1 }]);
  });
});

describe("monthly or yearly", () => {
  it("buys the yearly price when that is what was asked for", async () => {
    const cookie = await signUp("alice");
    await checkout(cookie, { plan: "plus", interval: "yearly" });
    expect(state.sessions.at(-1).line_items).toEqual([{ price: "price_plus_y", quantity: 1 }]);
  });

  it("defaults to monthly when no interval is named", async () => {
    const cookie = await signUp("alice");
    await checkout(cookie, { plan: "plus" });
    expect(state.sessions.at(-1).line_items).toEqual([{ price: "price_plus_m", quantity: 1 }]);
  });

  it("refuses an interval this deployment has no price for", async () => {
    // Pro has no yearly price here. Better a plain refusal than a checkout
    // that opens onto nothing — see priceIdFor for why the gap is normal.
    const cookie = await signUp("alice");
    const res = await checkout(cookie, { plan: "pro", interval: "yearly" });
    expect(res.status).toBe(400);
    expect(state.sessions).toHaveLength(0);
  });
});

describe("the invited free month", () => {
  it("is attached for someone who arrived on an invite", async () => {
    const cookie = await signUp("bob");
    state.users[0]!.referredById = 99;

    await checkout(cookie, { plan: "plus" });
    expect(state.sessions.at(-1).subscription_data.trial_period_days).toBe(30);
  });

  it("is not offered twice", async () => {
    const cookie = await signUp("bob");
    Object.assign(state.users[0]!, { referredById: 99, referralTrialUsed: true });

    await checkout(cookie, { plan: "plus" });
    expect(state.sessions.at(-1).subscription_data.trial_period_days).toBeUndefined();
  });

  it("is not offered to someone nobody invited", async () => {
    const cookie = await signUp("alice");
    await checkout(cookie, { plan: "plus" });
    expect(state.sessions.at(-1).subscription_data.trial_period_days).toBeUndefined();
  });
});
