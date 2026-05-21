-- CreateTable
CREATE TABLE "DailyAppStat" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "kind" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "activeMin" REAL NOT NULL DEFAULT 0
);

-- CreateIndex
CREATE INDEX "DailyAppStat_date_kind_idx" ON "DailyAppStat"("date", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "DailyAppStat_userId_date_kind_label_key" ON "DailyAppStat"("userId", "date", "kind", "label");
