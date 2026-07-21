CREATE TYPE "AvailabilityStatus" AS ENUM ('AVAILABLE', 'ASSIGNED', 'ACKNOWLEDGED', 'CANCELLED', 'EXPIRED');

ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'AVAILABILITY_ASSIGNED';

CREATE TABLE "Availability" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "availableFrom" TIMESTAMP(3) NOT NULL,
    "availableUntil" TIMESTAMP(3) NOT NULL,
    "status" "AvailabilityStatus" NOT NULL DEFAULT 'AVAILABLE',
    "assignedBy" TEXT,
    "assignedAt" TIMESTAMP(3),
    "acknowledgedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "expiredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Availability_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Notification" ADD COLUMN "availabilityId" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN "availabilityId" TEXT;

CREATE INDEX "Availability_status_idx" ON "Availability"("status");
CREATE INDEX "Availability_availableUntil_idx" ON "Availability"("availableUntil");
CREATE INDEX "Availability_userId_idx" ON "Availability"("userId");
CREATE INDEX "Availability_assignedBy_idx" ON "Availability"("assignedBy");
CREATE UNIQUE INDEX "Availability_one_available_per_user_idx"
ON "Availability"("userId")
WHERE "status" = 'AVAILABLE';
CREATE INDEX "Notification_availabilityId_idx" ON "Notification"("availabilityId");
CREATE INDEX "AuditLog_availabilityId_idx" ON "AuditLog"("availabilityId");

ALTER TABLE "Availability"
ADD CONSTRAINT "Availability_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Availability"
ADD CONSTRAINT "Availability_assignedBy_fkey"
FOREIGN KEY ("assignedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Notification"
ADD CONSTRAINT "Notification_availabilityId_fkey"
FOREIGN KEY ("availabilityId") REFERENCES "Availability"("id") ON DELETE CASCADE ON UPDATE CASCADE;
