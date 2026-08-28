-- CreateTable
CREATE TABLE "SavedMeal" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'template',
    "servings" REAL NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SavedMeal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SavedMealItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "savedMealId" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "kcal" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "SavedMealItem_savedMealId_fkey" FOREIGN KEY ("savedMealId") REFERENCES "SavedMeal" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

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
    "mealType" TEXT NOT NULL DEFAULT 'snack',
    "source" TEXT NOT NULL DEFAULT 'ai',
    "edited" BOOLEAN NOT NULL DEFAULT false,
    "matchWeekId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Entry_matchWeekId_fkey" FOREIGN KEY ("matchWeekId") REFERENCES "MatchWeek" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Entry" ("createdAt", "edited", "id", "imageUrl", "kcal", "label", "matchWeekId", "mealType", "rawInput", "timestamp", "updatedAt") SELECT "createdAt", "edited", "id", "imageUrl", "kcal", "label", "matchWeekId", "mealType", "rawInput", "timestamp", "updatedAt" FROM "Entry";
DROP TABLE "Entry";
ALTER TABLE "new_Entry" RENAME TO "Entry";
CREATE INDEX "Entry_matchWeekId_idx" ON "Entry"("matchWeekId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "SavedMeal_userId_idx" ON "SavedMeal"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "SavedMeal_userId_name_key" ON "SavedMeal"("userId", "name");

-- CreateIndex
CREATE INDEX "SavedMealItem_savedMealId_idx" ON "SavedMealItem"("savedMealId");
