-- AlterTable
ALTER TABLE "MonitoredUser" ADD COLUMN "hourlyRate" REAL;

-- CreateTable
CREATE TABLE "ClassificationClaim" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "targetKind" TEXT NOT NULL DEFAULT 'APP',
    "suggested" TEXT NOT NULL,
    "note" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "ClassificationClaim_status_idx" ON "ClassificationClaim"("status");

-- CreateIndex
CREATE INDEX "ClassificationClaim_userId_idx" ON "ClassificationClaim"("userId");
