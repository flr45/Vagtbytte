CREATE TYPE "AlarmStatus" AS ENUM ('ACTIVE', 'CLOSED');

CREATE TABLE "Alarm" (
    "id" TEXT NOT NULL,
    "status" "AlarmStatus" NOT NULL DEFAULT 'ACTIVE',
    "source" TEXT NOT NULL DEFAULT 'SMS',
    "senderNumber" TEXT NOT NULL,
    "openedAt" TIMESTAMP(3) NOT NULL,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Alarm_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AlarmMessage" (
    "id" TEXT NOT NULL,
    "alarmId" TEXT NOT NULL,
    "sequenceNumber" INTEGER NOT NULL,
    "senderNumber" TEXT NOT NULL,
    "rawMessage" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "sourceMessageId" TEXT,
    "deduplicationKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AlarmMessage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AlarmMessage_deduplicationKey_key" ON "AlarmMessage"("deduplicationKey");
CREATE UNIQUE INDEX "AlarmMessage_alarmId_sequenceNumber_key" ON "AlarmMessage"("alarmId", "sequenceNumber");
CREATE INDEX "Alarm_status_openedAt_idx" ON "Alarm"("status", "openedAt");
CREATE INDEX "AlarmMessage_alarmId_receivedAt_idx" ON "AlarmMessage"("alarmId", "receivedAt");
CREATE INDEX "AlarmMessage_senderNumber_receivedAt_idx" ON "AlarmMessage"("senderNumber", "receivedAt");

ALTER TABLE "AlarmMessage"
ADD CONSTRAINT "AlarmMessage_alarmId_fkey"
FOREIGN KEY ("alarmId") REFERENCES "Alarm"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
