-- The referral scheme. See src/referrals.ts for what it pays and why.
--
-- Nullable throughout on purpose: every existing account carries on with no
-- code and no referrer, and a code is minted the first time someone opens the
-- invite screen rather than backfilled for accounts that will never share one.
ALTER TABLE "User" ADD COLUMN "referralCode" TEXT;
ALTER TABLE "User" ADD COLUMN "referredById" INTEGER REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "User" ADD COLUMN "referralRewardedAt" DATETIME;
ALTER TABLE "User" ADD COLUMN "referralTrialUsed" BOOLEAN NOT NULL DEFAULT false;

-- Unique so two accounts can never claim the same code, which is what makes a
-- code safe to resolve to exactly one referrer. SQLite counts NULLs as
-- distinct, so the accounts without one don't collide.
CREATE UNIQUE INDEX "User_referralCode_key" ON "User"("referralCode");
CREATE INDEX "User_referredById_idx" ON "User"("referredById");
