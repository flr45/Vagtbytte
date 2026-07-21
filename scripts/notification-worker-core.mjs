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

function calculateCopenhagenShiftEnd(startAt) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Copenhagen",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
  const parts = Object.fromEntries(formatter.formatToParts(startAt).map((part) => [part.type, part.value]));
  const year = Number(parts.year);
  const month = Number(parts.month);
  const day = Number(parts.day);
  const hour = Number(parts.hour);
  const minute = Number(parts.minute);
  const localMinutes = hour * 60 + minute;

  if (localMinutes < 7 * 60) {
    return parseCopenhagenLocalDateTime(parts.year, parts.month, parts.day, "07", "00");
  }
  if (localMinutes < 15 * 60) {
    return parseCopenhagenLocalDateTime(parts.year, parts.month, parts.day, "15", "00");
  }
  if (localMinutes < 23 * 60) {
    return parseCopenhagenLocalDateTime(parts.year, parts.month, parts.day, "23", "00");
  }

  const nextDay = new Date(Date.UTC(year, month - 1, day + 1));
  return parseCopenhagenLocalDateTime(
    String(nextDay.getUTCFullYear()).padStart(4, "0"),
    String(nextDay.getUTCMonth() + 1).padStart(2, "0"),
    String(nextDay.getUTCDate()).padStart(2, "0"),
    "07",
    "00"
  );
}

function parseCopenhagenLocalDateTime(year, month, day, hour, minute) {
  const wanted = {
    year: Number(year),
    month: Number(month),
    day: Number(day),
    hour: Number(hour),
    minute: Number(minute)
  };
  const localAsUtc = Date.UTC(wanted.year, wanted.month - 1, wanted.day, wanted.hour, wanted.minute);
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Copenhagen",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });

  for (let offsetMinutes = -180; offsetMinutes <= 180; offsetMinutes += 15) {
    const candidate = new Date(localAsUtc - offsetMinutes * 60 * 1000);
    const parts = Object.fromEntries(formatter.formatToParts(candidate).map((part) => [part.type, part.value]));
    if (
      Number(parts.year) === wanted.year &&
      Number(parts.month) === wanted.month &&
      Number(parts.day) === wanted.day &&
      Number(parts.hour) === wanted.hour &&
      Number(parts.minute) === wanted.minute
    ) {
      return candidate;
    }
  }

  throw new Error("Kunne ikke beregne vagtslut i Europe/Copenhagen.");
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
  const activeShiftEndStatuses = ["VC_APPROVED_AWAITING_ACTIVATION", "VC_APPROVED_ACTIVE"];
  let backfilled = 0;
  const completedByStatus = {
    VC_APPROVED_ACTIVE: 0,
    VC_APPROVED_AWAITING_ACTIVATION: 0
  };
  const errors = [];

  const missingCalculatedShiftEnds = await prisma.shiftTransfer.findMany({
    where: {
      status: { in: activeShiftEndStatuses },
      expectedEndMode: "UNTIL_SHIFT_END",
      calculatedShiftEndAt: null
    },
    take: 100
  });

  for (const transfer of missingCalculatedShiftEnds) {
    try {
      const calculatedShiftEndAt = calculateCopenhagenShiftEnd(transfer.requestedStartAt);
      const updated = await prisma.shiftTransfer.updateMany({
        where: {
          id: transfer.id,
          status: { in: activeShiftEndStatuses },
          expectedEndMode: "UNTIL_SHIFT_END",
          calculatedShiftEndAt: null
        },
        data: { calculatedShiftEndAt }
      });
      if (updated.count === 1) {
        transfer.calculatedShiftEndAt = calculatedShiftEndAt;
        backfilled += 1;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push({ transferId: transfer.id, message });
      console.error("SHIFT_END_BACKFILL_FAILED", { transferId: transfer.id, message });
    }
  }

  const transfers = await prisma.shiftTransfer.findMany({
    where: {
      status: { in: activeShiftEndStatuses },
      expectedEndMode: "UNTIL_SHIFT_END",
      calculatedShiftEndAt: { lte: now }
    },
    take: 100
  });

  for (const transfer of transfers) {
    const originalStatus = transfer.status;
    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.shiftTransfer.updateMany({
        where: {
          id: transfer.id,
          status: {
            in: activeShiftEndStatuses
          },
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

    if (originalStatus === "VC_APPROVED_AWAITING_ACTIVATION" || originalStatus === "VC_APPROVED_ACTIVE") {
      completedByStatus[originalStatus] += 1;
    }
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

  const completed = completedByStatus.VC_APPROVED_ACTIVE + completedByStatus.VC_APPROVED_AWAITING_ACTIVATION;
  console.log("SHIFT_END_COMPLETION_SUMMARY", {
    backfilled,
    completedFromActive: completedByStatus.VC_APPROVED_ACTIVE,
    completedFromAwaitingActivation: completedByStatus.VC_APPROVED_AWAITING_ACTIVATION,
    errors: errors.length
  });

  return {
    completed,
    backfilled,
    completedFromActive: completedByStatus.VC_APPROVED_ACTIVE,
    completedFromAwaitingActivation: completedByStatus.VC_APPROVED_AWAITING_ACTIVATION,
    errors
  };
}

export async function expireDueAvailabilities(prisma, now = new Date()) {
  const due = await prisma.availability.findMany({
    where: {
      status: "AVAILABLE",
      availableUntil: { lte: now }
    },
    take: 100,
    include: { user: true }
  });

  let expired = 0;
  const errors = [];

  for (const availability of due) {
    try {
      const result = await prisma.$transaction(async (tx) => {
        const updated = await tx.availability.updateMany({
          where: { id: availability.id, status: "AVAILABLE" },
          data: { status: "EXPIRED", expiredAt: now }
        });
        if (updated.count !== 1) {
          return false;
        }
        await tx.auditLog.create({
          data: {
            action: "AVAILABILITY_EXPIRED",
            targetUserId: availability.userId,
            availabilityId: availability.id,
            description: `${availability.user.name} er ikke længere til rådighed`
          }
        });
        return true;
      });
      if (result) {
        expired += 1;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push({ availabilityId: availability.id, message });
      console.error("AVAILABILITY_EXPIRE_FAILED", { availabilityId: availability.id, message });
    }
  }

  console.log("AVAILABILITY_EXPIRY_SUMMARY", { expired, errors: errors.length });
  return { expired, errors };
}

export async function publishDueNotifications(prisma, now = new Date()) {
  const shiftEnd = await completeDueShiftEndTransfers(prisma, now);
  const availabilities = await expireDueAvailabilities(prisma, now);
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

  return {
    published,
    cancelled,
    completedShiftEndTransfers: shiftEnd.completed,
    backfilledShiftEndTransfers: shiftEnd.backfilled,
    completedShiftEndTransfersFromActive: shiftEnd.completedFromActive,
    completedShiftEndTransfersFromAwaitingActivation: shiftEnd.completedFromAwaitingActivation,
    shiftEndErrors: shiftEnd.errors.length,
    expiredAvailabilities: availabilities.expired,
    availabilityExpiryErrors: availabilities.errors.length
  };
}
