-- CreateTable
CREATE TABLE "ShiftTransfer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "transferNumber" TEXT NOT NULL,
    "giverUserId" TEXT NOT NULL,
    "receiverUserId" TEXT NOT NULL,
    "giverEmployeeNumberSnapshot" TEXT NOT NULL,
    "receiverEmployeeNumberSnapshot" TEXT NOT NULL,
    "giverNameSnapshot" TEXT NOT NULL,
    "receiverNameSnapshot" TEXT NOT NULL,
    "requestedStartAt" DATETIME NOT NULL,
    "expectedEndAt" DATETIME,
    "comment" TEXT,
    "status" TEXT NOT NULL DEFAULT 'AWAITING_RECEIVER',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "receiverRespondedAt" DATETIME,
    "receiverResponseComment" TEXT,
    CONSTRAINT "ShiftTransfer_giverUserId_fkey" FOREIGN KEY ("giverUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ShiftTransfer_receiverUserId_fkey" FOREIGN KEY ("receiverUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "ShiftTransfer_transferNumber_key" ON "ShiftTransfer"("transferNumber");

-- CreateIndex
CREATE INDEX "ShiftTransfer_giverUserId_idx" ON "ShiftTransfer"("giverUserId");

-- CreateIndex
CREATE INDEX "ShiftTransfer_receiverUserId_idx" ON "ShiftTransfer"("receiverUserId");

-- CreateIndex
CREATE INDEX "ShiftTransfer_status_idx" ON "ShiftTransfer"("status");

-- CreateIndex
CREATE INDEX "ShiftTransfer_createdAt_idx" ON "ShiftTransfer"("createdAt");
