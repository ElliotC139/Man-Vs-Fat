-- Where a signup came from. Nullable throughout: every account that existed
-- before this column did came from somewhere nobody recorded, and inventing a
-- value for them would put a wrong answer in the one table meant to hold the
-- right one.
ALTER TABLE "User" ADD COLUMN "signupSource" TEXT;
ALTER TABLE "User" ADD COLUMN "signupCampaign" TEXT;
ALTER TABLE "User" ADD COLUMN "signupLanding" TEXT;

-- The admin screen groups by source and orders by recency.
CREATE INDEX "User_signupSource_idx" ON "User"("signupSource");
