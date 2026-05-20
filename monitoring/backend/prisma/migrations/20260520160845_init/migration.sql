-- CreateTable
CREATE TABLE "Device" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "machineId" TEXT NOT NULL,
    "hostname" TEXT NOT NULL,
    "os" TEXT,
    "agentVersion" TEXT,
    "enrollmentTokenHash" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastSeen" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "MonitoredUser" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sid" TEXT NOT NULL,
    "displayName" TEXT,
    "department" TEXT,
    "email" TEXT,
    "okbaseId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ActivityInterval" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "deviceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "intervalStart" DATETIME NOT NULL,
    "intervalSeconds" INTEGER NOT NULL DEFAULT 60,
    "activeSeconds" INTEGER NOT NULL DEFAULT 0,
    "idleSeconds" INTEGER NOT NULL DEFAULT 0,
    "foregroundApp" TEXT,
    "appCategory" TEXT,
    "keystrokeCount" INTEGER NOT NULL DEFAULT 0,
    "mouseEvents" INTEGER NOT NULL DEFAULT 0,
    "sessionLocked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ActivityInterval_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ActivityInterval_userId_fkey" FOREIGN KEY ("userId") REFERENCES "MonitoredUser" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ActivityHourly" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "hourStart" DATETIME NOT NULL,
    "activeMinutes" REAL NOT NULL DEFAULT 0,
    "idleMinutes" REAL NOT NULL DEFAULT 0,
    "lockedMinutes" REAL NOT NULL DEFAULT 0,
    "topApp" TEXT,
    "keystrokeTotal" INTEGER NOT NULL DEFAULT 0,
    "mouseTotal" INTEGER NOT NULL DEFAULT 0,
    "avgKpm" REAL NOT NULL DEFAULT 0,
    "meetingMinutes" REAL NOT NULL DEFAULT 0,
    "absenceType" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ActivityHourly_userId_fkey" FOREIGN KEY ("userId") REFERENCES "MonitoredUser" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AppCategory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "appName" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Absence" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "type" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'OKBASE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Absence_userId_fkey" FOREIGN KEY ("userId") REFERENCES "MonitoredUser" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CalendarEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "externalId" TEXT,
    "startsAt" DATETIME NOT NULL,
    "endsAt" DATETIME NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'MEETING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CalendarEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "MonitoredUser" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AccessAudit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "adminIdentity" TEXT NOT NULL,
    "viewedUserId" TEXT,
    "action" TEXT NOT NULL,
    "detail" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "Device_machineId_key" ON "Device"("machineId");

-- CreateIndex
CREATE INDEX "Device_active_idx" ON "Device"("active");

-- CreateIndex
CREATE INDEX "Device_lastSeen_idx" ON "Device"("lastSeen");

-- CreateIndex
CREATE UNIQUE INDEX "MonitoredUser_sid_key" ON "MonitoredUser"("sid");

-- CreateIndex
CREATE INDEX "MonitoredUser_department_idx" ON "MonitoredUser"("department");

-- CreateIndex
CREATE INDEX "MonitoredUser_active_idx" ON "MonitoredUser"("active");

-- CreateIndex
CREATE INDEX "ActivityInterval_userId_intervalStart_idx" ON "ActivityInterval"("userId", "intervalStart");

-- CreateIndex
CREATE INDEX "ActivityInterval_intervalStart_idx" ON "ActivityInterval"("intervalStart");

-- CreateIndex
CREATE UNIQUE INDEX "ActivityInterval_deviceId_userId_intervalStart_key" ON "ActivityInterval"("deviceId", "userId", "intervalStart");

-- CreateIndex
CREATE INDEX "ActivityHourly_hourStart_idx" ON "ActivityHourly"("hourStart");

-- CreateIndex
CREATE UNIQUE INDEX "ActivityHourly_userId_hourStart_key" ON "ActivityHourly"("userId", "hourStart");

-- CreateIndex
CREATE UNIQUE INDEX "AppCategory_appName_key" ON "AppCategory"("appName");

-- CreateIndex
CREATE INDEX "Absence_date_idx" ON "Absence"("date");

-- CreateIndex
CREATE UNIQUE INDEX "Absence_userId_date_type_key" ON "Absence"("userId", "date", "type");

-- CreateIndex
CREATE INDEX "CalendarEvent_userId_startsAt_idx" ON "CalendarEvent"("userId", "startsAt");

-- CreateIndex
CREATE UNIQUE INDEX "CalendarEvent_userId_externalId_key" ON "CalendarEvent"("userId", "externalId");

-- CreateIndex
CREATE INDEX "AccessAudit_createdAt_idx" ON "AccessAudit"("createdAt");

-- CreateIndex
CREATE INDEX "AccessAudit_adminIdentity_idx" ON "AccessAudit"("adminIdentity");
