-- CreateTable
CREATE TABLE "User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "weekStartWeekday" INTEGER NOT NULL DEFAULT 0,
    "weekStartHour" INTEGER NOT NULL DEFAULT 17,
    "weekStartMinute" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_MatchWeek" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER,
    "startsAt" DATETIME NOT NULL,
    "endsAt" DATETIME NOT NULL,
    "reportGeneratedAt" DATETIME,
    "reportDriveFileId" TEXT,
    "reportDriveUrl" TEXT,
    CONSTRAINT "MatchWeek_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_MatchWeek" ("endsAt", "id", "reportDriveFileId", "reportDriveUrl", "reportGeneratedAt", "startsAt") SELECT "endsAt", "id", "reportDriveFileId", "reportDriveUrl", "reportGeneratedAt", "startsAt" FROM "MatchWeek";
DROP TABLE "MatchWeek";
ALTER TABLE "new_MatchWeek" RENAME TO "MatchWeek";
CREATE UNIQUE INDEX "MatchWeek_userId_startsAt_endsAt_key" ON "MatchWeek"("userId", "startsAt", "endsAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
