import { prisma } from "./db";
import { config } from "./config";

/**
 * Errors were only ever written to stdout, which on Fly rolls away — a WHOOP
 * sync that quietly started failing at 3am left nothing to find at 9am. These
 * go to the database instead, where the Diagnostics panel in Settings can
 * read them back, and out to a webhook if one is configured so a failure can
 * actually page someone rather than waiting to be noticed.
 */

const MAX_STORED_ERRORS = 500;
const MAX_MESSAGE_CHARS = 2000;
const MAX_STACK_CHARS = 6000;

function describe(error: unknown): { message: string; stack: string | null } {
  if (error instanceof Error) {
    return {
      message: error.message.slice(0, MAX_MESSAGE_CHARS),
      stack: error.stack ? error.stack.slice(0, MAX_STACK_CHARS) : null,
    };
  }
  return { message: String(error).slice(0, MAX_MESSAGE_CHARS), stack: null };
}

async function notifyWebhook(context: string, message: string): Promise<void> {
  if (!config.ERROR_WEBHOOK_URL) return;
  try {
    await fetch(config.ERROR_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // A Slack incoming webhook renders `text`; anything else gets the same
      // string under a key it can ignore, so one URL setting covers both.
      body: JSON.stringify({ text: `[food diary] ${context}: ${message}` }),
    });
  } catch (error) {
    console.error("Error webhook failed:", error);
  }
}

/**
 * Never throws: an error while recording an error must not replace the
 * original failure, which is usually the more useful one.
 */
export async function recordError(context: string, error: unknown, userId?: number | null): Promise<void> {
  const { message, stack } = describe(error);
  console.error(`[${context}]`, error);

  try {
    await prisma.appError.create({ data: { context, message, stack, userId: userId ?? null } });

    // Kept bounded rather than growing forever on a 1GB volume that also
    // holds the database and every uploaded photo.
    const total = await prisma.appError.count();
    if (total > MAX_STORED_ERRORS) {
      const cutoff = await prisma.appError.findMany({
        orderBy: { createdAt: "desc" },
        skip: MAX_STORED_ERRORS,
        take: 1,
        select: { createdAt: true },
      });
      if (cutoff[0]) {
        await prisma.appError.deleteMany({ where: { createdAt: { lte: cutoff[0].createdAt } } });
      }
    }
  } catch (writeError) {
    console.error("Failed to record error:", writeError);
  }

  await notifyWebhook(context, message);
}
