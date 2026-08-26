-- CreateTable
CREATE TABLE "WhoopSleep" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "whoopSleepId" TEXT NOT NULL,
    "start" DATETIME NOT NULL,
    "end" DATETIME NOT NULL,
    "performancePercent" INTEGER,
    "timeAsleepMin" INTEGER,
    "scoreState" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WhoopSleep_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WhoopRecovery" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "whoopCycleId" BIGINT NOT NULL,
    "date" TEXT NOT NULL,
    "recoveryScore" INTEGER,
    "restingHeartRate" INTEGER,
    "hrvMilli" REAL,
    "scoreState" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WhoopRecovery_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "WhoopSleep_whoopSleepId_key" ON "WhoopSleep"("whoopSleepId");

-- CreateIndex
CREATE INDEX "WhoopSleep_userId_start_idx" ON "WhoopSleep"("userId", "start");

-- CreateIndex
CREATE UNIQUE INDEX "WhoopRecovery_whoopCycleId_key" ON "WhoopRecovery"("whoopCycleId");

-- CreateIndex
CREATE INDEX "WhoopRecovery_userId_date_idx" ON "WhoopRecovery"("userId", "date");
