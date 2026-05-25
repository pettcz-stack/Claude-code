-- CreateTable
CREATE TABLE "DeviceHealth" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "deviceId" TEXT NOT NULL,
    "reportedAt" DATETIME NOT NULL,
    "osName" TEXT,
    "osVersion" TEXT,
    "uptimeSec" INTEGER,
    "manufacturer" TEXT,
    "model" TEXT,
    "serial" TEXT,
    "biosVersion" TEXT,
    "biosDate" DATETIME,
    "cpuModel" TEXT,
    "cpuLoadPct" INTEGER,
    "ramTotalMB" INTEGER,
    "ramUsedPct" INTEGER,
    "batteryPresent" BOOLEAN NOT NULL DEFAULT false,
    "batteryChargePct" INTEGER,
    "batteryHealthPct" INTEGER,
    "batteryCycles" INTEGER,
    "onAcPower" BOOLEAN,
    "disksJson" TEXT,
    "antivirusEnabled" BOOLEAN,
    "antivirusUpdated" BOOLEAN,
    "pendingUpdates" INTEGER,
    "rebootPending" BOOLEAN,
    "status" TEXT NOT NULL,
    "issuesJson" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DeviceHealth_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "DeviceHealth_deviceId_key" ON "DeviceHealth"("deviceId");

-- CreateIndex
CREATE INDEX "DeviceHealth_status_idx" ON "DeviceHealth"("status");
