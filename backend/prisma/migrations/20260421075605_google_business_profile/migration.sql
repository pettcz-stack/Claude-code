-- AlterTable
ALTER TABLE "Comment" ADD COLUMN "authorPhotoUrl" TEXT;
ALTER TABLE "Comment" ADD COLUMN "sourceUrl" TEXT;
ALTER TABLE "Comment" ADD COLUMN "starRating" INTEGER;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Account" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "source" TEXT NOT NULL DEFAULT 'META',
    "platform" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "pageName" TEXT NOT NULL,
    "accessTokenEncrypted" TEXT NOT NULL,
    "refreshTokenEncrypted" TEXT,
    "tokenExpiresAt" DATETIME,
    "externalAccountId" TEXT,
    "externalLocationId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Account" ("accessTokenEncrypted", "active", "createdAt", "id", "pageId", "pageName", "platform", "tokenExpiresAt", "updatedAt") SELECT "accessTokenEncrypted", "active", "createdAt", "id", "pageId", "pageName", "platform", "tokenExpiresAt", "updatedAt" FROM "Account";
DROP TABLE "Account";
ALTER TABLE "new_Account" RENAME TO "Account";
CREATE UNIQUE INDEX "Account_pageId_key" ON "Account"("pageId");
CREATE INDEX "Account_platform_idx" ON "Account"("platform");
CREATE INDEX "Account_source_idx" ON "Account"("source");
CREATE INDEX "Account_active_idx" ON "Account"("active");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Comment_starRating_idx" ON "Comment"("starRating");
