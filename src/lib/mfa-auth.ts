import { cookies } from "next/headers";
import type { User } from "@prisma/client";
import {
  hashSessionToken,
  newSessionToken,
  sessionCookieOptions,
  sessionExpiry,
  verifyLoginCredentials
} from "./auth-core";
import {
  SESSION_COOKIE_NAME,
  getIpAddress,
  prismaAuthRepository,
  roleHome
} from "./auth";
import {
  MFA_CHALLENGE_COOKIE_NAME,
  decryptMfaValue,
  encryptMfaValue,
  formatTotpSecret,
  generateRecoveryCodes,
  generateTotpSecret,
  hashMfaChallengeToken,
  hashRecoveryCode,
  isMfaRequiredForUser,
  mfaChallengeCookieOptions,
  mfaChallengeExpiry,
  newMfaChallengeToken,
  normalizeRecoveryCode,
  totpProvisioningUri,
  verifyTotpCode
} from "./mfa";
import { prisma } from "./prisma";

const MAX_MFA_ATTEMPTS = 5;

export type MfaLoginResult =
  | { ok: true; next: "authenticated" | "mfa" | "mfa-setup"; redirectTo: string }
  | { ok: false; message: string };

export type MfaVerificationResult =
  | { ok: true; redirectTo: string }
  | { ok: false; message: string; expired?: boolean; setupRequired?: boolean };

function postLoginDestination(user: Pick<User, "role" | "mustChangePassword">) {
  return user.mustChangePassword ? "/skift-adgangskode" : roleHome[user.role];
}

async function establishSession(
  user: Pick<User, "id" | "role" | "mustChangePassword">,
  auditActions: string[]
) {
  const rawToken = newSessionToken();
  const expiresAt = sessionExpiry();

  await prisma.$transaction(async (tx) => {
    await tx.session.create({
      data: { userId: user.id, tokenHash: hashSessionToken(rawToken), expiresAt }
    });
    await tx.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() }
    });
    for (const action of auditActions) {
      await tx.auditLog.create({
        data: {
          actorUserId: user.id,
          actorRole: user.role,
          action,
          targetUserId: user.id,
          description:
            action === "MFA_SUCCESS"
              ? "Multifaktorautentifikation godkendt"
              : "Bruger loggede ind"
        }
      });
    }
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, rawToken, sessionCookieOptions(expiresAt));
  return postLoginDestination(user);
}

export async function beginMfaAwareLogin(identifier: string, password: string): Promise<MfaLoginResult> {
  const credentials = await verifyLoginCredentials({
    identifier,
    password,
    ipAddress: await getIpAddress(),
    repo: prismaAuthRepository
  });

  if (!credentials.ok) {
    return { ok: false, message: credentials.message };
  }

  const user = credentials.user;
  if (!isMfaRequiredForUser(user)) {
    const redirectTo = await establishSession(user as User, ["LOGIN_SUCCESS"]);
    return { ok: true, next: "authenticated", redirectTo };
  }

  const rawChallengeToken = newMfaChallengeToken();
  const expiresAt = mfaChallengeExpiry();

  await prisma.$transaction([
    prisma.mfaChallenge.deleteMany({ where: { userId: user.id } }),
    prisma.mfaChallenge.create({
      data: {
        userId: user.id,
        tokenHash: hashMfaChallengeToken(rawChallengeToken),
        expiresAt
      }
    }),
    prisma.auditLog.create({
      data: {
        actorUserId: user.id,
        actorRole: user.role,
        action: "LOGIN_PASSWORD_ACCEPTED_MFA_REQUIRED",
        targetUserId: user.id,
        description: "Adgangskoden blev godkendt; MFA afventer"
      }
    })
  ]);

  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
  cookieStore.set(MFA_CHALLENGE_COOKIE_NAME, rawChallengeToken, mfaChallengeCookieOptions(expiresAt));

  return {
    ok: true,
    next: user.mfaEnabled ? "mfa" : "mfa-setup",
    redirectTo: user.mfaEnabled ? "/mfa" : "/mfa/opsaetning"
  };
}

async function loadChallenge() {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(MFA_CHALLENGE_COOKIE_NAME)?.value;
  if (!rawToken) return null;

  const challenge = await prisma.mfaChallenge.findUnique({
    where: { tokenHash: hashMfaChallengeToken(rawToken) },
    include: { user: true }
  });

  const now = new Date();
  if (
    !challenge ||
    challenge.expiresAt <= now ||
    challenge.attemptCount >= MAX_MFA_ATTEMPTS ||
    !challenge.user.isActive
  ) {
    if (challenge) {
      await prisma.mfaChallenge.delete({ where: { id: challenge.id } }).catch(() => undefined);
    }
    cookieStore.delete(MFA_CHALLENGE_COOKIE_NAME);
    return null;
  }

  return { challenge, cookieStore };
}

export async function getMfaChallengeState() {
  const loaded = await loadChallenge();
  if (!loaded) return null;
  return loaded.challenge.user.mfaEnabled ? "verify" as const : "setup" as const;
}

export async function getMfaSetupDetails() {
  const loaded = await loadChallenge();
  if (!loaded || loaded.challenge.user.mfaEnabled) return null;

  let secretEncrypted = loaded.challenge.setupSecretEncrypted;
  let recoveryEncrypted = loaded.challenge.setupRecoveryCodesEncrypted;

  if (!secretEncrypted || !recoveryEncrypted) {
    const secret = generateTotpSecret();
    const recoveryCodes = generateRecoveryCodes();
    secretEncrypted = encryptMfaValue(secret);
    recoveryEncrypted = encryptMfaValue(JSON.stringify(recoveryCodes));
    await prisma.mfaChallenge.update({
      where: { id: loaded.challenge.id },
      data: {
        setupSecretEncrypted: secretEncrypted,
        setupRecoveryCodesEncrypted: recoveryEncrypted
      }
    });
  }

  const secret = decryptMfaValue(secretEncrypted);
  const recoveryCodes = JSON.parse(decryptMfaValue(recoveryEncrypted)) as string[];
  return {
    account: loaded.challenge.user.loginIdentifier,
    secret,
    formattedSecret: formatTotpSecret(secret),
    provisioningUri: totpProvisioningUri(secret, loaded.challenge.user.loginIdentifier),
    recoveryCodes
  };
}

async function registerMfaFailure(challengeId: string, user: Pick<User, "id" | "role">) {
  const updated = await prisma.mfaChallenge.update({
    where: { id: challengeId },
    data: { attemptCount: { increment: 1 } },
    select: { attemptCount: true }
  }).catch(() => null);

  await prisma.auditLog.create({
    data: {
      actorUserId: user.id,
      actorRole: user.role,
      action: "MFA_FAILED",
      targetUserId: user.id,
      description: "MFA-kode blev afvist"
    }
  }).catch(() => undefined);

  if (updated && updated.attemptCount >= MAX_MFA_ATTEMPTS) {
    await prisma.mfaChallenge.delete({ where: { id: challengeId } }).catch(() => undefined);
    const cookieStore = await cookies();
    cookieStore.delete(MFA_CHALLENGE_COOKIE_NAME);
    return true;
  }
  return false;
}

async function consumeRecoveryCode(userId: string, code: string) {
  const hash = hashRecoveryCode(code);
  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    UPDATE "User"
    SET "mfaRecoveryCodes" = array_remove("mfaRecoveryCodes", ${hash}),
        "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = ${userId}
      AND ${hash} = ANY("mfaRecoveryCodes")
    RETURNING "id"
  `;
  return rows.length === 1;
}

export async function completeMfaVerification(code: string): Promise<MfaVerificationResult> {
  const loaded = await loadChallenge();
  if (!loaded) {
    return { ok: false, expired: true, message: "MFA-sessionen er udløbet. Log ind igen." };
  }

  const { challenge, cookieStore } = loaded;
  const user = challenge.user;
  if (!user.mfaEnabled || !user.mfaSecretEncrypted) {
    return { ok: false, setupRequired: true, message: "MFA skal først sættes op." };
  }

  const trimmed = code.trim();
  let accepted = false;

  if (/^\d{6}$/.test(trimmed)) {
    const secret = decryptMfaValue(user.mfaSecretEncrypted);
    const verification = verifyTotpCode(secret, trimmed);
    if (verification.ok) {
      const updated = await prisma.user.updateMany({
        where: {
          id: user.id,
          OR: [
            { mfaLastUsedStep: null },
            { mfaLastUsedStep: { lt: verification.step } }
          ]
        },
        data: { mfaLastUsedStep: verification.step }
      });
      accepted = updated.count === 1;
    }
  } else if (normalizeRecoveryCode(trimmed).length >= 10) {
    accepted = await consumeRecoveryCode(user.id, trimmed);
  }

  if (!accepted) {
    const locked = await registerMfaFailure(challenge.id, user);
    return {
      ok: false,
      expired: locked,
      message: locked
        ? "For mange forkerte MFA-forsøg. Log ind igen."
        : "Koden kunne ikke godkendes. Prøv igen."
    };
  }

  await prisma.mfaChallenge.delete({ where: { id: challenge.id } });
  cookieStore.delete(MFA_CHALLENGE_COOKIE_NAME);
  const redirectTo = await establishSession(user, ["MFA_SUCCESS", "LOGIN_SUCCESS"]);
  return { ok: true, redirectTo };
}

export async function completeMfaSetup(code: string): Promise<MfaVerificationResult> {
  const loaded = await loadChallenge();
  if (!loaded) {
    return { ok: false, expired: true, message: "MFA-sessionen er udløbet. Log ind igen." };
  }

  const { challenge, cookieStore } = loaded;
  const user = challenge.user;
  if (user.mfaEnabled) {
    return { ok: false, message: "MFA er allerede aktiveret." };
  }
  if (!challenge.setupSecretEncrypted || !challenge.setupRecoveryCodesEncrypted) {
    return { ok: false, message: "MFA-opsætningen er ikke klar. Genindlæs siden." };
  }

  const secret = decryptMfaValue(challenge.setupSecretEncrypted);
  const verification = verifyTotpCode(secret, code);
  if (!verification.ok) {
    const locked = await registerMfaFailure(challenge.id, user);
    return {
      ok: false,
      expired: locked,
      message: locked
        ? "For mange forkerte MFA-forsøg. Log ind igen."
        : "Koden kunne ikke godkendes. Kontrollér tiden på din telefon og prøv igen."
    };
  }

  const recoveryCodes = JSON.parse(decryptMfaValue(challenge.setupRecoveryCodesEncrypted)) as string[];
  const recoveryHashes = recoveryCodes.map(hashRecoveryCode);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: {
        mfaEnabled: true,
        mfaSecretEncrypted: challenge.setupSecretEncrypted,
        mfaRecoveryCodes: recoveryHashes,
        mfaEnrolledAt: new Date(),
        mfaLastUsedStep: verification.step
      }
    }),
    prisma.mfaChallenge.delete({ where: { id: challenge.id } }),
    prisma.auditLog.create({
      data: {
        actorUserId: user.id,
        actorRole: user.role,
        action: "MFA_ENROLLED",
        targetUserId: user.id,
        description: "Multifaktorautentifikation blev aktiveret"
      }
    })
  ]);

  cookieStore.delete(MFA_CHALLENGE_COOKIE_NAME);
  const redirectTo = await establishSession(user, ["MFA_SUCCESS", "LOGIN_SUCCESS"]);
  return { ok: true, redirectTo };
}
