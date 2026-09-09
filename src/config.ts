import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  TIMEZONE: z.string().default("Europe/London"),
  DATABASE_URL: z.string(),
  ANTHROPIC_API_KEY: z.string().min(1, "ANTHROPIC_API_KEY is required"),
  ANTHROPIC_MODEL: z.string().default("claude-sonnet-4-5-20250929"),
  // What the free tier's estimates run on. Deliberately a cheaper model than
  // the paid tiers: the free tier is funded by ads, which bring in pennies a
  // month, so the model it runs on has to cost pennies a month. See
  // src/plans.ts for the arithmetic.
  ANTHROPIC_MODEL_FREE: z.string().default("claude-haiku-4-5"),
  // Pounds per dollar, for turning published API rates into what a call costs
  // this business. It moves, and every spend ceiling in src/plans.ts is
  // denominated in pounds, so it is configuration rather than a constant.
  // Set it high rather than low: a rate that under-states the cost is a
  // ceiling that lets more through than it was set to allow.
  GBP_PER_USD: z.coerce.number().positive().default(0.82),
  // Stripe. All optional, and the whole billing surface reports itself
  // unconfigured without them — same as WHOOP and Nutritionix. A deployment
  // with no card processor should run as a free app, not fail to boot.
  STRIPE_SECRET_KEY: z.string().optional(),
  // The signing secret for the webhook endpoint. Without it a webhook can't
  // be trusted, so it isn't accepted at all — an unverified webhook is an
  // unauthenticated request that hands out paid plans.
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  // One Stripe price per plan and interval. The plan catalogue holds what
  // each tier costs and includes; Stripe holds the object that gets charged,
  // and these are the join between them.
  STRIPE_PRICE_PLUS_MONTHLY: z.string().optional(),
  STRIPE_PRICE_PLUS_YEARLY: z.string().optional(),
  STRIPE_PRICE_PRO_MONTHLY: z.string().optional(),
  STRIPE_PRICE_PRO_YEARLY: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REFRESH_TOKEN: z.string().optional(),
  GOOGLE_DRIVE_FOLDER_ID: z.string().optional(),
  // Separate "Web application" OAuth client used for the "Sign in with
  // Google" button — distinct from GOOGLE_CLIENT_ID above, which is a "TVs
  // and Limited Input devices" client only usable for the Drive device flow.
  GOOGLE_SIGNIN_CLIENT_ID: z.string().optional(),
  WHOOP_CLIENT_ID: z.string().optional(),
  WHOOP_CLIENT_SECRET: z.string().optional(),
  // Must exactly match the redirect URI registered in the WHOOP developer
  // dashboard (app URL + /api/whoop/callback).
  APP_BASE_URL: z.string().default("https://match-week-food-diary.fly.dev"),
  // Optional Slack-style incoming webhook posted to whenever a server error
  // is recorded (see src/errorLog.ts). Unset means errors are still stored
  // and visible in Settings, just not pushed anywhere.
  ERROR_WEBHOOK_URL: z.string().optional(),
  // Optional Resend API key. With it, a forgotten password is recoverable by
  // email; without it, recovery falls back to signing in with Google (see
  // src/mailer.ts and routes/auth.ts).
  RESEND_API_KEY: z.string().optional(),
  // The From: address for those emails. Must be on a domain verified with
  // Resend, or delivery is rejected.
  MAIL_FROM: z.string().default("Food Diary <onboarding@resend.dev>"),
  // Optional Nutritionix credentials. These are what put restaurant and pub
  // menus into food search — Open Food Facts is packaged groceries only, so
  // without a key nothing off a menu is findable. See src/foodSearchProviders.ts.
  NUTRITIONIX_APP_ID: z.string().optional(),
  NUTRITIONIX_APP_KEY: z.string().optional(),
  // Optional USDA FoodData Central key, which adds plain ingredients — the
  // chicken breasts and jacket potatoes that never had a packet.
  USDA_API_KEY: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment configuration:");
  console.error(parsed.error.flatten().fieldErrors);
  throw new Error("Invalid environment configuration");
}

export const config = parsed.data;

export const driveConfigured = Boolean(
  config.GOOGLE_CLIENT_ID && config.GOOGLE_CLIENT_SECRET && config.GOOGLE_REFRESH_TOKEN,
);

export const whoopConfigured = Boolean(config.WHOOP_CLIENT_ID && config.WHOOP_CLIENT_SECRET);
/**
 * Billing is on only with both halves: a key to charge with, and a secret to
 * verify Stripe's callbacks with. A key without a webhook secret would take
 * money and never hear that it had, which is worse than not taking it.
 */
export const stripeConfigured = Boolean(config.STRIPE_SECRET_KEY && config.STRIPE_WEBHOOK_SECRET);

export const mailConfigured = Boolean(config.RESEND_API_KEY);
