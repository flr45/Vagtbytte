ALTER TABLE "AuditLog"
  ADD COLUMN IF NOT EXISTS "shiftTransferId" TEXT,
  ADD COLUMN IF NOT EXISTS "returnRequestId" TEXT;

CREATE INDEX IF NOT EXISTS "AuditLog_shiftTransferId_idx" ON "AuditLog"("shiftTransferId");
CREATE INDEX IF NOT EXISTS "AuditLog_returnRequestId_idx" ON "AuditLog"("returnRequestId");
