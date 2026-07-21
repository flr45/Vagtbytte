-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ShiftTransfer" (
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
    "vcDecidedAt" DATETIME,
    "vcDecision" TEXT,
    "vcComment" TEXT,
    "activatedAt" DATETIME,
    "completedAt" DATETIME,
    CONSTRAINT "ShiftTransfer_giverUserId_fkey" FOREIGN KEY ("giverUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ShiftTransfer_receiverUserId_fkey" FOREIGN KEY ("receiverUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_ShiftTransfer" ("comment", "createdAt", "expectedEndAt", "giverEmployeeNumberSnapshot", "giverNameSnapshot", "giverUserId", "id", "receiverEmployeeNumberSnapshot", "receiverNameSnapshot", "receiverRespondedAt", "receiverResponseComment", "receiverUserId", "requestedStartAt", "status", "transferNumber", "updatedAt") SELECT "comment", "createdAt", "expectedEndAt", "giverEmployeeNumberSnapshot", "giverNameSnapshot", "giverUserId", "id", "receiverEmployeeNumberSnapshot", "receiverNameSnapshot", "receiverRespondedAt", "receiverResponseComment", "receiverUserId", "requestedStartAt", "status", "transferNumber", "updatedAt" FROM "ShiftTransfer";
DROP TABLE "ShiftTransfer";
ALTER TABLE "new_ShiftTransfer" RENAME TO "ShiftTransfer";
CREATE UNIQUE INDEX "ShiftTransfer_transferNumber_key" ON "ShiftTransfer"("transferNumber");
CREATE INDEX "ShiftTransfer_giverUserId_idx" ON "ShiftTransfer"("giverUserId");
CREATE INDEX "ShiftTransfer_receiverUserId_idx" ON "ShiftTransfer"("receiverUserId");
CREATE INDEX "ShiftTransfer_status_idx" ON "ShiftTransfer"("status");
CREATE INDEX "ShiftTransfer_createdAt_idx" ON "ShiftTransfer"("createdAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateTable
CREATE TABLE "ReturnRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "returnNumber" TEXT NOT NULL,
    "transferId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "originalUserId" TEXT NOT NULL,
    "currentHolderUserId" TEXT NOT NULL,
    "originalNameSnapshot" TEXT NOT NULL,
    "originalEmployeeNumberSnapshot" TEXT NOT NULL,
    "currentHolderNameSnapshot" TEXT NOT NULL,
    "currentHolderEmployeeNumberSnapshot" TEXT NOT NULL,
    "requestedReturnAt" DATETIME NOT NULL,
    "comment" TEXT,
    "status" TEXT NOT NULL DEFAULT 'AWAITING_ORIGINAL',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "originalRespondedAt" DATETIME,
    "originalAcceptedAt" DATETIME,
    "originalResponseComment" TEXT,
    "vcDecidedAt" DATETIME,
    "vcDecision" TEXT,
    "vcComment" TEXT,
    "completedAt" DATETIME,
    CONSTRAINT "ReturnRequest_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "ShiftTransfer" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ReturnRequest_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ReturnRequest_originalUserId_fkey" FOREIGN KEY ("originalUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "ReturnRequest_returnNumber_key" ON "ReturnRequest"("returnNumber");

-- CreateIndex
CREATE INDEX "ReturnRequest_transferId_idx" ON "ReturnRequest"("transferId");

-- CreateIndex
CREATE INDEX "ReturnRequest_createdByUserId_idx" ON "ReturnRequest"("createdByUserId");

-- CreateIndex
CREATE INDEX "ReturnRequest_originalUserId_idx" ON "ReturnRequest"("originalUserId");

-- CreateIndex
CREATE INDEX "ReturnRequest_status_idx" ON "ReturnRequest"("status");

-- CreateIndex
CREATE INDEX "ReturnRequest_createdAt_idx" ON "ReturnRequest"("createdAt");
