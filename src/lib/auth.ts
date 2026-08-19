import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { UserRole } from "@prisma/client";
import { prisma } from "./prisma";
import {
  hashSessionToken,
  newSessionToken,
  resolveCurrentUserFromSession,
  sessionCookieOptions,
  sessionExpiry,
  shouldDeleteCookieOnLogout,
  verifyLoginCredentials,
  type AuthRepository
} from "./auth-core";
import {
  canAccessOperationalPortal,
  canManageOperationalPortal,
  hasOperationalPortalGrant
} from "./operativ-portal-access";
import { isMfaRequiredForUser } from "./mfa";
import { roleHome } from "./roles";

export const SESSION_COOKIE_NAME = "vagtoverdragelse_session";

export { canAccessOperationalPortal, canManageOperationalPortal, roleHome };

export const prismaAuthRepository: AuthRepository = {
  async findUserByLogin(identifier) {
    const user = await prisma.user.findFirst({
      where: {
        OR: [{ loginIdentifier: identifier }, { employeeNumber: identifier }]
      }
    });

    if (!user) {
      return null;
    }

    return {
      ...user,
      hasOperationalPortalAccess: await hasOperationalPortalGrant(user.id)
    };
  },
  async countRecentFailures(identifier, ipAddress) {
    const since = new Date(Date.now() - 1000 * 60 * 15);
    return prisma.loginAttempt.count({
      where: {
        wasSuccessful: false,
        createdAt: { gte: since },
        OR: [{ identifier }, ...(ipAddress ? [{ ipAddress }] : [])]
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

// Legacy password-only login holdes kun for bagudkompatibilitet med ældre server-actions.
// Konti, som er omfattet af MFA-politikken, må aldrig få en session gennem denne vej.
export async function signIn(identifier: string, password: string) {
  const credentials = await verifyLoginCredentials({
    identifier,
    password,
    ipAddress: await getIpAddress(),
    repo: prismaAuthRepository
  });

  if (!credentials.ok) {
    return credentials;
  }

  if (isMfaRequiredForUser(credentials.user)) {
    await prismaAuthRepository.audit({
      actorUserId: credentials.user.id,
      actorRole: credentials.user.role,
      action: "LEGACY_LOGIN_BLOCKED_MFA_REQUIRED",
      targetUserId: credentials.user.id,
      description: "Password-only login blev afvist, fordi kontoen kræver MFA"
    });
    return {
      ok: false as const,
      reason: "INVALID" as const,
      message: "Denne konto kræver MFA. Log ind via den normale login-side."
    };
  }

  const rawToken = newSessionToken();
  const expiresAt = sessionExpiry();
  await prismaAuthRepository.createSession({
    userId: credentials.user.id,
    tokenHash: hashSessionToken(rawToken),
    expiresAt
  });
  await prismaAuthRepository.markLogin(credentials.user.id);
  await prismaAuthRepository.audit({
    actorUserId: credentials.user.id,
    actorRole: credentials.user.role,
    action: "LOGIN_SUCCESS",
    targetUserId: credentials.user.id,
    description: "Bruger loggede ind"
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, rawToken, sessionCookieOptions(expiresAt));

  return { ok: true as const, user: credentials.user, rawToken, expiresAt };
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

  if (!session) {
    return null;
  }

  return resolveCurrentUserFromSession({
    ...session,
    user: {
      ...session.user,
      hasOperationalPortalAccess: await hasOperationalPortalGrant(session.userId)
    }
  });
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  return user;
}

function enforcePasswordChange(user: Awaited<ReturnType<typeof requireUser>>) {
  if (user.mustChangePassword) {
    redirect("/skift-adgangskode");
  }
}

export async function requireRole(role: UserRole) {
  const user = await requireUser();
  enforcePasswordChange(user);

  const hasRequiredRole =
    user.role === role || (role === UserRole.ADMIN && user.hasAdminAccess);

  if (!hasRequiredRole) {
    redirect("/forbudt");
  }

  return user;
}

export async function requireOperationalPortalAccess() {
  const user = await requireUser();
  enforcePasswordChange(user);

  if (!canAccessOperationalPortal(user)) {
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
