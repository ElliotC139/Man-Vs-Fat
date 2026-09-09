-- Where a subscription stands, kept alongside the plan it pays for.
--
-- Plain ALTER TABLE rather than Prisma's table-rebuild: these are four
-- nullable columns with no defaults to backfill, and rebuilding the User
-- table to add them would rewrite every row for no reason.
ALTER TABLE "User" ADD COLUMN "stripeCustomerId" TEXT;
ALTER TABLE "User" ADD COLUMN "stripeSubscriptionId" TEXT;
ALTER TABLE "User" ADD COLUMN "subscriptionStatus" TEXT;
ALTER TABLE "User" ADD COLUMN "subscriptionEndsAt" DATETIME;

-- Unique so a webhook arriving twice, or out of order, cannot attach the same
-- Stripe customer or subscription to two accounts.
CREATE UNIQUE INDEX "User_stripeCustomerId_key" ON "User"("stripeCustomerId");
CREATE UNIQUE INDEX "User_stripeSubscriptionId_key" ON "User"("stripeSubscriptionId");
