-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "recipientUserId" TEXT NOT NULL,
    "shiftTransferId" TEXT,
    "returnRequestId" TEXT,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "link" TEXT NOT NULL,
    "scheduledFor" DATETIME,
    "publishedAt" DATETIME,
    "readAt" DATETIME,
    "openedAt" DATETIME,
    "cancelledAt" DATETIME,
    "uniqueKey" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Notification_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Notification_shiftTransferId_fkey" FOREIGN KEY ("shiftTransferId") REFERENCES "ShiftTransfer" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Notification_returnRequestId_fkey" FOREIGN KEY ("returnRequestId") REFERENCES "ReturnRequest" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PushSubscription" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "userAgent" TEXT,
    "deviceName" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "lastUsedAt" DATETIME,
    "revokedAt" DATETIME,
    CONSTRAINT "PushSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PushDelivery" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "notificationId" TEXT NOT NULL,
    "pushSubscriptionId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "sentAt" DATETIME,
    "failedAt" DATETIME,
    "lastError" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PushDelivery_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "Notification" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PushDelivery_pushSubscriptionId_fkey" FOREIGN KEY ("pushSubscriptionId") REFERENCES "PushSubscription" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

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
