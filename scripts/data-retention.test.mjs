import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_ALARM_DATA_RETENTION_DAYS,
  configuredRetentionDays,
  retentionCutoff,
  runDataRetention
} from "./data-retention.mjs";

describe("dataretention", () => {
  it("bruger en sikker standard ved manglende eller ugyldig konfiguration", () => {
    expect(configuredRetentionDays("ALARM_DATA_RETENTION_DAYS", 90, {})).toBe(90);
    expect(
      configuredRetentionDays("ALARM_DATA_RETENTION_DAYS", 90, {
        ALARM_DATA_RETENTION_DAYS: "ikke-et-tal"
      })
    ).toBe(90);
    expect(DEFAULT_ALARM_DATA_RETENTION_DAYS).toBe(90);
  });

  it("beregner cutoff og kan deaktiveres med 0 dage", () => {
    const now = new Date("2026-08-01T12:00:00.000Z");
    expect(retentionCutoff(now, 90)?.toISOString()).toBe("2026-05-03T12:00:00.000Z");
    expect(retentionCutoff(now, 0)).toBeNull();
  });

  it("sletter rå alarmdata og bevarer statistikmodellen", async () => {
    const notificationDeleteMany = vi.fn().mockResolvedValue({ count: 4 });
    const alarmDeleteMany = vi.fn().mockResolvedValue({ count: 2 });
    const auditCreate = vi.fn().mockResolvedValue({ id: "audit-1" });
    const prisma = {
      $transaction: vi.fn(async (callback) =>
        callback({
          notification: { deleteMany: notificationDeleteMany },
          alarm: { deleteMany: alarmDeleteMany }
        })
      ),
      backupSnapshot: {
        findMany: vi.fn().mockResolvedValue([]),
        deleteMany: vi.fn()
      },
      auditLog: { create: auditCreate }
    };

    const result = await runDataRetention(prisma, new Date("2026-08-01T12:00:00.000Z"), {
      ALARM_DATA_RETENTION_DAYS: "90",
      BACKUP_MAX_AGE_DAYS: "90"
    });

    expect(result.alarmsDeleted).toBe(2);
    expect(result.alarmNotificationsDeleted).toBe(4);
    expect(notificationDeleteMany).toHaveBeenCalledWith({
      where: {
        type: "ALARM_MESSAGE",
        createdAt: { lt: new Date("2026-05-03T12:00:00.000Z") }
      }
    });
    expect(alarmDeleteMany).toHaveBeenCalledWith({
      where: { openedAt: { lt: new Date("2026-05-03T12:00:00.000Z") } }
    });
    expect(auditCreate).toHaveBeenCalledTimes(1);
  });
});
