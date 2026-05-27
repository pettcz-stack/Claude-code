-- AlterTable
ALTER TABLE "AdminUser" ADD COLUMN "email" TEXT;
ALTER TABLE "AdminUser" ADD COLUMN "fullName" TEXT;

-- CreateTable
CREATE TABLE "AdminUserDepartment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "adminId" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AdminUserDepartment_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "AdminUser" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "AdminUserDepartment_department_idx" ON "AdminUserDepartment"("department");

-- CreateIndex
CREATE UNIQUE INDEX "AdminUserDepartment_adminId_department_key" ON "AdminUserDepartment"("adminId", "department");
