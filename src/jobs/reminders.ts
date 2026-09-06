import { config } from "../config";
import { prisma } from "../db";
import { getLocalParts, localDayKey } from "../matchWeek";
import { sendToUser } from "../push";
import { readMealReminders, slotsDueAt } from "../mealReminders";
import { readMealTagNames } from "../mealTags";

/**
 * The daily "you haven't logged anything today" nudge.
 *
 * Only fires for users who chose an hour (reminderHour is null by default —
 * see the schema), only in that hour, and only when there's genuinely
 * nothing logged. A reminder that arrives after you've already logged is the
 * fastest way to get an app's notifications switched off.
 */
export async function sendDueReminders(now = new Date()): Promise<number> {
  const localNow = getLocalParts(now, config.TIMEZONE);
  const users = await prisma.user.findMany({
    where: { reminderHour: localNow.hour },
    select: { id: true },
  });
  if (users.length === 0) return 0;

  const today = localDayKey(now, config.TIMEZONE);
  // A day here is the user's local calendar day, not their match week — the
  // nudge is about today's logging habit, not the week's total.
  const dayStart = new Date(now);
  dayStart.setUTCHours(0, 0, 0, 0);
  // Widened either side so a timezone offset can't put the local day's early
  // or late entries outside the window; the day key below is what actually
  // decides.
  const windowStart = new Date(dayStart.getTime() - 24 * 60 * 60 * 1000);

  let sent = 0;
  for (const user of users) {
    const recent = await prisma.entry.findMany({
      where: { matchWeek: { userId: user.id }, timestamp: { gte: windowStart } },
      select: { timestamp: true },
    });
    const loggedToday = recent.some((e) => localDayKey(e.timestamp, config.TIMEZONE) === today);
    if (loggedToday) continue;

    const delivered = await sendToUser(user.id, {
      title: "Nothing logged today",
      body: "A few seconds now beats reconstructing the day tomorrow.",
      tag: "daily-reminder",
    });
    if (delivered > 0) sent += 1;
  }
  return sent;
}

/**
 * The per-meal nudges.
 *
 * A narrower question than the daily one above: not "have you logged anything"
 * but "is there a lunch". Logging at the meal beats reconstructing the day from
 * memory at eleven at night, which is the actual failure mode this exists for.
 *
 * Same restraint as the daily nudge, for the same reason — a reminder that
 * arrives after you have already done the thing is the fastest way to get an
 * app's notifications switched off. A slot that already has an entry today
 * says nothing.
 */
export async function sendDueMealReminders(now = new Date()): Promise<number> {
  const localNow = getLocalParts(now, config.TIMEZONE);

  // Filtered in memory rather than in SQL: the hours live inside a JSON column
  // because SQLite has none of its own, and the set of users with any meal
  // reminder at all is small enough that reading it beats four more columns.
  const candidates = await prisma.user.findMany({
    where: { mealReminders: { not: null } },
    select: { id: true, mealReminders: true, mealTagNames: true },
  });

  const today = localDayKey(now, config.TIMEZONE);
  const dayStart = new Date(now);
  dayStart.setUTCHours(0, 0, 0, 0);
  // Widened either side for the same reason the daily nudge widens it: a
  // timezone offset can push the local day's edges outside a UTC window, and
  // the day key below is what actually decides.
  const windowStart = new Date(dayStart.getTime() - 24 * 60 * 60 * 1000);

  let sent = 0;
  for (const user of candidates) {
    const due = slotsDueAt(readMealReminders(user.mealReminders), localNow.hour);
    if (due.length === 0) continue;

    const recent = await prisma.entry.findMany({
      where: { matchWeek: { userId: user.id }, timestamp: { gte: windowStart } },
      select: { timestamp: true, mealType: true },
    });
    const loggedToday = recent.filter((e) => localDayKey(e.timestamp, config.TIMEZONE) === today);

    const names = readMealTagNames(user.mealTagNames);
    for (const slot of due) {
      // The clock's guess counts here as much as a chosen tag. The question is
      // whether anything that looks like lunch got logged, not whether the
      // user has ever been asked to categorise their diary.
      if (loggedToday.some((e) => e.mealType === slot)) continue;

      const name = names[slot];
      const delivered = await sendToUser(user.id, {
        title: `${name} not logged`,
        body: "Quicker now than from memory tonight.",
        // One tag per slot, so a lunch nudge replaces an earlier lunch nudge
        // rather than stacking up on the lock screen.
        tag: `meal-reminder-${slot}`,
      });
      if (delivered > 0) sent += 1;
    }
  }
  return sent;
}
