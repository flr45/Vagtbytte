import { rm } from "node:fs/promises";
import { backupPath } from "./backup-core.mjs";

const DAY_MS = 24 * 60 * 60 * 1000;

export const DEFAULT_ALARM_DATA_RETENTION_DAYS = 90;
export const DEFAULT_BACKUP_MAX_AGE_DAYS = 90;

export function configuredRetentionDays(name, fallback, env = process.env) {
  const raw = env[name];
  if (raw === undefined || String(raw).trim() === "") {
    return fallback;
  }

  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 3650) {
    console.warn(`${name} er ugyldig. Bruger standardværdien ${fallback} dage.`);
    return fallback;
  }

  return parsed;
}

export function retentionCutoff(now, days) {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new Error("Ugyldigt tidspunkt til dataretention.");
  }
  if (!Number.isInteger(days) || days < 1) {
    return null;
  }
  return new Date(now.getTime() - days * DAY_MS);
}

export async function runDataRetention(prisma, now = new Date(), env = process.env) {
  if (String(env.DATA_RETENTION_DISABLED ?? "false").toLowerCase() === "true") {
    return {
      disabled: true,
      alarmsDeleted: 0,
      alarmNotificationsDeleted: 0,
      backupsDeleted: 0,
      backupErrors: []
    };
  }

  const alarmDays = configuredRetentionDays(
    "ALARM_DATA_RETENTION_DAYS",
    DEFAULT_ALARM_DATA_RETENTION_DAYS,
    env
  );
  const backupDays = configuredRetentionDays(
    "BACKUP_MAX_AGE_DAYS",
    DEFAULT_BACKUP_MAX_AGE_DAYS,
    env
  );

  const alarmCutoff = retentionCutoff(now, alarmDays);
  const backupCutoff = retentionCutoff(now, backupDays);

  const alarmResult = alarmCutoff
    ? await prisma.$transaction(async (tx) => {
        const notifications = await tx.notification.deleteMany({
          where: {
            type: "ALARM_MESSAGE",
            createdAt: { lt: alarmCutoff }
          }
        });
        const alarms = await tx.alarm.deleteMany({
          where: { openedAt: { lt: alarmCutoff } }
        });

        return {
          alarmsDeleted: alarms.count,
          alarmNotificationsDeleted: notifications.count
        };
      })
    : { alarmsDeleted: 0, alarmNotificationsDeleted: 0 };

  const backupResult = backupCutoff
    ? await deleteExpiredBackups(prisma, backupCutoff)
    : { backupsDeleted: 0, backupErrors: [] };

  const result = {
    disabled: false,
    alarmRetentionDays: alarmDays,
    backupRetentionDays: backupDays,
    ...alarmResult,
    ...backupResult
  };

  if (
    result.alarmsDeleted > 0 ||
    result.alarmNotificationsDeleted > 0 ||
    result.backupsDeleted > 0
  ) {
    await prisma.auditLog
      .create({
        data: {
          action: "DATA_RETENTION_COMPLETED",
          description:
            `Dataretention gennemført: ${result.alarmsDeleted} alarmer, ` +
            `${result.alarmNotificationsDeleted} alarmnotifikationer og ` +
            `${result.backupsDeleted} backups slettet.`
        }
      })
      .catch(() => null);
  }

  return result;
}

async function deleteExpiredBackups(prisma, cutoff) {
  const expired = await prisma.backupSnapshot.findMany({
    where: { createdAt: { lt: cutoff } },
    orderBy: { createdAt: "asc" }
  });

  let backupsDeleted = 0;
  const backupErrors = [];

  for (const backup of expired) {
    try {
      await rm(backupPath(backup.fileName), { force: true });
      const deleted = await prisma.backupSnapshot.deleteMany({
        where: { id: backup.id }
      });
      backupsDeleted += deleted.count;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      backupErrors.push({ backupId: backup.id, fileName: backup.fileName, message });
      console.error("BACKUP_RETENTION_DELETE_FAILED", {
        backupId: backup.id,
        fileName: backup.fileName,
        message
      });
    }
  }

  return { backupsDeleted, backupErrors };
}
