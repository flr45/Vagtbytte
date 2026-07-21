import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  hashSessionToken,
  refreshedSessionExpiry,
  sessionCookieOptions,
  shouldRefreshSession,
  shouldDeleteCookieOnLogout
} from "@/lib/auth-core";
import { SESSION_COOKIE_NAME } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST() {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!rawToken) {
    return NextResponse.json({ status: "no-session" });
  }

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashSessionToken(rawToken) },
    include: { user: true }
  });

  const now = new Date();
  if (!session || session.expiresAt < now || !session.user.isActive) {
    if (shouldDeleteCookieOnLogout(rawToken)) {
      cookieStore.delete(SESSION_COOKIE_NAME);
    }
    return NextResponse.json({ status: "expired" }, { status: 401 });
  }

  if (!shouldRefreshSession(session, now)) {
    return NextResponse.json({ status: "fresh" });
  }

  const expiresAt = refreshedSessionExpiry(now);
  await prisma.session.update({
    where: { id: session.id },
    data: { expiresAt, lastSeenAt: now }
  });
  cookieStore.set(SESSION_COOKIE_NAME, rawToken, sessionCookieOptions(expiresAt, now));

  return NextResponse.json({ status: "refreshed" });
}
