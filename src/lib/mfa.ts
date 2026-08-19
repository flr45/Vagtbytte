import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  randomInt,
  timingSafeEqual
} from "crypto";
import type { UserRole } from "@prisma/client";

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const RECOVERY_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const TOTP_PERIOD_SECONDS = 30;
const TOTP_DIGITS = 6;
const MFA_CHALLENGE_MINUTES = 10;

export const MFA_CHALLENGE_COOKIE_NAME = "sbr_mfa_challenge";

function authSecret() {
  const value = process.env.AUTH_SECRET;
  if (!value && process.env.NODE_ENV === "production") {
    throw new Error("AUTH_SECRET mangler");
  }
  return value ?? "test-og-lokal-udvikling";
}

function domainKey(domain: string) {
  return createHmac("sha256", authSecret()).update(`sbr:${domain}:v1`).digest();
}

function encryptionKey() {
  const configured = process.env.MFA_ENCRYPTION_KEY?.trim();
  if (!configured) {
    return domainKey("mfa-encryption");
  }

  if (/^[0-9a-f]{64}$/i.test(configured)) {
    return Buffer.from(configured, "hex");
  }

  try {
    const decoded = Buffer.from(configured, "base64");
    if (decoded.length === 32) return decoded;
  } catch {
    // Fald videre til domæneafledt nøgle nedenfor.
  }

  return createHmac("sha256", authSecret()).update(`sbr:mfa-configured:${configured}`).digest();
}

export function encryptMfaValue(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

export function decryptMfaValue(value: string) {
  const [version, ivRaw, tagRaw, encryptedRaw] = value.split(".");
  if (version !== "v1" || !ivRaw || !tagRaw || encryptedRaw === undefined) {
    throw new Error("MFA-data har et ugyldigt format.");
  }

  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivRaw, "base64url"));
  decipher.setAuthTag(Buffer.from(tagRaw, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedRaw, "base64url")),
    decipher.final()
  ]).toString("utf8");
}

export function generateTotpSecret(byteLength = 20) {
  return base32Encode(randomBytes(byteLength));
}

export function formatTotpSecret(secret: string) {
  return secret.replace(/\s+/g, "").match(/.{1,4}/g)?.join(" ") ?? secret;
}

export function totpProvisioningUri(secret: string, account: string) {
  const issuer = process.env.MFA_ISSUER?.trim() || "SBR Portal";
  const label = `${issuer}:${account}`;
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: "SHA1",
    digits: String(TOTP_DIGITS),
    period: String(TOTP_PERIOD_SECONDS)
  });
  return `otpauth://totp/${encodeURIComponent(label)}?${params.toString()}`;
}

export function totpCodeAt(secret: string, at = new Date()) {
  const step = Math.floor(at.getTime() / 1000 / TOTP_PERIOD_SECONDS);
  return totpCodeForStep(secret, step);
}

export function verifyTotpCode(secret: string, input: string, at = new Date(), window = 1) {
  const code = input.trim();
  if (!/^\d{6}$/.test(code)) return { ok: false as const };

  const currentStep = Math.floor(at.getTime() / 1000 / TOTP_PERIOD_SECONDS);
  for (let offset = -window; offset <= window; offset += 1) {
    const step = currentStep + offset;
    const expected = totpCodeForStep(secret, step);
    if (safeTextEqual(expected, code)) {
      return { ok: true as const, step };
    }
  }

  return { ok: false as const };
}

function totpCodeForStep(secret: string, step: number) {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const digest = createHmac("sha1", base32Decode(secret)).update(counter).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);
  return String(binary % 10 ** TOTP_DIGITS).padStart(TOTP_DIGITS, "0");
}

export function generateRecoveryCodes(count = 10) {
  return Array.from({ length: count }, () => {
    const chars = Array.from({ length: 12 }, () => RECOVERY_ALPHABET[randomInt(0, RECOVERY_ALPHABET.length)]);
    return `${chars.slice(0, 4).join("")}-${chars.slice(4, 8).join("")}-${chars.slice(8).join("")}`;
  });
}

export function normalizeRecoveryCode(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function hashRecoveryCode(value: string) {
  return createHmac("sha256", domainKey("mfa-recovery"))
    .update(normalizeRecoveryCode(value))
    .digest("hex");
}

export function newMfaChallengeToken() {
  return randomBytes(32).toString("base64url");
}

export function hashMfaChallengeToken(value: string) {
  return createHmac("sha256", domainKey("mfa-challenge")).update(value).digest("hex");
}

export function mfaChallengeExpiry(now = new Date()) {
  return new Date(now.getTime() + MFA_CHALLENGE_MINUTES * 60 * 1000);
}

export function mfaChallengeCookieOptions(expiresAt: Date, now = new Date()) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: Math.max(0, Math.floor((expiresAt.getTime() - now.getTime()) / 1000)),
    expires: expiresAt
  };
}

export function isMfaRequiredForUser(
  user: {
    role: UserRole;
    hasAdminAccess?: boolean;
    hasOperationalPortalAccess?: boolean;
  },
  env: NodeJS.ProcessEnv = process.env
) {
  const mode = String(env.MFA_ENFORCEMENT_MODE ?? "privileged").trim().toLowerCase();
  if (mode === "off") return false;
  if (mode === "all") return true;

  return (
    user.role === "ADMIN" ||
    user.role === "VC" ||
    Boolean(user.hasAdminAccess) ||
    Boolean(user.hasOperationalPortalAccess)
  );
}

function base32Encode(input: Buffer) {
  let bits = 0;
  let value = 0;
  let output = "";

  for (const byte of input) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }

  return output;
}

function base32Decode(input: string) {
  const normalized = input.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = 0;
  let value = 0;
  const output: number[] = [];

  for (const char of normalized) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index < 0) throw new Error("Ugyldig TOTP-secret.");
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }

  return Buffer.from(output);
}

function safeTextEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}
