CREATE TYPE "BackupKind" AS ENUM ('AUTOMATIC', 'MANUAL');
CREATE TYPE "BackupStatus" AS ENUM ('READY', 'FAILED');
CREATE TYPE "EmailReportDeliveryStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

CREATE TABLE "BackupSnapshot" (
    "id" TEXT NOT NULL,
    "kind" "BackupKind" NOT NULL,
    "status" "BackupStatus" NOT NULL DEFAULT 'READY',
    "fileName" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL DEFAULT 0,
    "sha256" TEXT,
    "errorMessage" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BackupSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EmailReportSchedule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Månedsoversigt',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "recipients" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "daysOfMonth" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "sendHour" INTEGER NOT NULL DEFAULT 8,
    "sendMinute" INTEGER NOT NULL DEFAULT 0,
    "timezone" TEXT NOT NULL DEFAULT 'Europe/Copenhagen',
    "lastSentAt" TIMESTAMP(3),
    "lastAttemptAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailReportSchedule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EmailReportDelivery" (
    "id" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "uniqueKey" TEXT NOT NULL,
    "status" "EmailReportDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "recipientCount" INTEGER NOT NULL DEFAULT 0,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailReportDelivery_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BackupSnapshot_fileName_key" ON "BackupSnapshot"("fileName");
CREATE INDEX "BackupSnapshot_kind_createdAt_idx" ON "BackupSnapshot"("kind", "createdAt");
CREATE INDEX "BackupSnapshot_status_createdAt_idx" ON "BackupSnapshot"("status", "createdAt");

CREATE UNIQUE INDEX "EmailReportDelivery_uniqueKey_key" ON "EmailReportDelivery"("uniqueKey");
CREATE INDEX "EmailReportDelivery_scheduleId_createdAt_idx" ON "EmailReportDelivery"("scheduleId", "createdAt");
CREATE INDEX "EmailReportDelivery_status_createdAt_idx" ON "EmailReportDelivery"("status", "createdAt");

ALTER TABLE "EmailReportDelivery"
ADD CONSTRAINT "EmailReportDelivery_scheduleId_fkey"
FOREIGN KEY ("scheduleId") REFERENCES "EmailReportSchedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "EmailReportSchedule" (
  "id",
  "name",
  "enabled",
  "recipients",
  "daysOfMonth",
  "sendHour",
  "sendMinute",
  "timezone",
  "createdAt",
  "updatedAt"
)
VALUES (
  'monthly-summary',
  'Samlet vagtoversigt',
  false,
  ARRAY[]::TEXT[],
  ARRAY[1]::INTEGER[],
  8,
  0,
  'Europe/Copenhagen',
  NOW(),
  NOW()
)
ON CONFLICT ("id") DO NOTHING;
