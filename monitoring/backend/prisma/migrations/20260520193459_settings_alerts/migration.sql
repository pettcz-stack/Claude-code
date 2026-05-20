-- CreateTable
CREATE TABLE "Setting" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SentAlert" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "lastSentAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
