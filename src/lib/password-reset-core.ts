import { createHash, randomBytes } from "crypto";

export const PASSWORD_RESET_LIFETIME_MS = 30 * 60 * 1000;

export function createPasswordResetToken(now = new Date()) {
  const rawToken = randomBytes(32).toString("base64url");
  return {
    rawToken,
    tokenHash: hashPasswordResetToken(rawToken),
    expiresAt: new Date(now.getTime() + PASSWORD_RESET_LIFETIME_MS)
  };
}

export function hashPasswordResetToken(rawToken: string) {
  return createHash("sha256").update(rawToken).digest("hex");
}

export function passwordResetTokenIsUsable(
  token: { expiresAt: Date; usedAt: Date | null },
  now = new Date()
) {
  return token.usedAt === null && token.expiresAt.getTime() >= now.getTime();
}

export function buildPasswordResetUrl(rawToken: string, baseUrl = process.env.APP_BASE_URL) {
  const url = new URL("/nulstil-adgangskode", baseUrl || "http://localhost:3000");
  url.searchParams.set("token", rawToken);
  return url.toString();
}
