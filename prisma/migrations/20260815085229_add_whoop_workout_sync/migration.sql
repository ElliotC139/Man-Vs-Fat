-- AlterTable
ALTER TABLE "Exercise" ADD COLUMN "whoopWorkoutId" BIGINT;

-- CreateIndex
CREATE UNIQUE INDEX "Exercise_whoopWorkoutId_key" ON "Exercise"("whoopWorkoutId");

