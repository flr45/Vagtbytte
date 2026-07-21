ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'TRANSFER_CANCELLED';

ALTER TABLE "ShiftTransfer"
  ADD COLUMN IF NOT EXISTS "cancelledAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "cancelledByUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "cancellationReason" TEXT;

CREATE INDEX IF NOT EXISTS "ShiftTransfer_cancelledByUserId_idx" ON "ShiftTransfer"("cancelledByUserId");

-- Cancellation is stored as a status transition to preserve existing production history.
-- No existing transfers are changed by this migration.
