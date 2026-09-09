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
}));

vi.mock("../src/config", () => ({
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

vi.mock("../src/billing", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/billing")>();
  return {
    ...actual,
    // The real client would reach for the network; the signature check is the
    // only part of it these tests care about.
    stripe: () => ({ webhooks: { constructEvent: (...args: any[]) => state.constructEvent(...args) } }),
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
    },
  };
  return { prisma };
});

import { billingWebhookRouter } from "../src/routes/billing";

let server: http.Server;
let baseUrl: string;

beforeEach(async () => {
  state.users.length = 0;
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
