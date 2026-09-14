-- One vote per account per item. NULLs stay distinct in SQLite, so any number
-- of signed-out votes still coexist; this only binds rows that know who cast
-- them.
CREATE UNIQUE INDEX "RoadmapVote_itemId_userId_key" ON "RoadmapVote"("itemId", "userId");
