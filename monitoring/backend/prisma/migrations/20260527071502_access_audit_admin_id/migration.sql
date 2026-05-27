-- AlterTable
ALTER TABLE "AccessAudit" ADD COLUMN "adminId" TEXT;

-- CreateIndex
CREATE INDEX "AccessAudit_adminId_idx" ON "AccessAudit"("adminId");
