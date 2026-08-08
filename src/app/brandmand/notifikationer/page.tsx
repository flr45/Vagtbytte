import { UserRole } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TopBar } from "@/components/TopBar";
import { NotificationsView } from "@/components/NotificationsView";

export default async function FirefighterNotificationsPage() {
  const user = await requireRole(UserRole.BRANDFIGHTER);
  const [notifications, devices, latestDelivery] = await Promise.all([
    prisma.notification.findMany({
      where: { recipientUserId: user.id, publishedAt: { not: null }, cancelledAt: null, dismissedAt: null },
      orderBy: { createdAt: "desc" },
      take: 100
    }),
    prisma.pushSubscription.findMany({
      where: { userId: user.id, revokedAt: null },
      orderBy: { updatedAt: "desc" },
      select: { id: true, deviceName: true, lastUsedAt: true }
    }),
    prisma.pushDelivery.findFirst({
      where: { notification: { recipientUserId: user.id, type: "TEST" } },
      orderBy: { createdAt: "desc" },
      select: { status: true, sentAt: true, failedAt: true, createdAt: true }
    })
  ]);

  return (
    <>
      <TopBar backHref="/app/mere" backLabel="Tilbage til Mere" title="Notifikationer" />
      <NotificationsView
        devices={devices}
        latestDelivery={
          latestDelivery
            ? {
                status: latestDelivery.status,
                at: (latestDelivery.sentAt ?? latestDelivery.failedAt ?? latestDelivery.createdAt).toLocaleString("da-DK", {
                  timeZone: "Europe/Copenhagen"
                })
              }
            : null
        }
        notifications={notifications}
        publicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY}
        title="Notifikationer"
      />
    </>
  );
}
