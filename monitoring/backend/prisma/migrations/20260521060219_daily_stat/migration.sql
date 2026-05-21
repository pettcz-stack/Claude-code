-- CreateTable
CREATE TABLE "DailyStat" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "workMin" REAL NOT NULL DEFAULT 0,
    "nonWorkMin" REAL NOT NULL DEFAULT 0,
    "idleMin" REAL NOT NULL DEFAULT 0,
    "unknownMin" REAL NOT NULL DEFAULT 0,
    "keystroke" INTEGER NOT NULL DEFAULT 0,
    "monitorTop" INTEGER NOT NULL DEFAULT 0,
    "multiMonitorMin" REAL NOT NULL DEFAULT 0,
    "domWorkCat" TEXT,
    "suspicious" BOOLEAN NOT NULL DEFAULT false
);

-- CreateIndex
CREATE INDEX "DailyStat_date_idx" ON "DailyStat"("date");

-- CreateIndex
CREATE UNIQUE INDEX "DailyStat_userId_date_key" ON "DailyStat"("userId", "date");
