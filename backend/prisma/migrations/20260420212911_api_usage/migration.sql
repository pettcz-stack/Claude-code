-- CreateTable
CREATE TABLE "ApiUsage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "feature" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "cacheCreationTokens" INTEGER NOT NULL DEFAULT 0,
    "cacheReadTokens" INTEGER NOT NULL DEFAULT 0,
    "estCostUsd" REAL NOT NULL DEFAULT 0,
    "commentId" TEXT
);

-- CreateIndex
CREATE INDEX "ApiUsage_createdAt_idx" ON "ApiUsage"("createdAt");

-- CreateIndex
CREATE INDEX "ApiUsage_feature_idx" ON "ApiUsage"("feature");

-- CreateIndex
CREATE INDEX "ApiUsage_commentId_idx" ON "ApiUsage"("commentId");
