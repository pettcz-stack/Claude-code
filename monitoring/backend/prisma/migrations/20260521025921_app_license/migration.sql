-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AppCategory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "appName" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'NEUTRAL',
    "licensed" BOOLEAN NOT NULL DEFAULT false,
    "seats" INTEGER,
    "costPerSeat" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_AppCategory" ("appName", "category", "createdAt", "id", "type", "updatedAt") SELECT "appName", "category", "createdAt", "id", "type", "updatedAt" FROM "AppCategory";
DROP TABLE "AppCategory";
ALTER TABLE "new_AppCategory" RENAME TO "AppCategory";
CREATE UNIQUE INDEX "AppCategory_appName_key" ON "AppCategory"("appName");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
