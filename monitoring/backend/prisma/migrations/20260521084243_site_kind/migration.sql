-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Site" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "subnets" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'VLASTNI',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Site" ("active", "createdAt", "id", "name", "subnets") SELECT "active", "createdAt", "id", "name", "subnets" FROM "Site";
DROP TABLE "Site";
ALTER TABLE "new_Site" RENAME TO "Site";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
