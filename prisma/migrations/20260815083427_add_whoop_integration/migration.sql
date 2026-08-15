-- CreateTable
CREATE TABLE "WhoopConnection" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "whoopUserId" BIGINT,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "lastSyncedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WhoopConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WhoopCycle" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "whoopCycleId" BIGINT NOT NULL,
    "start" DATETIME NOT NULL,
    "end" DATETIME,
    "kcalBurned" INTEGER,
    "scoreState" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WhoopCycle_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "WhoopConnection_userId_key" ON "WhoopConnection"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "WhoopCycle_whoopCycleId_key" ON "WhoopCycle"("whoopCycleId");

-- CreateIndex
CREATE INDEX "WhoopCycle_userId_start_idx" ON "WhoopCycle"("userId", "start");
