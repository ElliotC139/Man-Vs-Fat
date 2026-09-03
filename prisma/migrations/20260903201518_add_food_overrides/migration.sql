-- CreateTable
CREATE TABLE "FoodOverride" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "labelKey" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "kcal" INTEGER,
    "proteinG" REAL,
    "carbsG" REAL,
    "fatG" REAL,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FoodOverride_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "FoodOverride_userId_labelKey_key" ON "FoodOverride"("userId", "labelKey");
