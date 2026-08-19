import { describe, expect, it } from "vitest";
import { UserRole } from "@prisma/client";
import {
  decryptMfaValue,
  encryptMfaValue,
  generateRecoveryCodes,
  generateTotpSecret,
  hashMfaChallengeToken,
  hashRecoveryCode,
  isMfaRequiredForUser,
  normalizeRecoveryCode,
  totpCodeAt,
  verifyTotpCode
} from "./mfa";

describe("TOTP MFA", () => {
  it("genererer og verificerer en sekscifret kode", () => {
    const secret = "JBSWY3DPEHPK3PXP";
    const at = new Date("2026-08-19T12:00:00.000Z");
    const code = totpCodeAt(secret, at);

    expect(code).toMatch(/^\d{6}$/);
    expect(verifyTotpCode(secret, code, at)).toMatchObject({ ok: true });
    expect(verifyTotpCode(secret, "000000", at).ok).toBe(code === "000000");
  });

  it("accepterer et normalt tidsvindue på plus/minus 30 sekunder", () => {
    const secret = generateTotpSecret();
    const at = new Date("2026-08-19T12:00:30.000Z");
    const previousCode = totpCodeAt(secret, new Date(at.getTime() - 30_000));
    expect(verifyTotpCode(secret, previousCode, at, 1).ok).toBe(true);
  });
});

describe("MFA-kryptering", () => {
  it("gemmer ikke MFA-secret i klartekst", () => {
    const previousSecret = process.env.AUTH_SECRET;
    process.env.AUTH_SECRET = "test-secret-med-tilstraekkelig-entropi";
    const clear = "JBSWY3DPEHPK3PXP";
    const encrypted = encryptMfaValue(clear);

    expect(encrypted).not.toContain(clear);
    expect(decryptMfaValue(encrypted)).toBe(clear);
    process.env.AUTH_SECRET = previousSecret;
  });

  it("hashing af challenge-token er deterministisk uden klartekst", () => {
    const token = "challenge-token";
    const hash = hashMfaChallengeToken(token);
    expect(hash).toHaveLength(64);
    expect(hash).not.toBe(token);
    expect(hashMfaChallengeToken(token)).toBe(hash);
  });
});

describe("recovery-koder", () => {
  it("genererer ti forskellige koder og normaliserer bindestreger", () => {
    const codes = generateRecoveryCodes();
    expect(codes).toHaveLength(10);
    expect(new Set(codes).size).toBe(10);
    expect(normalizeRecoveryCode("ABCD-2345-EFGH")).toBe("ABCD2345EFGH");
    expect(hashRecoveryCode("ABCD-2345-EFGH")).toBe(hashRecoveryCode("abcd 2345 efgh"));
  });
});

describe("MFA-politik", () => {
  const firefighter = {
    role: UserRole.BRANDFIGHTER,
    hasAdminAccess: false,
    hasOperationalPortalAccess: false
  };

  it("kræver MFA for admin, VC og Operativ Portal som standard", () => {
    expect(isMfaRequiredForUser({ ...firefighter, role: UserRole.ADMIN }, {})).toBe(true);
    expect(isMfaRequiredForUser({ ...firefighter, role: UserRole.VC }, {})).toBe(true);
    expect(isMfaRequiredForUser({ ...firefighter, hasAdminAccess: true }, {})).toBe(true);
    expect(isMfaRequiredForUser({ ...firefighter, hasOperationalPortalAccess: true }, {})).toBe(true);
    expect(isMfaRequiredForUser(firefighter, {})).toBe(false);
  });

  it("kan håndhæves for alle via miljøkonfiguration", () => {
    expect(isMfaRequiredForUser(firefighter, { MFA_ENFORCEMENT_MODE: "all" })).toBe(true);
    expect(isMfaRequiredForUser({ ...firefighter, role: UserRole.ADMIN }, { MFA_ENFORCEMENT_MODE: "off" })).toBe(false);
  });
});
