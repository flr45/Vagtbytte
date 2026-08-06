import { randomBytes, createHmac } from "crypto";
import type { UserRole } from "@prisma/client";
import { normalizeLoginIdentifier } from "./login-identifiers";
import { verifyPassword } from "./passwords";

export type AuthUser = {
  id: string;
  name: string;
  role: UserRole;
  employeeNumber: string | null;
  loginIdentifier: string;
  passwordHash: string;
  isActive: boolean;
  mustChangePassword: boolean;
  hasAdminAccess: boolean;
  hasOperationalPortalAccess?: boolean;
};

export type AuthRepository = {
  findUserByLogin(identifier: string): Promise<AuthUser | null>;
  countRecentFailures(identifier: string, ipAddress?: string): Promise<number>;
  recordAttempt(input: {
    identifier: string;
    ipAddress?: string;
    wasSuccessful: boolean;
    failureReason?: string;
  }): Promise<void>;
  createSession(input: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<void>;
  markLogin(userId: string): Promise<void>;
  audit(input: {
    actorUserId?: string;
    actorRole?: UserRole;
    action: string;
    targetUserId?: string;
    description: string;
  }): Promise<void>;
};

export type SessionUser = AuthUser;

export type SessionRecord = {
  id: string;
  expiresAt: Date;
  lastSeenAt?: Date;
  user: SessionUser;
};

export type LoginResult =
  | { ok: true; user: AuthUser; rawToken: string; expiresAt: Date }
  | { ok: false; message: string; reason: "RATE_LIMITED" | "INVALID" | "INACTIVE" };

export function hashSessionToken(token: string) {
  const secret = process.env.AUTH_SECRET;

  if (!secret && process.env.NODE_ENV === "production") {
    throw new Error("AUTH_SECRET mangler");
  }

  return createHmac("sha256", secret ?? "test-og-lokal-udvikling").update(token).digest("hex");
}

export function newSessionToken() {
  return randomBytes(32).toString("base64url");
}

export function sessionExpiry() {
  return new Date(Date.now() + sessionLifetimeMs());
}

export function sessionLifetimeMs() {
  return 1000 * 60 * 60 * 24 * 30;
}

export function sessionCookieOptions(expiresAt: Date, now = new Date()) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: Math.max(0, Math.floor((expiresAt.getTime() - now.getTime()) / 1000)),
    expires: expiresAt
  };
}

export function shouldRefreshSession(session: { expiresAt: Date; lastSeenAt: Date }, now = new Date()) {
  return now.getTime() - session.lastSeenAt.getTime() >= 1000 * 60 * 60 * 24;
}

export function refreshedSessionExpiry(now = new Date()) {
  return new Date(now.getTime() + sessionLifetimeMs());
}

export function resolveCurrentUserFromSession(session: SessionRecord | null, now = new Date()) {
  if (!session) {
    return null;
  }

  if (session.expiresAt < now) {
    return null;
  }

  if (!session.user.isActive) {
    return null;
  }

  return session.user;
}

export function shouldDeleteCookieOnLogout(rawToken: string | undefined | null) {
  return Boolean(rawToken);
}

export async function authenticateLogin(input: {
  identifier: string;
  password: string;
  ipAddress?: string;
  repo: AuthRepository;
}): Promise<LoginResult> {
  const identifier = normalizeLoginIdentifier(input.identifier);
  const recentFailures = await input.repo.countRecentFailures(identifier, input.ipAddress);

  if (recentFailures >= 5) {
    await input.repo.recordAttempt({
      identifier,
      ipAddress: input.ipAddress,
      wasSuccessful: false,
      failureReason: "For mange forsøg"
    });
    return {
      ok: false,
      reason: "RATE_LIMITED",
      message: "Der er forsøgt for mange gange. Prøv igen senere."
    };
  }

  const user = await input.repo.findUserByLogin(identifier);
  const validPassword = user ? await verifyPassword(input.password, user.passwordHash) : false;

  if (!user || !validPassword) {
    await input.repo.recordAttempt({
      identifier,
      ipAddress: input.ipAddress,
      wasSuccessful: false,
      failureReason: "Forkert login"
    });
    await input.repo.audit({
      action: "LOGIN_FAILED",
      description: `Mislykket loginforsøg for ${identifier}`
    });
    return { ok: false, reason: "INVALID", message: "Forkert login eller adgangskode." };
  }

  if (!user.isActive) {
    await input.repo.recordAttempt({
      identifier,
      ipAddress: input.ipAddress,
      wasSuccessful: false,
      failureReason: "Deaktiveret bruger"
    });
    await input.repo.audit({
      actorUserId: user.id,
      actorRole: user.role,
      action: "LOGIN_BLOCKED_INACTIVE",
      targetUserId: user.id,
      description: "Login afvist fordi brugeren er deaktiveret"
    });
    return { ok: false, reason: "INACTIVE", message: "Brugeren er deaktiveret." };
  }

  const rawToken = newSessionToken();
  const expiresAt = sessionExpiry();

  await input.repo.createSession({
    userId: user.id,
    tokenHash: hashSessionToken(rawToken),
    expiresAt
  });
  await input.repo.markLogin(user.id);
  await input.repo.recordAttempt({
    identifier,
    ipAddress: input.ipAddress,
    wasSuccessful: true
  });
  await input.repo.audit({
    actorUserId: user.id,
    actorRole: user.role,
    action: "LOGIN_SUCCESS",
    targetUserId: user.id,
    description: "Bruger loggede ind"
  });

  return { ok: true, user, rawToken, expiresAt };
}
