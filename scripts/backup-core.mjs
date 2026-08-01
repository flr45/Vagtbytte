import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { gzip, gunzip } from "node:zlib";
import { promisify } from "node:util";
import {
  decryptStoredBackup,
  encryptCompressedBackup,
  isEncryptedBackup,
  isLegacyGzipBackup,
  loadBackupEncryptionKey
} from "./backup-crypto.mjs";

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);

export const BACKUP_FORMAT = "vagtbytte-backup";
export const BACKUP_VERSION = 1;

function backupDirectory() {
  return process.env.BACKUP_DIRECTORY || "/data/backups";
}

function automaticBackupHour() {
  const parsed = Number(process.env.BACKUP_AUTO_HOUR ?? 3);
  return Number.isInteger(parsed) && parsed >= 0 && parsed <= 23 ? parsed : 3;
}

function automaticRetention() {
  const parsed = Number(process.env.BACKUP_RETENTION_COUNT ?? 30);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 365 ? parsed : 30;
}

function localParts(date, timeZone = "Europe/Copenhagen") {
  return Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23"
    })
      .formatToParts(date)
      .map((part) => [part.type, part.value])
  );
}

function compactTimestamp(date) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function automaticFileName(date) {
  const parts = localParts(date);
  return `automatic-${parts.year}-${parts.month}-${parts.day}.vagtbackup.enc`;
}

function manualFileName(date) {
  return `manual-${compactTimestamp(date)}-${randomUUID().slice(0, 8)}.vagtbackup.enc`;
}

export async function collectBackupData(prisma, generatedAt = new Date()) {
  const [
    users,
    availabilities,
    shiftTransfers,
    returnRequests,
    notifications,
    pushSubscriptions,
    pushDeliveries,
    alarms,
    alarmMessages,
    alarmStatistics,
    auditLogs,
    emailReportSchedules,
    emailReportDeliveries
  ] = await Promise.all([
    prisma.user.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.availability.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.shiftTransfer.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.returnRequest.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.notification.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.pushSubscription.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.pushDelivery.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.alarm.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.alarmMessage.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.alarmStatistic.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.auditLog.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.emailReportSchedule.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.emailReportDelivery.findMany({ orderBy: { createdAt: "asc" } })
  ]);

  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    generatedAt: generatedAt.toISOString(),
    application: "Vagtbytte",
    tables: {
      users,
      availabilities,
      shiftTransfers,
      returnRequests,
      notifications,
      pushSubscriptions,
      pushDeliveries,
      alarms,
      alarmMessages,
      alarmStatistics,
      auditLogs,
      emailReportSchedules,
      emailReportDeliveries
    }
  };
}

export async function createBackup(prisma, input = {}) {
  const now = input.now instanceof Date ? input.now : new Date();
  const kind = input.kind === "AUTOMATIC" ? "AUTOMATIC" : "MANUAL";
  const fileName = kind === "AUTOMATIC" ? automaticFileName(now) : manualFileName(now);
  const directory = backupDirectory();
  const filePath = path.join(directory, fileName);

  await mkdir(directory, { recursive: true });

  if (kind === "AUTOMATIC") {
    const existing = await prisma.backupSnapshot.findUnique({ where: { fileName } });
    if (existing?.status === "READY") {
      return { created: false, backup: existing };
    }
  }

  try {
    const encryptionKey = await loadBackupEncryptionKey();
    const data = await collectBackupData(prisma, now);
    const json = Buffer.from(JSON.stringify(data), "utf8");
    const compressed = await gzipAsync(json, { level: 9 });
    const encrypted = encryptCompressedBackup(compressed, encryptionKey);
    await writeFile(filePath, encrypted, { mode: 0o600 });
    const checksum = createHash("sha256").update(encrypted).digest("hex");
    const fileStats = await stat(filePath);
    const backup = await prisma.backupSnapshot.upsert({
      where: { fileName },
      update: {
        kind,
        status: "READY",
        sizeBytes: Number(fileStats.size),
        sha256: checksum,
        errorMessage: null,
        createdByUserId: input.createdByUserId ?? null,
        createdAt: now
      },
      create: {
        kind,
        status: "READY",
        fileName,
        sizeBytes: Number(fileStats.size),
        sha256: checksum,
        createdByUserId: input.createdByUserId ?? null,
        createdAt: now
      }
    });

    if (kind === "AUTOMATIC") {
      await pruneAutomaticBackups(prisma);
    }

    await prisma.auditLog.create({
      data: {
        actorUserId: input.createdByUserId ?? null,
        actorRole: input.actorRole ?? null,
        action: kind === "AUTOMATIC" ? "BACKUP_AUTOMATIC_CREATED" : "BACKUP_MANUAL_CREATED",
        description: `${kind === "AUTOMATIC" ? "Automatisk" : "Manuel"} krypteret backup blev oprettet: ${fileName}`
      }
    }).catch(() => null);

    return { created: true, backup };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await rm(filePath, { force: true }).catch(() => null);
    const failed = await prisma.backupSnapshot.upsert({
      where: { fileName },
      update: {
        kind,
        status: "FAILED",
        sizeBytes: 0,
        sha256: null,
        errorMessage: message,
        createdByUserId: input.createdByUserId ?? null,
        createdAt: now
      },
      create: {
        kind,
        status: "FAILED",
        fileName,
        sizeBytes: 0,
        errorMessage: message,
        createdByUserId: input.createdByUserId ?? null,
        createdAt: now
      }
    });
    return { created: false, backup: failed, error: message };
  }
}

export async function runAutomaticBackupIfDue(prisma, now = new Date()) {
  if (String(process.env.BACKUP_DISABLED ?? "false").toLowerCase() === "true") {
    return { due: false, reason: "disabled" };
  }

  const parts = localParts(now);
  if (Number(parts.hour) < automaticBackupHour()) {
    return { due: false, reason: "too-early" };
  }

  const fileName = automaticFileName(now);
  const existing = await prisma.backupSnapshot.findUnique({ where: { fileName } });
  if (existing?.status === "READY") {
    return { due: false, reason: "already-created", backup: existing };
  }

  const result = await createBackup(prisma, { kind: "AUTOMATIC", now });
  return { due: true, ...result };
}

export async function readBackupFile(filePath) {
  const stored = await readFile(filePath);
  let compressed;
  let encrypted = false;

  if (isEncryptedBackup(stored)) {
    const encryptionKey = await loadBackupEncryptionKey();
    compressed = decryptStoredBackup(stored, encryptionKey);
    encrypted = true;
  } else if (isLegacyGzipBackup(stored)) {
    compressed = stored;
  } else {
    throw new Error("Filen er ikke en understøttet Vagtbytte-backup.");
  }

  let json;
  try {
    json = await gunzipAsync(compressed);
  } catch {
    throw new Error("Backupfilens komprimerede indhold er beskadiget.");
  }

  let parsed;
  try {
    parsed = JSON.parse(json.toString("utf8"));
  } catch {
    throw new Error("Backupfilens data er ikke gyldig JSON.");
  }

  validateBackup(parsed);
  return { parsed, stored, encrypted };
}

export async function restoreBackup(prisma, filePath, input = {}) {
  const { parsed, stored, encrypted } = await readBackupFile(filePath);
  if (input.expectedSha256) {
    const actual = createHash("sha256").update(stored).digest("hex");
    if (actual !== input.expectedSha256) {
      throw new Error("Backupfilens kontrolsum stemmer ikke.");
    }
  }

  const tables = parsed.tables;
  await prisma.$transaction(
    async (tx) => {
      await tx.pushDelivery.deleteMany();
      await tx.notification.deleteMany();
      await tx.pushSubscription.deleteMany();
      await tx.returnRequest.deleteMany();
      await tx.shiftTransfer.deleteMany();
      await tx.availability.deleteMany();
      await tx.alarmMessage.deleteMany();
      await tx.alarm.deleteMany();
      await tx.alarmStatistic.deleteMany();
      await tx.auditLog.deleteMany();
      await tx.emailReportDelivery.deleteMany();
      await tx.emailReportSchedule.deleteMany();
      await tx.session.deleteMany();
      await tx.loginAttempt.deleteMany();
      await tx.user.deleteMany();

      await createMany(tx.user, tables.users);
      await createMany(tx.alarm, tables.alarms);
      await createMany(tx.alarmStatistic, tables.alarmStatistics);
      await createMany(tx.alarmMessage, tables.alarmMessages);
      await createMany(tx.availability, tables.availabilities);
      await createMany(tx.shiftTransfer, tables.shiftTransfers);
      await createMany(tx.returnRequest, tables.returnRequests);
      await createMany(tx.emailReportSchedule, tables.emailReportSchedules);
      await createMany(tx.emailReportDelivery, tables.emailReportDeliveries);
      await createMany(tx.notification, tables.notifications);
      await createMany(tx.pushSubscription, tables.pushSubscriptions);
      await createMany(tx.pushDelivery, tables.pushDeliveries);
      await createMany(tx.auditLog, tables.auditLogs);
    },
    { maxWait: 15000, timeout: 180000 }
  );

  const actorExists = input.createdByUserId
    ? await prisma.user.findUnique({ where: { id: input.createdByUserId }, select: { id: true } })
    : null;
  await prisma.auditLog.create({
    data: {
      actorUserId: actorExists?.id ?? null,
      actorRole: actorExists ? input.actorRole ?? null : null,
      action: "BACKUP_RESTORED",
      description: `${encrypted ? "Krypteret" : "Ældre ukrypteret"} backup fra ${parsed.generatedAt} blev gendannet${input.actorName ? ` af ${input.actorName}` : ""}`
    }
  });

  return {
    generatedAt: parsed.generatedAt,
    encrypted,
    restoredTables: Object.fromEntries(
      Object.entries(tables).map(([name, rows]) => [name, Array.isArray(rows) ? rows.length : 0])
    )
  };
}

export function backupPath(fileName) {
  const validExtension =
    fileName?.endsWith(".vagtbackup.enc") || fileName?.endsWith(".vagtbackup.gz");
  if (!fileName || path.basename(fileName) !== fileName || !validExtension) {
    throw new Error("Ugyldigt backupfilnavn.");
  }
  return path.join(backupDirectory(), fileName);
}

async function pruneAutomaticBackups(prisma) {
  const backups = await prisma.backupSnapshot.findMany({
    where: { kind: "AUTOMATIC", status: "READY" },
    orderBy: { createdAt: "desc" }
  });
  const obsolete = backups.slice(automaticRetention());
  for (const backup of obsolete) {
    await rm(backupPath(backup.fileName), { force: true }).catch(() => null);
    await prisma.backupSnapshot.delete({ where: { id: backup.id } }).catch(() => null);
  }
}

async function createMany(model, rows) {
  if (!Array.isArray(rows) || rows.length === 0) return;
  await model.createMany({ data: rows });
}

function validateBackup(value) {
  if (!value || value.format !== BACKUP_FORMAT || value.version !== BACKUP_VERSION) {
    throw new Error("Filen er ikke en understøttet Vagtbytte-backup.");
  }
  if (!value.tables || !Array.isArray(value.tables.users)) {
    throw new Error("Backupfilen mangler nødvendige data.");
  }

  const optionalTables = [
    "availabilities",
    "shiftTransfers",
    "returnRequests",
    "notifications",
    "pushSubscriptions",
    "pushDeliveries",
    "alarms",
    "alarmMessages",
    "alarmStatistics",
    "auditLogs",
    "emailReportSchedules",
    "emailReportDeliveries"
  ];
  for (const table of optionalTables) {
    if (!Array.isArray(value.tables[table])) value.tables[table] = [];
  }
}
