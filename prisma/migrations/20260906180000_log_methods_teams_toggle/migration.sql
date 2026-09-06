-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT,
    "googleId" TEXT,
    "email" TEXT,
    "weekStartWeekday" INTEGER NOT NULL DEFAULT 0,
    "weekStartHour" INTEGER NOT NULL DEFAULT 17,
    "weekStartMinute" INTEGER NOT NULL DEFAULT 0,
    "weightKg" REAL,
    "heightCm" REAL,
    "ageYears" INTEGER,
    "sex" TEXT,
    "layout" TEXT,
    "burnSource" TEXT,
    "kcalBufferMode" TEXT,
    "kcalBufferPct" INTEGER,
    "kcalBufferMinPct" INTEGER,
    "kcalBufferMaxPct" INTEGER,
    "mealTagsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "mealTagNames" TEXT,
    "activityLevel" TEXT,
    "weeklyGoalKg" REAL,
    "goalWeightKg" REAL,
    "dailyCalorieTarget" INTEGER,
    "targetReviewedWeek" DATETIME,
    "logMethods" TEXT,
    "teamsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "nutrientsShown" TEXT,
    "carbMode" TEXT,
    "fibreTargetG" INTEGER,
    "fibreOp" TEXT,
    "sugarTargetG" INTEGER,
    "sugarOp" TEXT,
    "satFatTargetG" INTEGER,
    "satFatOp" TEXT,
    "saltTargetG" REAL,
    "saltOp" TEXT,
    "macroMode" TEXT,
    "proteinTargetG" INTEGER,
    "carbsTargetG" INTEGER,
    "fatTargetG" INTEGER,
    "proteinOp" TEXT,
    "carbsOp" TEXT,
    "fatOp" TEXT,
    "proteinPct" INTEGER,
    "carbsPct" INTEGER,
    "fatPct" INTEGER,
    "sessionsValidFrom" DATETIME,
    "reminderHour" INTEGER,
    "mealReminders" TEXT,
    "eatingWindowHours" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_User" ("activityLevel", "ageYears", "burnSource", "carbMode", "carbsOp", "carbsPct", "carbsTargetG", "createdAt", "dailyCalorieTarget", "eatingWindowHours", "email", "fatOp", "fatPct", "fatTargetG", "fibreOp", "fibreTargetG", "goalWeightKg", "googleId", "heightCm", "id", "kcalBufferMaxPct", "kcalBufferMinPct", "kcalBufferMode", "kcalBufferPct", "layout", "macroMode", "mealReminders", "mealTagNames", "mealTagsEnabled", "nutrientsShown", "passwordHash", "proteinOp", "proteinPct", "proteinTargetG", "reminderHour", "saltOp", "saltTargetG", "satFatOp", "satFatTargetG", "sessionsValidFrom", "sex", "sugarOp", "sugarTargetG", "targetReviewedWeek", "username", "weekStartHour", "weekStartMinute", "weekStartWeekday", "weeklyGoalKg", "weightKg") SELECT "activityLevel", "ageYears", "burnSource", "carbMode", "carbsOp", "carbsPct", "carbsTargetG", "createdAt", "dailyCalorieTarget", "eatingWindowHours", "email", "fatOp", "fatPct", "fatTargetG", "fibreOp", "fibreTargetG", "goalWeightKg", "googleId", "heightCm", "id", "kcalBufferMaxPct", "kcalBufferMinPct", "kcalBufferMode", "kcalBufferPct", "layout", "macroMode", "mealReminders", "mealTagNames", "mealTagsEnabled", "nutrientsShown", "passwordHash", "proteinOp", "proteinPct", "proteinTargetG", "reminderHour", "saltOp", "saltTargetG", "satFatOp", "satFatTargetG", "sessionsValidFrom", "sex", "sugarOp", "sugarTargetG", "targetReviewedWeek", "username", "weekStartHour", "weekStartMinute", "weekStartWeekday", "weeklyGoalKg", "weightKg" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
CREATE UNIQUE INDEX "User_googleId_key" ON "User"("googleId");
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

