import { prisma } from "./db";
import { deleteUploadedImage } from "./lib/storage";

/**
 * Erases an account and everything attached to it.
 *
 * The relations are declared without `onDelete: Cascade`, so the order here
 * is the schema's dependency order rather than a detail SQLite works out on
 * its own — children first, then match weeks, then the user. Getting it wrong
 * surfaces as a foreign-key error rather than silent orphans, but it would
 * leave a half-deleted account behind, which is why the whole thing runs in
 * one transaction.
 *
 * Photos live on the volume rather than in the database, so they're removed
 * separately — after the transaction commits, because a file deleted for a
 * transaction that then rolls back is gone for good.
 */
export async function deleteAccount(userId: number): Promise<void> {
  const weeks = await prisma.matchWeek.findMany({ where: { userId }, select: { id: true } });
  const weekIds = weeks.map((week) => week.id);

  const [entries, exercises, progressPhotos] = await Promise.all([
    prisma.entry.findMany({ where: { matchWeekId: { in: weekIds } }, select: { imageUrl: true } }),
    prisma.exercise.findMany({ where: { matchWeekId: { in: weekIds } }, select: { imageUrl: true } }),
    prisma.progressPhoto.findMany({ where: { userId }, select: { imageUrl: true } }),
  ]);

  await prisma.$transaction([
    prisma.entry.deleteMany({ where: { matchWeekId: { in: weekIds } } }),
    prisma.exercise.deleteMany({ where: { matchWeekId: { in: weekIds } } }),
    prisma.matchWeek.deleteMany({ where: { userId } }),
    prisma.savedMealItem.deleteMany({ where: { savedMeal: { userId } } }),
    prisma.savedMeal.deleteMany({ where: { userId } }),
    prisma.weighIn.deleteMany({ where: { userId } }),
    prisma.measurement.deleteMany({ where: { userId } }),
    prisma.progressPhoto.deleteMany({ where: { userId } }),
    prisma.dayNote.deleteMany({ where: { userId } }),
    prisma.waterLog.deleteMany({ where: { userId } }),
    prisma.foodFavorite.deleteMany({ where: { userId } }),
    prisma.foodOverride.deleteMany({ where: { userId } }),
    prisma.foodTag.deleteMany({ where: { userId } }),
    prisma.pushSubscription.deleteMany({ where: { userId } }),
    prisma.passwordResetToken.deleteMany({ where: { userId } }),
    prisma.whoopCycle.deleteMany({ where: { userId } }),
    prisma.whoopSleep.deleteMany({ where: { userId } }),
    prisma.whoopRecovery.deleteMany({ where: { userId } }),
    prisma.whoopConnection.deleteMany({ where: { userId } }),
    prisma.user.delete({ where: { id: userId } }),
  ]);

  for (const row of [...entries, ...exercises, ...progressPhotos]) {
    deleteUploadedImage(row.imageUrl);
  }
}
