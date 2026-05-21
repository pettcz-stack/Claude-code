-- AlterTable
ALTER TABLE "ActivityInterval" ADD COLUMN "clientIp" TEXT;

-- AlterTable
ALTER TABLE "DailyStat" ADD COLUMN "site" TEXT;

-- CreateTable
CREATE TABLE "Site" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "subnets" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
