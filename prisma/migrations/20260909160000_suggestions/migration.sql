-- Something a person wants changed.
CREATE TABLE "Suggestion" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "kind" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "appVersion" TEXT,
    "userAgent" TEXT,
    "handled" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "Suggestion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- The list is read as "the unhandled ones, newest first", which is this index.
CREATE INDEX "Suggestion_handled_createdAt_idx" ON "Suggestion"("handled", "createdAt");
