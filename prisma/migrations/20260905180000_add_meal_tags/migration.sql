-- AlterTable
ALTER TABLE "User" ADD COLUMN "mealTagsEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "mealTagNames" TEXT;
