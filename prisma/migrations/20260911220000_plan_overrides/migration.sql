-- One row per plan the operator has edited, holding only what differs from
-- src/plans.ts. Every column is nullable because null means "the code
-- decides"; a plan nobody has touched has no row here at all.
CREATE TABLE "PlanOverride" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dailyEstimates" INTEGER,
    "ads" BOOLEAN,
    "photo" BOOLEAN,
    "recipeScan" BOOLEAN,
    "health" BOOLEAN,
    "weeklyReport" BOOLEAN,
    "weeklyReview" BOOLEAN,
    "eatingWindow" BOOLEAN,
    "fasting" BOOLEAN,
    "keto" BOOLEAN,
    "measurements" BOOLEAN,
    "progressPhotos" BOOLEAN,
    "updatedAt" DATETIME NOT NULL
);
