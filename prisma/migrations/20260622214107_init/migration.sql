-- CreateTable
CREATE TABLE "MatchWeek" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "startsAt" DATETIME NOT NULL,
    "endsAt" DATETIME NOT NULL,
    "reportGeneratedAt" DATETIME,
    "reportDriveFileId" TEXT,
    "reportDriveUrl" TEXT
);

-- CreateTable
CREATE TABLE "Entry" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rawInput" TEXT,
    "label" TEXT NOT NULL,
    "kcal" INTEGER,
    "imageUrl" TEXT,
    "edited" BOOLEAN NOT NULL DEFAULT false,
    "matchWeekId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Entry_matchWeekId_fkey" FOREIGN KEY ("matchWeekId") REFERENCES "MatchWeek" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Setting" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "MatchWeek_startsAt_endsAt_key" ON "MatchWeek"("startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "Entry_matchWeekId_idx" ON "Entry"("matchWeekId");
