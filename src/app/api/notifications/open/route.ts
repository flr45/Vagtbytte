import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { notificationIdSchema } from "@/lib/validation";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = notificationIdSchema.safeParse({ notificationId: body.notificationId });
  if (!parsed.success) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const notification = await prisma.notification.findUnique({
    where: { id: parsed.data.notificationId }
  });
  if (!notification || notification.recipientUserId !== user.id) {
    return NextResponse.json({ ok: false }, { status: 404 });
  }

  await prisma.notification.update({
    where: { id: notification.id },
    data: { readAt: notification.readAt ?? new Date(), openedAt: notification.openedAt ?? new Date() }
  });

  return NextResponse.json({ ok: true });
}
