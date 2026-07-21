ALTER TABLE "ShiftTransfer"
  ADD COLUMN IF NOT EXISTS "returnExecutionConfirmedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "returnExecutionConfirmedByUserId" TEXT;

CREATE INDEX IF NOT EXISTS "ShiftTransfer_returnExecutionConfirmedByUserId_idx" ON "ShiftTransfer"("returnExecutionConfirmedByUserId");
