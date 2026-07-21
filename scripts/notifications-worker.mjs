import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { publishDueNotifications } from "./notification-worker-core.mjs";

const prisma = new PrismaClient();
const intervalMs = Number(process.env.NOTIFICATIONS_WORKER_INTERVAL_MS ?? 15000);

console.log(`Notifikations-worker startet. Interval: ${intervalMs} ms.`);

async function tick() {
  try {
    const result = await publishDueNotifications(prisma);
    await prisma.auditLog.create({
      data: {
        action: "NOTIFICATION_WORKER_HEARTBEAT",
        description: "Notifikations-worker var aktiv"
      }
    });
    if (result.published || result.cancelled || result.completedShiftEndTransfers) {
      console.log(
        `Publiceret: ${result.published}. Annulleret: ${result.cancelled}. Vagtslut afsluttet: ${result.completedShiftEndTransfers ?? 0}.`
      );
    }
  } catch (error) {
    console.error("Worker-fejl:", error instanceof Error ? error.message : String(error));
  }
}

await tick();
const timer = setInterval(tick, intervalMs);

async function shutdown(signal) {
  console.log(`Notifikations-worker lukker ned (${signal}).`);
  clearInterval(timer);
  await prisma.$disconnect();
  process.exit(0);
}

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});
