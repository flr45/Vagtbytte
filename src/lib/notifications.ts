import type { NotificationType, PrismaClient } from "@prisma/client";
import webpush from "web-push";

export type NotificationRepo = Pick<
  PrismaClient,
  "notification" | "pushSubscription" | "pushDelivery" | "shiftTransfer" | "returnRequest"
>;

export type NotificationInput = {
  recipientUserId: string;
  shiftTransferId?: string;
  returnRequestId?: string;
  type: NotificationType;
  title: string;
  body: string;
  link: string;
  uniqueKey: string;
  scheduledFor?: Date | null;
  publishNow?: boolean;
};

export async function createNotification(repo: NotificationRepo, input: NotificationInput) {
  const now = new Date();
  return repo.notification.upsert({
    where: { uniqueKey: input.uniqueKey },
    update: {},
    create: {
      recipientUserId: input.recipientUserId,
      shiftTransferId: input.shiftTransferId,
      returnRequestId: input.returnRequestId,
      type: input.type,
      title: input.title,
      body: input.body,
      link: input.link,
      uniqueKey: input.uniqueKey,
      scheduledFor: input.scheduledFor ?? null,
      publishedAt: input.publishNow ?? !input.scheduledFor ? now : null
    }
  });
}

export async function createNotifications(repo: NotificationRepo, inputs: NotificationInput[]) {
  for (const input of inputs) {
    await createNotification(repo, input);
  }
}

export function sanitizePushError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.slice(0, 240).replace(/[A-Za-z0-9_-]{28,}/g, "[skjult]");
}

export type PushPayload = {
  endpoint: string;
  p256dh: string;
  auth: string;
  title: string;
  body: string;
  link: string;
};

type PushSender = (input: PushPayload) => Promise<void>;

let pushSenderForTests: PushSender | null = null;

export function setPushSenderForTests(sender: PushSender | null) {
  pushSenderForTests = sender;
}

export async function sendPushForNotification(repo: NotificationRepo, notificationId: string) {
  const notification = await repo.notification.findUnique({
    where: { id: notificationId },
    include: { recipient: { include: { pushSubscriptions: true } } }
  });

  if (!notification || notification.cancelledAt || !notification.publishedAt) {
    return { sent: 0, failed: 0 };
  }

  const subscriptions = notification.recipient.pushSubscriptions.filter((sub) => !sub.revokedAt);

  if (subscriptions.length === 0) {
    await repo.pushDelivery.create({
      data: {
        notificationId: notification.id,
        status: "NO_ACTIVE_DEVICE",
        attemptCount: 1,
        failedAt: new Date(),
        lastError: "Ingen aktiv push-enhed"
      }
    });
    return { sent: 0, failed: 0 };
  }

  let sent = 0;
  let failed = 0;

  for (const subscription of subscriptions) {
    try {
      await pushSender({
        endpoint: subscription.endpoint,
        p256dh: subscription.p256dh,
        auth: subscription.auth,
        title: notification.title,
        body: notification.body,
        link: notification.link
      });
      sent += 1;
      await repo.pushDelivery.create({
        data: {
          notificationId: notification.id,
          pushSubscriptionId: subscription.id,
          status: "SENT",
          attemptCount: 1,
          sentAt: new Date()
        }
      });
      await repo.pushSubscription.update({
        where: { id: subscription.id },
        data: { lastUsedAt: new Date() }
      });
    } catch (error) {
      failed += 1;
      const message = sanitizePushError(error);
      const permanent = isPermanentPushError(error);
      await repo.pushDelivery.create({
        data: {
          notificationId: notification.id,
          pushSubscriptionId: subscription.id,
          status: permanent ? "PERMANENT_FAILURE" : "FAILED",
          attemptCount: 1,
          failedAt: new Date(),
          lastError: message
        }
      });
      if (permanent) {
        await repo.pushSubscription.update({
          where: { id: subscription.id },
          data: { revokedAt: new Date() }
        });
      }
    }
  }

  return { sent, failed };
}

export async function publishDueNotifications(repo: NotificationRepo, now = new Date()) {
  const dueNotifications = await repo.notification.findMany({
    where: {
      publishedAt: null,
      cancelledAt: null,
      scheduledFor: { lte: now }
    },
    orderBy: { scheduledFor: "asc" },
    take: 100
  });

  let published = 0;
  let cancelled = 0;

  for (const notification of dueNotifications) {
    const shouldCancel = await shouldCancelScheduledNotification(repo, notification.id);
    if (shouldCancel) {
      await repo.notification.update({
        where: { id: notification.id },
        data: { cancelledAt: now }
      });
      cancelled += 1;
      continue;
    }

    const claimed = await repo.notification.updateMany({
      where: { id: notification.id, publishedAt: null, cancelledAt: null },
      data: { publishedAt: now }
    });
    if (claimed.count !== 1) {
      continue;
    }
    await sendPushForNotification(repo, notification.id);
    published += 1;
  }

  return { published, cancelled };
}

export async function cancelFutureTransferNotifications(repo: NotificationRepo, shiftTransferId: string) {
  await repo.notification.updateMany({
    where: {
      shiftTransferId,
      publishedAt: null,
      cancelledAt: null
    },
    data: { cancelledAt: new Date() }
  });
}

export function canReadNotification(input: { userId: string; recipientUserId: string }) {
  return input.userId === input.recipientUserId;
}

export function canManagePushSubscription(input: { userId: string; subscriptionUserId: string }) {
  return input.userId === input.subscriptionUserId;
}

export function markRead<T extends { readAt: Date | null }>(notification: T, now = new Date()) {
  return { ...notification, readAt: notification.readAt ?? now };
}

export function markAllRead<T extends { readAt: Date | null }>(notifications: T[], now = new Date()) {
  return notifications.map((notification) => markRead(notification, now));
}

async function shouldCancelScheduledNotification(repo: NotificationRepo, notificationId: string) {
  const notification = await repo.notification.findUnique({
    where: { id: notificationId },
    include: { shiftTransfer: true }
  });

  if (!notification?.shiftTransfer) {
    return false;
  }

  if (notification.type === "TRANSFER_EXPECTED_END") {
    return (
      notification.shiftTransfer.status === "COMPLETED" ||
      notification.shiftTransfer.expectedEndMode === "UNTIL_SHIFT_END" ||
      !notification.shiftTransfer.expectedEndAt
    );
  }

  if (notification.type === "TRANSFER_STARTED") {
    return ["COMPLETED", "VC_REJECTED", "RECEIVER_REJECTED", "CANCELLED"].includes(
      notification.shiftTransfer.status
    );
  }

  return false;
}

export function isPermanentPushError(error: unknown) {
  const statusCode = (error as { statusCode?: number })?.statusCode;
  return statusCode === 404 || statusCode === 410;
}

function configureVapid() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;

  if (!publicKey || !privateKey || !subject) {
    throw new Error("VAPID-nøgler mangler");
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
}

async function pushSender(input: PushPayload) {
  if (pushSenderForTests) {
    await pushSenderForTests(input);
    return;
  }

  if (process.env.NOTIFICATIONS_DISABLE_PUSH === "true") {
    return;
  }

  configureVapid();

  await webpush.sendNotification(
    {
      endpoint: input.endpoint,
      keys: {
        p256dh: input.p256dh,
        auth: input.auth
      }
    },
    JSON.stringify({
      title: input.title,
      body: input.body,
      link: input.link
    })
  );
}
