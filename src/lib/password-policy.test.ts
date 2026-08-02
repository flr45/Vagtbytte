import { describe, expect, it } from "vitest";
import {
  evaluatePasswordRequirements,
  passwordMeetsRequirements
} from "./password-policy";
import {
  buildPasswordResetUrl,
  createPasswordResetToken,
  hashPasswordResetToken,
  passwordResetTokenIsUsable
} from "./password-reset-core";

describe("adgangskodepolitik", () => {
  it("kræver længde, stort bogstav, lille bogstav og tal", () => {
    expect(passwordMeetsRequirements("kort1A")).toBe(false);
    expect(passwordMeetsRequirements("langadgangskode1")).toBe(false);
    expect(passwordMeetsRequirements("LANGADGANGSKODE1")).toBe(false);
    expect(passwordMeetsRequirements("LangAdgangskode")).toBe(false);
    expect(passwordMeetsRequirements("LangAdgangskode1")).toBe(true);
  });

  it("returnerer status for hvert synligt krav", () => {
    const result = evaluatePasswordRequirements("LangAdgangskode1");
    expect(result).toHaveLength(4);
    expect(result.every((requirement) => requirement.met)).toBe(true);
  });
});

describe("nulstillingstokens", () => {
  it("gemmer kun en hash af tokenet", () => {
    const token = createPasswordResetToken(new Date("2026-08-02T12:00:00Z"));
    expect(token.rawToken).not.toBe(token.tokenHash);
    expect(hashPasswordResetToken(token.rawToken)).toBe(token.tokenHash);
  });

  it("udløber efter 30 minutter og kan kun bruges én gang", () => {
    const now = new Date("2026-08-02T12:00:00Z");
    const token = createPasswordResetToken(now);
    expect(passwordResetTokenIsUsable({ expiresAt: token.expiresAt, usedAt: null }, now)).toBe(true);
    expect(
      passwordResetTokenIsUsable(
        { expiresAt: token.expiresAt, usedAt: null },
        new Date("2026-08-02T12:31:00Z")
      )
    ).toBe(false);
    expect(passwordResetTokenIsUsable({ expiresAt: token.expiresAt, usedAt: now }, now)).toBe(false);
  });

  it("bygger link på portalens offentlige adresse", () => {
    const url = buildPasswordResetUrl("hemmeligt-token", "https://sbr-portal.racher.dk");
    expect(url).toBe(
      "https://sbr-portal.racher.dk/nulstil-adgangskode?token=hemmeligt-token"
    );
  });
});
