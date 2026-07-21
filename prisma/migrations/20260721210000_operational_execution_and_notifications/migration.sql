ALTER TYPE "TransferStatus" ADD VALUE IF NOT EXISTS 'VC_APPROVED_AWAITING_ACTIVATION';
ALTER TYPE "TransferStatus" ADD VALUE IF NOT EXISTS 'RETURN_APPROVED_AWAITING_EXECUTION';

ALTER TYPE "ReturnRequestStatus" ADD VALUE IF NOT EXISTS 'VC_APPROVED_AWAITING_EXECUTION';

ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'TRANSFER_ACTIVATION_REMINDER';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'TRANSFER_ACTIVATED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'RETURN_EXECUTION_REMINDER';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'RETURN_COMPLETED';

ALTER TABLE "ShiftTransfer"
  ADD COLUMN IF NOT EXISTS "activationConfirmedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "activationConfirmedByUserId" TEXT;

ALTER TABLE "ReturnRequest"
  ADD COLUMN IF NOT EXISTS "returnExecutionConfirmedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "returnExecutionConfirmedByUserId" TEXT;

ALTER TABLE "Notification"
  ADD COLUMN IF NOT EXISTS "dismissedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "ShiftTransfer_activationConfirmedByUserId_idx" ON "ShiftTransfer"("activationConfirmedByUserId");
CREATE INDEX IF NOT EXISTS "ReturnRequest_returnExecutionConfirmedByUserId_idx" ON "ReturnRequest"("returnExecutionConfirmedByUserId");
CREATE INDEX IF NOT EXISTS "Notification_dismissedAt_idx" ON "Notification"("dismissedAt");

-- Existing active production cases were already operationally active before this split.
-- They keep VC_APPROVED_ACTIVE so no current shift is accidentally moved back to awaiting execution.
