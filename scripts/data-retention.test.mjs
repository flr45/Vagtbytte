import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_ALARM_DATA_RETENTION_DAYS,
  DEFAULT_AUDIT_LOG_RETENTION_DAYS,
  DEFAULT_ERASURE_TOMBSTONE_RETENTION_DAYS,
  DEFAULT_LOGIN_ATTEMPT_RETENTION_DAYS,
  DEFAULT_NOTIFICATION_RETENTION_DAYS,
  DEFAULT_OPERATIONAL_RECENT_RETENTION_DAYS,
  configuredRetentionDays,
  retentionCutoff,
  runDataRetention
} from "./data-retention.mjs";

describe("dataretention", () => {
  it("bruger sikre standarder ved manglende eller ugyldig konfiguration", () => {
    expect(configuredRetentionDays("ALARM_DATA_RETENTION_DAYS", 90, {})).toBe(90);
    expect(
      configuredRetentionDays("ALARM_DATA_RETENTION_DAYS", 90, {
        ALARM_DATA_RETENTION_DAYS: "ikke-et-tal"
      })
    ).toBe(90);
    expect(DEFAULT_ALARM_DATA_RETENTION_DAYS).toBe(90);
    expect(DEFAULT_LOGIN_ATTEMPT_RETENTION_DAYS).toBe(90);
    expect(DEFAULT_NOTIFICATION_RETENTION_DAYS).toBe(180);
    expect(DEFAULT_AUDIT_LOG_RETENTION_DAYS).toBe(365);
    expect(DEFAULT_OPERATIONAL_RECENT_RETENTION_DAYS).toBe(30);
    expect(DEFAULT_ERASURE_TOMBSTONE_RETENTION_DAYS).toBe(365);
  });

  it("beregner cutoff og kan deaktiveres med 0 dage", () => {
    const now = new Date("2026-08-01T12:00:00.000Z");
    expect(retentionCutoff(now, 90)?.toISOString()).toBe("2026-05-03T12:00:00.000Z");
    expect(retentionCutoff(now, 0)).toBeNull();
  });

  it("sletter udløbne og for gamle persondata efter den konfigurerede retention", async () => {
    const notificationDeleteMany = vi
      .fn()
      .mockResolvedValueOnce({ count: 4 })
      .mockResolvedValueOnce({ count: 6 });
    const alarmDeleteMany = vi.fn().mockResolvedValue({ count: 2 });
    const resetTokenDeleteMany = vi.fn().mockResolvedValue({ count: 3 });
    const sessionDeleteMany = vi.fn().mockResolvedValue({ count: 5 });
    const mfaChallengeDeleteMany = vi.fn().mockResolvedValue({ count: 11 });
    const loginAttemptDeleteMany = vi.fn().mockResolvedValue({ count: 7 });
    const auditDeleteMany = vi.fn().mockResolvedValue({ count: 8 });
    const tombstoneDeleteMany = vi.fn().mockResolvedValue({ count: 10 });
    const auditCreate = vi.fn().mockResolvedValue({ id: "audit-1" });
    const executeRaw = vi.fn().mockResolvedValue(9);
    const prisma = {
      $transaction: vi.fn(async (callback) =>
        callback({
          notification: { deleteMany: notificationDeleteMany },
          alarm: { deleteMany: alarmDeleteMany }
        })
      ),
      $executeRaw: executeRaw,
      passwordResetToken: { deleteMany: resetTokenDeleteMany },
      session: { deleteMany: sessionDeleteMany },
      mfaChallenge: { deleteMany: mfaChallengeDeleteMany },
      loginAttempt: { deleteMany: loginAttemptDeleteMany },
      notification: { deleteMany: notificationDeleteMany },
      dataErasureTombstone: { deleteMany: tombstoneDeleteMany },
      backupSnapshot: {
        findMany: vi.fn().mockResolvedValue([]),
        deleteMany: vi.fn()
      },
      auditLog: { deleteMany: auditDeleteMany, create: auditCreate }
    };
    const now = new Date("2026-08-01T12:00:00.000Z");

    const result = await runDataRetention(prisma, now, {
      ALARM_DATA_RETENTION_DAYS: "90",
      BACKUP_MAX_AGE_DAYS: "90",
      LOGIN_ATTEMPT_RETENTION_DAYS: "90",
      NOTIFICATION_RETENTION_DAYS: "180",
      AUDIT_LOG_RETENTION_DAYS: "365",
      OPERATIONAL_RECENT_RETENTION_DAYS: "30",
      ERASURE_TOMBSTONE_RETENTION_DAYS: "365"
    });

    expect(result.alarmsDeleted).toBe(2);
    expect(result.alarmNotificationsDeleted).toBe(4);
    expect(result.passwordResetTokensDeleted).toBe(3);
    expect(result.expiredSessionsDeleted).toBe(5);
    expect(result.expiredMfaChallengesDeleted).toBe(11);
    expect(result.loginAttemptsDeleted).toBe(7);
    expect(result.notificationsDeleted).toBe(6);
    expect(result.auditLogsDeleted).toBe(8);
    expect(result.operationalRecentDeleted).toBe(9);
    expect(result.erasureTombstonesDeleted).toBe(10);
    expect(notificationDeleteMany).toHaveBeenNthCalledWith(1, {
      where: {
        type: "ALARM_MESSAGE",
        createdAt: { lt: new Date("2026-05-03T12:00:00.000Z") }
      }
    });
    expect(alarmDeleteMany).toHaveBeenCalledWith({
      where: { openedAt: { lt: new Date("2026-05-03T12:00:00.000Z") } }
    });
    expect(resetTokenDeleteMany).toHaveBeenCalledWith({
      where: { expiresAt: { lt: now } }
    });
    expect(sessionDeleteMany).toHaveBeenCalledWith({ where: { expiresAt: { lt: now } } });
    expect(mfaChallengeDeleteMany).toHaveBeenCalledWith({ where: { expiresAt: { lt: now } } });
    expect(auditCreate).toHaveBeenCalledTimes(1);
  });
});
