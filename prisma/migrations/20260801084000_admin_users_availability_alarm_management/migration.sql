ALTER TABLE "User"
ADD COLUMN IF NOT EXISTS "stationCode" TEXT,
ADD COLUMN IF NOT EXISTS "hasAdminAccess" BOOLEAN NOT NULL DEFAULT false;

UPDATE "User"
SET "stationCode" = "alarmStations"[1]
WHERE "stationCode" IS NULL
  AND cardinality("alarmStations") > 0;

CREATE INDEX IF NOT EXISTS "User_stationCode_idx" ON "User"("stationCode");
CREATE INDEX IF NOT EXISTS "User_hasAdminAccess_idx" ON "User"("hasAdminAccess");

CREATE TABLE IF NOT EXISTS "AlarmStatistic" (
    "id" TEXT NOT NULL,
    "alarmId" TEXT NOT NULL,
    "stationCode" TEXT,
    "openedAt" TIMESTAMP(3) NOT NULL,
    "lastMessageAt" TIMESTAMP(3) NOT NULL,
    "messageCount" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AlarmStatistic_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AlarmStatistic_alarmId_key" ON "AlarmStatistic"("alarmId");
CREATE INDEX IF NOT EXISTS "AlarmStatistic_openedAt_idx" ON "AlarmStatistic"("openedAt");
CREATE INDEX IF NOT EXISTS "AlarmStatistic_stationCode_openedAt_idx" ON "AlarmStatistic"("stationCode", "openedAt");

INSERT INTO "AlarmStatistic" (
  "id",
  "alarmId",
  "stationCode",
  "openedAt",
  "lastMessageAt",
  "messageCount",
  "createdAt",
  "updatedAt"
)
SELECT
  'alarmstat-' || a."id",
  a."id",
  a."stationCode",
  a."openedAt",
  COALESCE(MAX(m."receivedAt"), a."openedAt"),
  GREATEST(COUNT(m."id")::INTEGER, 1),
  NOW(),
  NOW()
FROM "Alarm" a
LEFT JOIN "AlarmMessage" m ON m."alarmId" = a."id"
GROUP BY a."id", a."stationCode", a."openedAt"
ON CONFLICT ("alarmId") DO NOTHING;

DELETE FROM "Alarm"
WHERE "id" IN (
  SELECT "id"
  FROM "Alarm"
  ORDER BY "openedAt" DESC, "createdAt" DESC
  OFFSET 5
);

UPDATE "Availability"
SET
  "status" = 'ACKNOWLEDGED'::"AvailabilityStatus",
  "acknowledgedAt" = COALESCE("acknowledgedAt", "assignedAt", NOW())
WHERE "status" = 'ASSIGNED'::"AvailabilityStatus";
