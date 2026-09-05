-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Entry" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rawInput" TEXT,
    "label" TEXT NOT NULL,
    "kcal" INTEGER,
    "imageUrl" TEXT,
    "mealType" TEXT,
    "source" TEXT NOT NULL DEFAULT 'ai',
    "edited" BOOLEAN NOT NULL DEFAULT false,
    "quantity" REAL NOT NULL DEFAULT 1,
    "proteinG" REAL,
    "carbsG" REAL,
    "fatG" REAL,
    "matchWeekId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Entry_matchWeekId_fkey" FOREIGN KEY ("matchWeekId") REFERENCES "MatchWeek" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Entry" ("carbsG", "createdAt", "edited", "fatG", "id", "imageUrl", "kcal", "label", "matchWeekId", "mealType", "proteinG", "quantity", "rawInput", "source", "timestamp", "updatedAt") SELECT "carbsG", "createdAt", "edited", "fatG", "id", "imageUrl", "kcal", "label", "matchWeekId", "mealType", "proteinG", "quantity", "rawInput", "source", "timestamp", "updatedAt" FROM "Entry";
DROP TABLE "Entry";
ALTER TABLE "new_Entry" RENAME TO "Entry";
CREATE INDEX "Entry_matchWeekId_idx" ON "Entry"("matchWeekId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

