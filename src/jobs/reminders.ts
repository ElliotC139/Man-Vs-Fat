import { config } from "../config";
import { prisma } from "../db";
import { getLocalParts, localDayKey } from "../matchWeek";
import { sendToUser } from "../push";

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
