-- Add body stats and goal fields to User
ALTER TABLE "User" ADD COLUMN "weightKg" REAL;
ALTER TABLE "User" ADD COLUMN "heightCm" REAL;
ALTER TABLE "User" ADD COLUMN "ageYears" INTEGER;
ALTER TABLE "User" ADD COLUMN "activityLevel" TEXT;
ALTER TABLE "User" ADD COLUMN "weeklyGoalKg" REAL;

-- Create Exercise table
CREATE TABLE "Exercise" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "description" TEXT NOT NULL,
    "kcalBurned" INTEGER,
    "imageUrl" TEXT,
    "matchWeekId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Exercise_matchWeekId_fkey" FOREIGN KEY ("matchWeekId") REFERENCES "MatchWeek" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "Exercise_matchWeekId_idx" ON "Exercise"("matchWeekId");
