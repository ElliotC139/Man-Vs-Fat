-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Exercise" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "description" TEXT NOT NULL,
    "kcalBurned" INTEGER,
    "imageUrl" TEXT,
    "matchWeekId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "whoopWorkoutId" TEXT,
    CONSTRAINT "Exercise_matchWeekId_fkey" FOREIGN KEY ("matchWeekId") REFERENCES "MatchWeek" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Exercise" ("createdAt", "description", "id", "imageUrl", "kcalBurned", "matchWeekId", "timestamp", "whoopWorkoutId") SELECT "createdAt", "description", "id", "imageUrl", "kcalBurned", "matchWeekId", "timestamp", "whoopWorkoutId" FROM "Exercise";
DROP TABLE "Exercise";
ALTER TABLE "new_Exercise" RENAME TO "Exercise";
CREATE UNIQUE INDEX "Exercise_whoopWorkoutId_key" ON "Exercise"("whoopWorkoutId");
CREATE INDEX "Exercise_matchWeekId_idx" ON "Exercise"("matchWeekId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

