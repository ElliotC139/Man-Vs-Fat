import webpush from "web-push";
import { prisma } from "./db";

/**
 * Web push, with its VAPID keypair generated on first use and persisted in
 * the Setting table — the same approach the session secret takes in auth.ts,
 * and for the same reason: no manually-provisioned deploy secret to forget,
 * and the key survives restarts (regenerating it would silently invalidate
 * every existing subscription).
 */
const PUBLIC_KEY_SETTING = "vapidPublicKey";
const PRIVATE_KEY_SETTING = "vapidPrivateKey";

// VAPID requires a contact for the push service to reach if this app starts
// misbehaving. mailto: with a non-routable address is the accepted form for
// a personal app with no support inbox.
const VAPID_SUBJECT = "mailto:noreply@man-vs-fat.fly.dev";

let cached: { publicKey: string; privateKey: string } | null = null;

export async function getVapidKeys(): Promise<{ publicKey: string; privateKey: string }> {
  if (cached) return cached;

  const generated = webpush.generateVAPIDKeys();
  // Two independent upserts would race into a mismatched pair on a cold start
  // with concurrent requests, so they're written together.
  const [publicSetting, privateSetting] = await prisma.$transaction([
    prisma.setting.upsert({
      where: { key: PUBLIC_KEY_SETTING },
      update: {},
      create: { key: PUBLIC_KEY_SETTING, value: generated.publicKey },
    }),
    prisma.setting.upsert({
      where: { key: PRIVATE_KEY_SETTING },
      update: {},
      create: { key: PRIVATE_KEY_SETTING, value: generated.privateKey },
    }),
  ]);

  cached = { publicKey: publicSetting.value, privateKey: privateSetting.value };
  webpush.setVapidDetails(VAPID_SUBJECT, cached.publicKey, cached.privateKey);
  return cached;
}

/** Call once at startup so the keypair exists before the first subscribe. */
export async function ensureVapidKeys(): Promise<void> {
  await getVapidKeys();
}

export interface PushPayload {
  title: string;
  body: string;
  /** Replaces an earlier unread notification with the same tag. */
  tag?: string;
  url?: string;
}

/**
 * Sends to every device the user has subscribed. A 404/410 from the push
 * service means that endpoint is permanently dead (app uninstalled,
 * permission revoked), so the row is deleted rather than retried forever.
 */
export async function sendToUser(userId: number, payload: PushPayload): Promise<number> {
  await getVapidKeys();
  const subscriptions = await prisma.pushSubscription.findMany({ where: { userId } });
  if (subscriptions.length === 0) return 0;

  let delivered = 0;
  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload),
      );
      delivered += 1;
    } catch (error) {
      const statusCode = (error as { statusCode?: number }).statusCode;
      if (statusCode === 404 || statusCode === 410) {
        await prisma.pushSubscription.deleteMany({ where: { endpoint: sub.endpoint } });
      } else {
        console.error(`Push to subscription ${sub.id} failed:`, error);
      }
    }
  }
  return delivered;
}
