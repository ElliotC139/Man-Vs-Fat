/**
 * Who is an admin.
 *
 * There are two answers and they have to agree. The stored `isAdmin` flag is
 * what the admin screen shows and what an admin can grant to somebody else.
 * ADMIN_USERNAMES is what the deployment says, and when it is set it wins —
 * both ways round. Accounts on the list get admin; accounts not on it lose it.
 *
 * That second half is the point. "I am the only admin" is not a state you can
 * reach by unticking boxes, because whoever holds the flag can hand it out
 * again, and a flag granted by mistake stays granted until somebody notices.
 * A list held in the deployment's own configuration is a fact about the
 * deployment, re-asserted on every sign-in.
 *
 * With the list unset nothing is enforced and the flag behaves as it always
 * has: the first account created has it, and admins grant it to each other.
 */

import { adminUsernames } from "./config";
import { prisma } from "./db";

/** Whether the deployment names anybody at all. */
export function adminListConfigured(): boolean {
  return adminUsernames.length > 0;
}

/**
 * The effective answer for one account.
 *
 * Case-insensitive, because a username typed into a Fly secret and a username
 * typed into a sign-in box are the same name to the person typing them.
 */
export function isAdminUser(user: { username: string; isAdmin?: boolean | null }): boolean {
  if (adminListConfigured()) return adminUsernames.includes(user.username.trim().toLowerCase());
  return user.isAdmin === true;
}

/**
 * Brings the stored flag into line with the list, on sign-in.
 *
 * Only writes when it differs, so an ordinary sign-in is a read. Never
 * throws: failing to reconcile a flag should not stop somebody signing in,
 * and the gate consults the list directly anyway — this write exists so the
 * admin screen's list of users tells the truth, not to enforce anything.
 */
export async function reconcileAdmin(userId: number): Promise<void> {
  try {
    // Inside the try, not in front of it: reading the configured list is
    // itself something that can fail, and a guard that throws on the way to
    // deciding there is nothing to do is the worst possible version of
    // "never throws".
    if (!adminListConfigured()) return;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true, isAdmin: true },
    });
    if (!user) return;
    const should = isAdminUser(user);
    if (should !== user.isAdmin) {
      await prisma.user.update({ where: { id: user.id }, data: { isAdmin: should } });
    }
  } catch (error) {
    console.error("Couldn't reconcile admin access:", error);
  }
}
