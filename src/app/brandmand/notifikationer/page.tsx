import { UserRole } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TopBar } from "@/components/TopBar";
import { NotificationsView } from "@/components/NotificationsView";

export default async function FirefighterNotificationsPage() {
  const user = await requireRole(UserRole.BRANDFIGHTER);
  const [notifications, devices] = await Promise.all([
    prisma.notification.findMany({
      where: { recipientUserId: user.id, publishedAt: { not: null }, cancelledAt: null, dismissedAt: null },
      orderBy: { createdAt: "desc" },
      take: 100
    }),
    prisma.pushSubscription.findMany({
      where: { userId: user.id, revokedAt: null },
      orderBy: { updatedAt: "desc" }
    })
  ]);

  return (
    <>
      <TopBar title="Notifikationer" />
      <NotificationsView
        devices={devices}
        notifications={notifications}
        publicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY}
        title="Notifikationer"
      />
    </>
  );
}
