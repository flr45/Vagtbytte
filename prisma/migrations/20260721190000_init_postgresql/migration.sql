-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('BRANDFIGHTER', 'VC', 'ADMIN');

-- CreateEnum
CREATE TYPE "TransferStatus" AS ENUM ('AWAITING_RECEIVER', 'RECEIVER_ACCEPTED_AWAITING_VC', 'RECEIVER_REJECTED', 'VC_REJECTED', 'VC_APPROVED_ACTIVE', 'RETURN_AWAITING_ORIGINAL', 'RETURN_ACCEPTED_AWAITING_VC', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ExpectedEndMode" AS ENUM ('SPECIFIC_TIME', 'UNTIL_SHIFT_END');

-- CreateEnum
CREATE TYPE "ReturnRequestStatus" AS ENUM ('AWAITING_ORIGINAL', 'ORIGINAL_ACCEPTED_AWAITING_VC', 'ORIGINAL_REJECTED', 'VC_APPROVED_COMPLETED', 'VC_REJECTED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('TRANSFER_CREATED', 'TRANSFER_RECEIVER_ACCEPTED', 'TRANSFER_RECEIVER_REJECTED', 'TRANSFER_VC_APPROVED', 'TRANSFER_VC_REJECTED', 'TRANSFER_STARTED', 'TRANSFER_EXPECTED_END', 'RETURN_CREATED', 'RETURN_ORIGINAL_ACCEPTED', 'RETURN_ORIGINAL_REJECTED', 'RETURN_VC_APPROVED', 'RETURN_VC_REJECTED', 'TEST');

-- CreateEnum
CREATE TYPE "PushDeliveryStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'PERMANENT_FAILURE', 'NO_ACTIVE_DEVICE');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "employeeNumber" TEXT,
    "loginIdentifier" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastLoginAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShiftTransfer" (
    "id" TEXT NOT NULL,
    "transferNumber" TEXT NOT NULL,
    "giverUserId" TEXT NOT NULL,
    "receiverUserId" TEXT NOT NULL,
    "giverEmployeeNumberSnapshot" TEXT NOT NULL,
    "receiverEmployeeNumberSnapshot" TEXT NOT NULL,
    "giverNameSnapshot" TEXT NOT NULL,
    "receiverNameSnapshot" TEXT NOT NULL,
    "requestedStartAt" TIMESTAMP(3) NOT NULL,
    "expectedEndMode" "ExpectedEndMode" NOT NULL DEFAULT 'UNTIL_SHIFT_END',
    "expectedEndAt" TIMESTAMP(3),
    "comment" TEXT,
    "status" "TransferStatus" NOT NULL DEFAULT 'AWAITING_RECEIVER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "receiverRespondedAt" TIMESTAMP(3),
    "receiverResponseComment" TEXT,
    "vcDecidedAt" TIMESTAMP(3),
    "vcDecision" TEXT,
    "vcComment" TEXT,
    "activatedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "ShiftTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReturnRequest" (
    "id" TEXT NOT NULL,
    "returnNumber" TEXT NOT NULL,
    "transferId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "originalUserId" TEXT NOT NULL,
    "currentHolderUserId" TEXT NOT NULL,
    "originalNameSnapshot" TEXT NOT NULL,
    "originalEmployeeNumberSnapshot" TEXT NOT NULL,
    "currentHolderNameSnapshot" TEXT NOT NULL,
    "currentHolderEmployeeNumberSnapshot" TEXT NOT NULL,
    "requestedReturnAt" TIMESTAMP(3) NOT NULL,
    "comment" TEXT,
    "status" "ReturnRequestStatus" NOT NULL DEFAULT 'AWAITING_ORIGINAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "originalRespondedAt" TIMESTAMP(3),
    "originalAcceptedAt" TIMESTAMP(3),
    "originalResponseComment" TEXT,
    "vcDecidedAt" TIMESTAMP(3),
    "vcDecision" TEXT,
    "vcComment" TEXT,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "ReturnRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "recipientUserId" TEXT NOT NULL,
    "shiftTransferId" TEXT,
    "returnRequestId" TEXT,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "link" TEXT NOT NULL,
    "scheduledFor" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "openedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "uniqueKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PushSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "userAgent" TEXT,
    "deviceName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PushDelivery" (
    "id" TEXT NOT NULL,
    "notificationId" TEXT NOT NULL,
    "pushSubscriptionId" TEXT,
    "status" "PushDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "sentAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PushDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT,
    "actorRole" "UserRole",
    "action" TEXT NOT NULL,
    "targetUserId" TEXT,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoginAttempt" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "ipAddress" TEXT,
    "wasSuccessful" BOOLEAN NOT NULL,
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoginAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_employeeNumber_key" ON "User"("employeeNumber");

-- CreateIndex
CREATE UNIQUE INDEX "User_loginIdentifier_key" ON "User"("loginIdentifier");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "User_isActive_idx" ON "User"("isActive");

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

-- CreateIndex
CREATE UNIQUE INDEX "Notification_uniqueKey_key" ON "Notification"("uniqueKey");

-- CreateIndex
CREATE INDEX "Notification_recipientUserId_readAt_idx" ON "Notification"("recipientUserId", "readAt");

-- CreateIndex
CREATE INDEX "Notification_recipientUserId_createdAt_idx" ON "Notification"("recipientUserId", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_scheduledFor_idx" ON "Notification"("scheduledFor");

-- CreateIndex
CREATE INDEX "Notification_publishedAt_idx" ON "Notification"("publishedAt");

-- CreateIndex
CREATE INDEX "Notification_cancelledAt_idx" ON "Notification"("cancelledAt");

-- CreateIndex
CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");

-- CreateIndex
CREATE INDEX "PushSubscription_userId_idx" ON "PushSubscription"("userId");

-- CreateIndex
CREATE INDEX "PushSubscription_revokedAt_idx" ON "PushSubscription"("revokedAt");

-- CreateIndex
CREATE INDEX "PushDelivery_notificationId_idx" ON "PushDelivery"("notificationId");

-- CreateIndex
CREATE INDEX "PushDelivery_pushSubscriptionId_idx" ON "PushDelivery"("pushSubscriptionId");

-- CreateIndex
CREATE INDEX "PushDelivery_status_idx" ON "PushDelivery"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE INDEX "AuditLog_actorUserId_idx" ON "AuditLog"("actorUserId");

-- CreateIndex
CREATE INDEX "AuditLog_targetUserId_idx" ON "AuditLog"("targetUserId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "LoginAttempt_identifier_createdAt_idx" ON "LoginAttempt"("identifier", "createdAt");

-- CreateIndex
CREATE INDEX "LoginAttempt_ipAddress_createdAt_idx" ON "LoginAttempt"("ipAddress", "createdAt");

-- AddForeignKey
ALTER TABLE "ShiftTransfer" ADD CONSTRAINT "ShiftTransfer_giverUserId_fkey" FOREIGN KEY ("giverUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftTransfer" ADD CONSTRAINT "ShiftTransfer_receiverUserId_fkey" FOREIGN KEY ("receiverUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnRequest" ADD CONSTRAINT "ReturnRequest_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "ShiftTransfer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnRequest" ADD CONSTRAINT "ReturnRequest_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnRequest" ADD CONSTRAINT "ReturnRequest_originalUserId_fkey" FOREIGN KEY ("originalUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_shiftTransferId_fkey" FOREIGN KEY ("shiftTransferId") REFERENCES "ShiftTransfer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_returnRequestId_fkey" FOREIGN KEY ("returnRequestId") REFERENCES "ReturnRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushDelivery" ADD CONSTRAINT "PushDelivery_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "Notification"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushDelivery" ADD CONSTRAINT "PushDelivery_pushSubscriptionId_fkey" FOREIGN KEY ("pushSubscriptionId") REFERENCES "PushSubscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

