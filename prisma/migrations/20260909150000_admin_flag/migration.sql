-- Who can see the admin screen.
ALTER TABLE "User" ADD COLUMN "isAdmin" BOOLEAN NOT NULL DEFAULT false;

-- The account that has been here longest gets it. Without this nobody has the
-- flag, nobody can grant it, and the screen is unreachable on a deployment
-- that already has users — which is every deployment this ships to.
UPDATE "User" SET "isAdmin" = true
WHERE "id" = (SELECT "id" FROM "User" ORDER BY "id" ASC LIMIT 1);
