import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { UserRole } from "@prisma/client";
import { prisma } from "./prisma";
import {
  authenticateLogin,
  hashSessionToken,
  resolveCurrentUserFromSession,
  sessionCookieOptions,
  shouldDeleteCookieOnLogout,
  type AuthRepository
} from "./auth-core";
import { roleHome } from "./roles";

export const SESSION_COOKIE_NAME = "vagtoverdragelse_session";

export { roleHome };

export const prismaAuthRepository: AuthRepository = {
  async findUserByLogin(identifier) {
    return prisma.user.findFirst({
      where: {
        OR: [
          { loginIdentifier: identifier },
          { employeeNumber: identifier }
        ]
      }
    });
  },
  async countRecentFailures(identifier, ipAddress) {
    const since = new Date(Date.now() - 1000 * 60 * 15);
    return prisma.loginAttempt.count({
      where: {
        wasSuccessful: false,
        createdAt: { gte: since },
        OR: [
          { identifier },
          ...(ipAddress ? [{ ipAddress }] : [])
        ]
      }
    });
  },
  async recordAttempt(input) {
    await prisma.loginAttempt.create({ data: input });
  },
  async createSession(input) {
    await prisma.session.create({ data: input });
  },
  async markLogin(userId) {
    await prisma.user.update({
      where: { id: userId },
      data: { lastLoginAt: new Date() }
    });
  },
  async audit(input) {
    await prisma.auditLog.create({ data: input });
  }
};

export async function getIpAddress() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? undefined;
}

export async function signIn(identifier: string, password: string) {
  const result = await authenticateLogin({
    identifier,
    password,
    ipAddress: await getIpAddress(),
    repo: prismaAuthRepository
  });

  if (result.ok) {
    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE_NAME, result.rawToken, sessionCookieOptions(result.expiresAt));
  }

  return result;
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!rawToken) {
    return null;
  }

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashSessionToken(rawToken) },
    include: { user: true }
  });

  return resolveCurrentUserFromSession(session);
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  return user;
}

export async function requireRole(role: UserRole) {
  const user = await requireUser();

  if (user.mustChangePassword) {
    redirect("/skift-adgangskode");
  }

  if (user.role !== role) {
    redirect("/forbudt");
  }

  return user;
}

export async function requirePasswordChangeUser() {
  const user = await requireUser();
  if (!user.mustChangePassword) {
    redirect(roleHome[user.role]);
  }
  return user;
}

export async function signOut() {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (shouldDeleteCookieOnLogout(rawToken) && rawToken) {
    const session = await prisma.session.findUnique({
      where: { tokenHash: hashSessionToken(rawToken) },
      include: { user: true }
    });
    if (session) {
      await prisma.auditLog.create({
        data: {
          actorUserId: session.userId,
          actorRole: session.user.role,
          action: "LOGOUT",
          targetUserId: session.userId,
          description: "Bruger loggede ud"
        }
      });
      await prisma.session.delete({ where: { id: session.id } });
    }
  }

  cookieStore.delete(SESSION_COOKIE_NAME);
}
