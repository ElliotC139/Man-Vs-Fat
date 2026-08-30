import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  TIMEZONE: z.string().default("Europe/London"),
  DATABASE_URL: z.string(),
  ANTHROPIC_API_KEY: z.string().min(1, "ANTHROPIC_API_KEY is required"),
  ANTHROPIC_MODEL: z.string().default("claude-sonnet-4-5-20250929"),
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

export const mailConfigured = Boolean(config.RESEND_API_KEY);
