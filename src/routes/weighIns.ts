import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { config } from "../config";
import { requireAuth } from "../auth";
import { localDayKey } from "../matchWeek";

export const weighInsRouter = Router();
weighInsRouter.use(requireAuth);

weighInsRouter.get("/", async (req, res) => {
  const weighIns = await prisma.weighIn.findMany({
    where: { userId: req.userId! },
    orderBy: { date: "asc" },
  });
  res.json(weighIns);
});

const weighInSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date"),
  weightKg: z.number().min(30).max(700),
});

weighInsRouter.post("/", async (req, res) => {
  const parsed = weighInSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const { date, weightKg } = parsed.data;

  const today = localDayKey(new Date(), config.TIMEZONE);
  if (date > today) {
    res.status(400).json({ error: "Can't log a weight for a future date." });
    return;
  }

  const weighIn = await prisma.weighIn.upsert({
    where: { userId_date: { userId: req.userId!, date } },
    update: { weightKg },
    create: { userId: req.userId!, date, weightKg },
  });
  res.status(200).json(weighIn);
});

weighInsRouter.delete("/:date", async (req, res) => {
  await prisma.weighIn.deleteMany({ where: { userId: req.userId!, date: req.params.date } });
  res.status(204).end();
});
