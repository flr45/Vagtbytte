ALTER TABLE "ShiftTransfer"
  ADD COLUMN IF NOT EXISTS "calculatedShiftEndAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "ShiftTransfer_calculatedShiftEndAt_idx" ON "ShiftTransfer"("calculatedShiftEndAt");
