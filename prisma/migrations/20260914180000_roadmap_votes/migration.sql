-- Votes for things that don't exist yet. See src/roadmap.ts.
CREATE TABLE "RoadmapVote" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "itemId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "email" TEXT,
    "userId" INTEGER,
    "browserKey" TEXT
);

CREATE INDEX "RoadmapVote_itemId_createdAt_idx" ON "RoadmapVote"("itemId", "createdAt");

-- SQLite treats NULLs as distinct in a unique index, which is what we want:
-- any number of anonymous votes with no browser key and no email can coexist,
-- while a browser or an address that votes twice for one item is caught.
CREATE UNIQUE INDEX "RoadmapVote_itemId_browserKey_key" ON "RoadmapVote"("itemId", "browserKey");
CREATE UNIQUE INDEX "RoadmapVote_itemId_email_key" ON "RoadmapVote"("itemId", "email");
