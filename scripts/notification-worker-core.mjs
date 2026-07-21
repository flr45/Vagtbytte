import { createHash } from "crypto";
import webpush from "web-push";

function isPermanentPushError(error) {
  return error && (error.statusCode === 404 || error.statusCode === 410);
}

function endpointHost(endpoint) {
  try {
    return new URL(endpoint).host;
  } catch {
    return "ugyldigt-endpoint";
  }
}

function publicKeyFingerprint(publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) {
  return publicKey ? createHash("sha256").update(publicKey).digest("hex").slice(0, 16) : "mangler";
}

function stringifyErrorValue(value) {
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

function webPushErrorDetails(error, endpoint) {
  const statusCode = error?.statusCode ?? null;
  const details = {
    statusCode,
    headers: error?.headers ?? null,
    body: stringifyErrorValue(error?.body),
    endpointHost: endpointHost(endpoint),
    responseText: stringifyErrorValue(error?.response?.text ?? error?.response?.body ?? error?.body),
    stacktrace: error?.stack ?? null,
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

function logWebPushError(error, endpoint) {
  const details = webPushErrorDetails(error, endpoint);
  console.error("WEB_PUSH_DELIVERY_FAILED", details);
  if (isPermanentPushError(error)) {
    console.error("WEB_PUSH_SUBSCRIPTION_REVOKED", {
      reason: `Permanent pushfejl HTTP ${error?.statusCode}`,
      endpointHost: endpointHost(endpoint)
    });
  }
  return details;
}

async function pushSender(input) {
  if (process.env.NOTIFICATIONS_DISABLE_PUSH === "true") {
    return;
  }

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;

  if (!publicKey || !privateKey || !subject) {
    throw new Error("VAPID-nøgler mangler");
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
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
    { TTL: 60 * 60, urgency: input.urgency ?? "normal" }
  );
}

function pushUrgencyForNotificationType(type) {
  return [
    "TRANSFER_CREATED",
    "TRANSFER_RECEIVER_ACCEPTED",
    "RETURN_CREATED",
    "RETURN_ORIGINAL_ACCEPTED",
    "TRANSFER_ACTIVATION_REMINDER",
    "RETURN_EXECUTION_REMINDER"
  ].includes(type)
    ? "high"
    : "normal";
}

async function shouldCancelScheduledNotification(prisma, notificationId) {
  const notification = await prisma.notification.findUnique({
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
      ? await prisma.returnRequest.findUnique({
          where: { id: notification.returnRequestId },
          include: { transfer: true }
        })
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

async function sendPushForNotification(prisma, notificationId) {
  const notification = await prisma.notification.findUnique({
    where: { id: notificationId },
    include: { recipient: { include: { pushSubscriptions: true } } }
  });

  if (!notification || notification.cancelledAt || !notification.publishedAt) {
    return;
  }

  const subscriptions = notification.recipient.pushSubscriptions.filter((sub) => !sub.revokedAt);
  if (subscriptions.length === 0) {
    await prisma.pushDelivery.create({
      data: {
        notificationId: notification.id,
        status: "NO_ACTIVE_DEVICE",
        attemptCount: 1,
        failedAt: new Date(),
        lastError: "Ingen aktiv push-enhed"
      }
    });
    return;
  }

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
      await prisma.pushDelivery.create({
        data: {
          notificationId: notification.id,
          pushSubscriptionId: subscription.id,
          status: "SENT",
          attemptCount: 1,
          sentAt: new Date()
        }
      });
    } catch (error) {
      const permanent = isPermanentPushError(error);
      const details = logWebPushError(error, subscription.endpoint);
      await prisma.pushDelivery.create({
        data: {
          notificationId: notification.id,
          pushSubscriptionId: subscription.id,
          status: permanent ? "PERMANENT_FAILURE" : "FAILED",
          attemptCount: 1,
          failedAt: new Date(),
          lastError: details
        }
      });
      if (permanent) {
        await prisma.pushSubscription.update({
          where: { id: subscription.id },
          data: { revokedAt: new Date() }
        });
      }
    }
  }
}

async function createPublishedNotification(prisma, input, now) {
  const existing = await prisma.notification.findUnique({ where: { uniqueKey: input.uniqueKey } });
  if (existing) {
    return existing;
  }

  const notification = await prisma.notification.create({
    data: {
      recipientUserId: input.recipientUserId,
      shiftTransferId: input.shiftTransferId,
      type: input.type,
      title: input.title,
      body: input.body,
      link: input.link,
      uniqueKey: input.uniqueKey,
      publishedAt: now
    }
  });
  await sendPushForNotification(prisma, notification.id);
  return notification;
}

export async function completeDueShiftEndTransfers(prisma, now = new Date()) {
  const transfers = await prisma.shiftTransfer.findMany({
    where: {
      status: "VC_APPROVED_ACTIVE",
      expectedEndMode: "UNTIL_SHIFT_END",
      calculatedShiftEndAt: { lte: now }
    },
    take: 100
  });

  let completed = 0;
  for (const transfer of transfers) {
    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.shiftTransfer.updateMany({
        where: {
          id: transfer.id,
          status: "VC_APPROVED_ACTIVE",
          expectedEndMode: "UNTIL_SHIFT_END",
          completedAt: null
        },
        data: {
          status: "COMPLETED",
          completedAt: transfer.calculatedShiftEndAt ?? now
        }
      });

      if (updated.count !== 1) {
        return false;
      }

      await tx.notification.updateMany({
        where: { shiftTransferId: transfer.id, publishedAt: null, cancelledAt: null },
        data: { cancelledAt: now }
      });
      await tx.auditLog.create({
        data: {
          action: "SHIFT_END_TRANSFER_COMPLETED",
          targetUserId: transfer.receiverUserId,
          shiftTransferId: transfer.id,
          description: `Vagtoverdragelse ${transfer.transferNumber} blev afsluttet ved vagtens slutning`
        }
      });
      return true;
    });

    if (!result) {
      continue;
    }

    completed += 1;
    for (const recipientUserId of [transfer.giverUserId, transfer.receiverUserId]) {
      await createPublishedNotification(
        prisma,
        {
          recipientUserId,
          shiftTransferId: transfer.id,
          type: "RETURN_COMPLETED",
          title: "Vagtoverdragelsen er afsluttet ved vagtens slutning",
          body: "Vagtoverdragelsen er automatisk afsluttet ved næste faste vagtskifte.",
          link: `/brandmand/anmodninger/${transfer.id}`,
          uniqueKey: `transfer:${transfer.id}:shift-end-completed:${recipientUserId}`
        },
        now
      );
    }
  }

  return { completed };
}

export async function publishDueNotifications(prisma, now = new Date()) {
  const shiftEnd = await completeDueShiftEndTransfers(prisma, now);
  const dueNotifications = await prisma.notification.findMany({
    where: { publishedAt: null, cancelledAt: null, scheduledFor: { lte: now } },
    orderBy: { scheduledFor: "asc" },
    take: 100
  });

  let published = 0;
  let cancelled = 0;

  for (const notification of dueNotifications) {
    if (await shouldCancelScheduledNotification(prisma, notification.id)) {
      await prisma.notification.update({ where: { id: notification.id }, data: { cancelledAt: now } });
      cancelled += 1;
      continue;
    }

    const claimed = await prisma.notification.updateMany({
      where: { id: notification.id, publishedAt: null, cancelledAt: null },
      data: { publishedAt: now }
    });
    if (claimed.count !== 1) {
      continue;
    }
    await sendPushForNotification(prisma, notification.id);
    published += 1;
  }

  return { published, cancelled, completedShiftEndTransfers: shiftEnd.completed };
}
