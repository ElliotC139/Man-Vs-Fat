import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { requireAuth } from "../auth";
import { getVapidKeys, sendToUser } from "../push";

export const pushRouter = Router();
pushRouter.use(requireAuth);

pushRouter.get("/public-key", async (_req, res) => {
  const { publicKey } = await getVapidKeys();
  res.json({ publicKey });
});

const subscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({ p256dh: z.string().min(1), auth: z.string().min(1) }),
});

pushRouter.post("/subscribe", async (req, res) => {
  const parsed = subscribeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const { endpoint, keys } = parsed.data;

  // Upserting on the endpoint reassigns a device that's been signed into a
  // different account, instead of leaving it delivering someone else's
  // reminders.
  await prisma.pushSubscription.upsert({
    where: { endpoint },
    update: { userId: req.userId!, p256dh: keys.p256dh, auth: keys.auth },
    create: { userId: req.userId!, endpoint, p256dh: keys.p256dh, auth: keys.auth },
  });
  res.status(204).end();
});

const unsubscribeSchema = z.object({ endpoint: z.string().url() });

pushRouter.post("/unsubscribe", async (req, res) => {
  const parsed = unsubscribeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  await prisma.pushSubscription.deleteMany({
    where: { endpoint: parsed.data.endpoint, userId: req.userId! },
  });
  res.status(204).end();
});

pushRouter.get("/status", async (req, res) => {
  const [count, user] = await Promise.all([
    prisma.pushSubscription.count({ where: { userId: req.userId! } }),
    prisma.user.findUnique({ where: { id: req.userId! }, select: { reminderHour: true } }),
  ]);
  res.json({ deviceCount: count, reminderHour: user?.reminderHour ?? null });
});

// Lets the user confirm notifications actually arrive on this device before
// trusting the feature with a daily reminder.
pushRouter.post("/test", async (req, res) => {
  const delivered = await sendToUser(req.userId!, {
    title: "Notifications are working",
    body: "That's all this one does — your reminders will look like this.",
    tag: "test",
  });
  if (delivered === 0) {
    res.status(409).json({ error: "No devices are subscribed on this account yet." });
    return;
  }
  res.json({ delivered });
});
