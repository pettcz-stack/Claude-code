-- CreateTable
CREATE TABLE "PrintJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "deviceId" TEXT NOT NULL,
    "userId" TEXT,
    "printerName" TEXT,
    "documentName" TEXT,
    "pages" INTEGER NOT NULL DEFAULT 1,
    "copies" INTEGER NOT NULL DEFAULT 1,
    "paperSize" TEXT,
    "color" BOOLEAN,
    "duplex" BOOLEAN,
    "sizeBytes" INTEGER,
    "jobAt" DATETIME NOT NULL,
    "reportedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PrintJob_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PrintJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "MonitoredUser" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UsbFileEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "deviceId" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "driveLetter" TEXT,
    "driveLabel" TEXT,
    "fileName" TEXT,
    "fileExt" TEXT,
    "sizeBytes" BIGINT,
    "eventAt" DATETIME NOT NULL,
    "reportedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UsbFileEvent_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UsbFileEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "MonitoredUser" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "PrintJob_deviceId_jobAt_idx" ON "PrintJob"("deviceId", "jobAt");

-- CreateIndex
CREATE INDEX "PrintJob_userId_jobAt_idx" ON "PrintJob"("userId", "jobAt");

-- CreateIndex
CREATE INDEX "PrintJob_jobAt_idx" ON "PrintJob"("jobAt");

-- CreateIndex
CREATE INDEX "UsbFileEvent_deviceId_eventAt_idx" ON "UsbFileEvent"("deviceId", "eventAt");

-- CreateIndex
CREATE INDEX "UsbFileEvent_userId_eventAt_idx" ON "UsbFileEvent"("userId", "eventAt");

-- CreateIndex
CREATE INDEX "UsbFileEvent_eventAt_idx" ON "UsbFileEvent"("eventAt");
