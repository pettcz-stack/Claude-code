-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ActivityInterval" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "deviceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "intervalStart" DATETIME NOT NULL,
    "intervalSeconds" INTEGER NOT NULL DEFAULT 60,
    "activeSeconds" INTEGER NOT NULL DEFAULT 0,
    "idleSeconds" INTEGER NOT NULL DEFAULT 0,
    "foregroundApp" TEXT,
    "windowTitle" TEXT,
    "appCategory" TEXT,
    "keystrokeCount" INTEGER NOT NULL DEFAULT 0,
    "mouseEvents" INTEGER NOT NULL DEFAULT 0,
    "typingMs" INTEGER NOT NULL DEFAULT 0,
    "typingKeystrokeCount" INTEGER NOT NULL DEFAULT 0,
    "sessionLocked" BOOLEAN NOT NULL DEFAULT false,
    "monitorCount" INTEGER,
    "clientIp" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ActivityInterval_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ActivityInterval_userId_fkey" FOREIGN KEY ("userId") REFERENCES "MonitoredUser" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ActivityInterval" ("activeSeconds", "appCategory", "clientIp", "createdAt", "deviceId", "foregroundApp", "id", "idleSeconds", "intervalSeconds", "intervalStart", "keystrokeCount", "monitorCount", "mouseEvents", "sessionLocked", "userId", "windowTitle") SELECT "activeSeconds", "appCategory", "clientIp", "createdAt", "deviceId", "foregroundApp", "id", "idleSeconds", "intervalSeconds", "intervalStart", "keystrokeCount", "monitorCount", "mouseEvents", "sessionLocked", "userId", "windowTitle" FROM "ActivityInterval";
DROP TABLE "ActivityInterval";
ALTER TABLE "new_ActivityInterval" RENAME TO "ActivityInterval";
CREATE INDEX "ActivityInterval_userId_intervalStart_idx" ON "ActivityInterval"("userId", "intervalStart");
CREATE INDEX "ActivityInterval_intervalStart_idx" ON "ActivityInterval"("intervalStart");
CREATE UNIQUE INDEX "ActivityInterval_deviceId_userId_intervalStart_key" ON "ActivityInterval"("deviceId", "userId", "intervalStart");
CREATE TABLE "new_DailyStat" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "workMin" REAL NOT NULL DEFAULT 0,
    "nonWorkMin" REAL NOT NULL DEFAULT 0,
    "idleMin" REAL NOT NULL DEFAULT 0,
    "unknownMin" REAL NOT NULL DEFAULT 0,
    "keystroke" INTEGER NOT NULL DEFAULT 0,
    "typingMs" INTEGER NOT NULL DEFAULT 0,
    "typingKeystrokeCount" INTEGER NOT NULL DEFAULT 0,
    "monitorTop" INTEGER NOT NULL DEFAULT 0,
    "multiMonitorMin" REAL NOT NULL DEFAULT 0,
    "domWorkCat" TEXT,
    "site" TEXT,
    "suspicious" BOOLEAN NOT NULL DEFAULT false
);
INSERT INTO "new_DailyStat" ("date", "domWorkCat", "id", "idleMin", "keystroke", "monitorTop", "multiMonitorMin", "nonWorkMin", "site", "suspicious", "unknownMin", "userId", "workMin") SELECT "date", "domWorkCat", "id", "idleMin", "keystroke", "monitorTop", "multiMonitorMin", "nonWorkMin", "site", "suspicious", "unknownMin", "userId", "workMin" FROM "DailyStat";
DROP TABLE "DailyStat";
ALTER TABLE "new_DailyStat" RENAME TO "DailyStat";
CREATE INDEX "DailyStat_date_idx" ON "DailyStat"("date");
CREATE UNIQUE INDEX "DailyStat_userId_date_key" ON "DailyStat"("userId", "date");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
