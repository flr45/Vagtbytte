import { describe, expect, it } from "vitest";
import { buildGdprUserExport, gdprExportFileName } from "./gdpr-user-export";

function emptyFindMany() {
  return { findMany: async () => [] };
}

function makePrisma() {
  return {
    user: {
      async findUnique() {
        return {
          id: "user-1",
          name: "Test Bruger",
          role: "BRANDFIGHTER",
          employeeNumber: "1234",
          loginIdentifier: "1234",
          email: "test@example.test",
          vcSmsPhoneNumber: null,
          isActive: true,
          mustChangePassword: false,
          stationCode: "SLA",
          alarmStations: ["SLA"],
          receiveAlarmFollowUps: false,
          hasAdminAccess: false,
          mfaEnabled: true,
          mfaEnrolledAt: new Date("2026-08-01T10:00:00.000Z"),
          createdAt: new Date("2026-07-01T10:00:00.000Z"),
          updatedAt: new Date("2026-08-01T10:00:00.000Z"),
          lastLoginAt: new Date("2026-08-18T10:00:00.000Z")
        };
      }
    },
    session: emptyFindMany(),
    mfaChallenge: emptyFindMany(),
    passwordResetToken: emptyFindMany(),
    loginAttempt: emptyFindMany(),
    availability: emptyFindMany(),
    shiftTransfer: emptyFindMany(),
    returnRequest: emptyFindMany(),
    notification: emptyFindMany(),
    pushSubscription: {
      async findMany() {
        return [{
          endpoint: "https://push.example.test/private-token",
          userAgent: "Test Browser",
          deviceName: "Telefon",
          createdAt: new Date("2026-08-01T10:00:00.000Z"),
          updatedAt: new Date("2026-08-01T10:00:00.000Z"),
          lastUsedAt: null,
          revokedAt: null,
          deliveries: []
        }];
      }
    },
    auditLog: emptyFindMany(),
    async $queryRawUnsafe(query: string) {
      if (query.includes("operational_portal_user_access")) {
        return [{ createdAt: new Date("2026-08-02T10:00:00.000Z") }];
      }
      return [];
    }
  };
}

describe("GDPR-brugerudtræk", () => {
  it("udelader passwords, MFA-secrets, token hashes og fuld push-endpoint", async () => {
    const result = await buildGdprUserExport(
      makePrisma(),
      "user-1",
      new Date("2026-08-19T12:00:00.000Z")
    );

    expect(result).not.toBeNull();
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("passwordHash");
    expect(serialized).not.toContain("mfaSecretEncrypted");
    expect(serialized).not.toContain("mfaRecoveryCodes");
    expect(serialized).not.toContain("private-token");
    expect(result?.securityHistory.pushDevices[0].endpointOrigin).toBe("https://push.example.test");
    expect(result?.releaseReviewRequired).toBe(true);
    expect(result?.user.hasOperationalPortalAccess).toBe(true);
  });

  it("returnerer null for ukendt bruger", async () => {
    const prisma = makePrisma();
    prisma.user.findUnique = async () => null as never;
    expect(await buildGdprUserExport(prisma, "missing")).toBeNull();
  });

  it("laver et sikkert filnavn", () => {
    expect(gdprExportFileName({ employeeNumber: "12/34", loginIdentifier: "ignored" }))
      .toMatch(/^sbr-gdpr-udtraek-12-34-\d{4}-\d{2}-\d{2}\.json$/);
  });
});
