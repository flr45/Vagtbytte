import { PrismaClient } from "@prisma/client";
import { publishDueNotifications } from "./notification-worker-core.mjs";
import { monitorSmsGateway } from "./system-monitor.mjs";
import { runAutomaticBackupIfDue } from "./backup-core.mjs";
import { processDueEmailReports } from "./email-report-core.mjs";

const prisma = new PrismaClient();

function positiveInterval(value, fallback, name) {
  const parsed = Number(value ?? fallback);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    console.warn(`${name} er ugyldig. Bruger standardværdien ${fallback} ms.`);
    return fallback;
  }
  return parsed;
}

const intervalMs = positiveInterval(
  process.env.NOTIFICATIONS_WORKER_INTERVAL_MS,
  15000,
  "NOTIFICATIONS_WORKER_INTERVAL_MS"
);
const heartbeatIntervalMs = positiveInterval(
  process.env.NOTIFICATIONS_WORKER_HEARTBEAT_MS,
  300000,
  "NOTIFICATIONS_WORKER_HEARTBEAT_MS"
);
const smsGatewayMonitorIntervalMs = positiveInterval(
  process.env.SMS_GATEWAY_MONITOR_INTERVAL_MS,
  60000,
  "SMS_GATEWAY_MONITOR_INTERVAL_MS"
);
const backupMonitorIntervalMs = positiveInterval(
  process.env.BACKUP_MONITOR_INTERVAL_MS,
  300000,
  "BACKUP_MONITOR_INTERVAL_MS"
);
const emailReportMonitorIntervalMs = positiveInterval(
  process.env.EMAIL_REPORT_MONITOR_INTERVAL_MS,
  60000,
  "EMAIL_REPORT_MONITOR_INTERVAL_MS"
);

let timer = null;
let activeRun = null;
let stopping = false;
let lastHeartbeatAt = 0;
let lastSmsGatewayCheckAt = 0;
let lastBackupCheckAt = 0;
let lastEmailReportCheckAt = 0;

console.log(
  `Notifikations-worker startet. Interval: ${intervalMs} ms. Heartbeat: ${heartbeatIntervalMs} ms. SMS-overvågning: ${smsGatewayMonitorIntervalMs} ms. Backupkontrol: ${backupMonitorIntervalMs} ms. Mailrapport: ${emailReportMonitorIntervalMs} ms.`
);

async function tick() {
  try {
    const now = Date.now();

    if (now - lastSmsGatewayCheckAt >= smsGatewayMonitorIntervalMs) {
      const monitorResult = await monitorSmsGateway(prisma, new Date(now));
      lastSmsGatewayCheckAt = now;
      if (monitorResult.changed) {
        console.log(`SMS_GATEWAY_STATE_CHANGED: ${monitorResult.state}`);
      }
    }

    if (now - lastBackupCheckAt >= backupMonitorIntervalMs) {
      const backupResult = await runAutomaticBackupIfDue(prisma, new Date(now));
      lastBackupCheckAt = now;
      if (backupResult.created) {
        console.log(`AUTOMATIC_BACKUP_CREATED: ${backupResult.backup.fileName}`);
      } else if (backupResult.error) {
        console.error(`AUTOMATIC_BACKUP_FAILED: ${backupResult.error}`);
      }
    }

    if (now - lastEmailReportCheckAt >= emailReportMonitorIntervalMs) {
      const emailResult = await processDueEmailReports(prisma, new Date(now));
      lastEmailReportCheckAt = now;
      if (emailResult.sent || emailResult.failed) {
        console.log(`EMAIL_REPORTS: sendt=${emailResult.sent}, fejl=${emailResult.failed}`);
      }
    }

    const result = await publishDueNotifications(prisma);

    if (now - lastHeartbeatAt >= heartbeatIntervalMs) {
      await prisma.auditLog.create({
        data: {
          action: "NOTIFICATION_WORKER_HEARTBEAT",
          description: "Notifikations-worker var aktiv"
        }
      });
      lastHeartbeatAt = now;
    }

    if (result.published || result.cancelled || result.completedShiftEndTransfers) {
      console.log(
        `Publiceret: ${result.published}. Annulleret: ${result.cancelled}. Vagtslut backfill: ${result.backfilledShiftEndTransfers ?? 0}. Afsluttet aktiv: ${result.completedShiftEndTransfersFromActive ?? 0}. Afsluttet afventer start: ${result.completedShiftEndTransfersFromAwaitingActivation ?? 0}. Fejl: ${result.shiftEndErrors ?? 0}.`
      );
    }
  } catch (error) {
    console.error("Worker-fejl:", error instanceof Error ? error.message : String(error));
  }
}

async function runLoop() {
  if (stopping) {
    return;
  }

  await tick();

  if (!stopping) {
    timer = setTimeout(() => {
      activeRun = runLoop();
    }, intervalMs);
  }
}

async function shutdown(signal) {
  if (stopping) {
    return;
  }

  stopping = true;
  console.log(`Notifikations-worker lukker ned (${signal}).`);

  if (timer) {
    clearTimeout(timer);
    timer = null;
  }

  if (activeRun) {
    await activeRun;
  }

  await prisma.$disconnect();
  process.exit(0);
}

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});

activeRun = runLoop();
