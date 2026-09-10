-- Which way a subscriber is billed, so the settings card can quote the price
-- they actually pay rather than assuming monthly.
ALTER TABLE "User" ADD COLUMN "subscriptionInterval" TEXT;
