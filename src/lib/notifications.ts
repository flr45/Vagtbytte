import type { NotificationType, PrismaClient } from "@prisma/client";
import { createHash } from "crypto";
import webpush from "web-push";

export type NotificationRepo = Pick<
  PrismaClient,
  "notification" | "pushSubscription" | "pushDelivery" | "shiftTransfer" | "returnRequest"
>;

export type NotificationInput = {
  recipientUserId: string;
  shiftTransferId?: string;
  returnRequestId?: string;
  availabilityId?: string;
  type: NotificationType;
  title: string;
  body: string;
  link: string;
  uniqueKey: string;
  scheduledFor?: Date | null;
  publishNow?: boolean;
};

export async function createNotification(
  repo: NotificationRepo,
  input: NotificationInput,
  options: { sendPush?: boolean } = {}
) {
  const now = new Date();
  const existing = await repo.notification.findUnique({ where: { uniqueKey: input.uniqueKey } });
  if (existing) {
    return existing;
  }

  const notification = await repo.notification.create({
    data: {
      recipientUserId: input.recipientUserId,
      shiftTransferId: input.shiftTransferId,
      returnRequestId: input.returnRequestId,
      availabilityId: input.availabilityId,
      type: input.type,
      title: input.title,
      body: input.body,
      link: input.link,
      uniqueKey: input.uniqueKey,
      scheduledFor: input.scheduledFor ?? null,
      publishedAt: input.publishNow ?? !input.scheduledFor ? now : null
    }
  });

  if (notification.publishedAt && options.sendPush !== false) {
    await sendPushForNotification(repo, notification.id);
  }

  return notification;
}

export async function createNotifications(repo: NotificationRepo, inputs: NotificationInput[]) {
  for (const input of inputs) {
    await createNotification(repo, input);
  }
}

export type PushPayload = {
  notificationId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  title: string;
  body: string;
  link: string;
  tag?: string;
  urgency?: "very-low" | "low" | "normal" | "high";
};

type PushSender = (input: PushPayload) => Promise<void>;

let pushSenderForTests: PushSender | null = null;

export function setPushSenderForTests(sender: PushSender | null) {
  pushSenderForTests = sender;
}

export function endpointHost(endpoint: string) {
  try {
    return new URL(endpoint).host;
  } catch {
    return "ugyldigt-endpoint";
  }
}

export function publicKeyFingerprint(publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) {
  return publicKey ? createHash("sha256").update(publicKey).digest("hex").slice(0, 16) : "mangler";
}

export function webPushErrorDetails(error: unknown, endpoint: string) {
  const maybeError = error as {
    statusCode?: number;
    headers?: unknown;
    body?: unknown;
    response?: { text?: unknown; body?: unknown };
    message?: string;
    stack?: string;
  };
  const statusCode = maybeError?.statusCode ?? null;
  const details = {
    statusCode,
    headers: maybeError?.headers ?? null,
    body: stringifyErrorValue(maybeError?.body),
    endpointHost: endpointHost(endpoint),
    responseText: stringifyErrorValue(maybeError?.response?.text ?? maybeError?.response?.body ?? maybeError?.body),
    stacktrace: maybeError?.stack ?? null,
    originalErrorMessage: error instanceof Error ? error.message : String(error),
    vapid:
      statusCode === 401 || statusCode === 403
        ? {
            subject: process.env.VAPID_SUBJECT ?? "mangler",
            endpointHost: endpointHost(endpoint),
            publicKeyFingerprint: publicKeyFingerprint()
          }
        : undefined
  };

  return JSON.stringify(details, null, 2);
}

export function logWebPushError(error: unknown, endpoint: string) {
  const details = webPushErrorDetails(error, endpoint);
  console.error("WEB_PUSH_DELIVERY_FAILED", details);
  if (isPermanentPushError(error)) {
    console.error("WEB_PUSH_SUBSCRIPTION_REVOKED", {
      reason: `Permanent pushfejl HTTP ${(error as { statusCode?: number })?.statusCode}`,
      endpointHost: endpointHost(endpoint)
    });
  }
  return details;
}

function stringifyErrorValue(value: unknown) {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value === "string") {
    return value;
  }
  if (Buffer.isBuffer(value)) {
    return value.toString("utf8");
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export async function sendPushForNotification(
  repo: NotificationRepo,
  notificationId: string,
  options: { endpoint?: string } = {}
) {
  const notification = await repo.notification.findUnique({
    where: { id: notificationId },
    include: { recipient: { include: { pushSubscriptions: true } } }
  });

  if (!notification || notification.cancelledAt || !notification.publishedAt) {
    return { sent: 0, failed: 0 };
  }

  const subscriptions = notification.recipient.pushSubscriptions.filter(
    (sub) => !sub.revokedAt && (!options.endpoint || sub.endpoint === options.endpoint)
  );

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
        notificationId: notification.id,
        endpoint: subscription.endpoint,
        p256dh: subscription.p256dh,
        auth: subscription.auth,
        title: notification.title,
        body: notification.body,
        link: notification.link,
        tag: notification.uniqueKey,
        urgency: pushUrgencyForNotificationType(notification.type)
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
      const message = logWebPushError(error, subscription.endpoint);
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

  if (notification.type === "TRANSFER_ACTIVATION_REMINDER") {
    return notification.shiftTransfer.status !== "VC_APPROVED_AWAITING_ACTIVATION";
  }

  if (notification.type === "RETURN_EXECUTION_REMINDER") {
    if (!notification.returnRequestId) {
      return (
        notification.shiftTransfer.status !== "VC_APPROVED_ACTIVE" ||
        notification.shiftTransfer.expectedEndMode !== "SPECIFIC_TIME" ||
        !notification.shiftTransfer.expectedEndAt
      );
    }

    const request = notification.returnRequestId
      ? await repo.returnRequest.findUnique({ where: { id: notification.returnRequestId }, include: { transfer: true } })
      : null;
    return (
      !request ||
      request.status !== "VC_APPROVED_AWAITING_EXECUTION" ||
      request.transfer.status !== "RETURN_APPROVED_AWAITING_EXECUTION"
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

export function pushUrgencyForNotificationType(type: NotificationType): "normal" | "high" {
  if (type === "ALARM_MESSAGE") {
    return "high";
  }
  const highUrgencyTypes: NotificationType[] = [
    "TRANSFER_CREATED",
    "TRANSFER_RECEIVER_ACCEPTED",
    "RETURN_CREATED",
    "RETURN_ORIGINAL_ACCEPTED",
    "TRANSFER_ACTIVATION_REMINDER",
    "RETURN_EXECUTION_REMINDER",
    "AVAILABILITY_ASSIGNED"
  ];
  return highUrgencyTypes.includes(type) ? "high" : "normal";
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
      notificationId: input.notificationId,
      title: input.title,
      body: input.body,
      link: input.link,
      tag: input.tag,
      urgency: input.urgency ?? "normal"
    }),
    {
      TTL: 60 * 60,
      urgency: input.urgency ?? "normal"
    }
  );
}
