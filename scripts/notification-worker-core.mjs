function sanitizePushError(error) {
  const message = error instanceof Error ? error.message : String(error);
  return message.slice(0, 240).replace(/[A-Za-z0-9_-]{28,}/g, "[skjult]");
}

function isPermanentPushError(error) {
  return error && (error.statusCode === 404 || error.statusCode === 410);
}

async function pushSender(input) {
  if (process.env.NOTIFICATIONS_DISABLE_PUSH === "true") {
    return;
  }

  if (!input.endpoint.startsWith("https://")) {
    const error = new Error("Permanent ugyldigt push-endpoint");
    error.statusCode = 410;
    throw error;
  }

  await fetch(input.endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ title: input.title, body: input.body, link: input.link })
  });
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
    return notification.shiftTransfer.status === "COMPLETED";
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
        endpoint: subscription.endpoint,
        title: notification.title,
        body: notification.body,
        link: notification.link
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
      await prisma.pushDelivery.create({
        data: {
          notificationId: notification.id,
          pushSubscriptionId: subscription.id,
          status: permanent ? "PERMANENT_FAILURE" : "FAILED",
          attemptCount: 1,
          failedAt: new Date(),
          lastError: sanitizePushError(error)
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

export async function publishDueNotifications(prisma, now = new Date()) {
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

    await prisma.notification.update({ where: { id: notification.id }, data: { publishedAt: now } });
    await sendPushForNotification(prisma, notification.id);
    published += 1;
  }

  return { published, cancelled };
}
