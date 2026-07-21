import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { publishDueNotifications } from "./notification-worker-core.mjs";

const prisma = new PrismaClient();

try {
  const result = await publishDueNotifications(prisma);
  console.log(
    `Notifikationer behandlet. Publiceret: ${result.published}. Annulleret: ${result.cancelled}. Vagtslut backfill: ${result.backfilledShiftEndTransfers ?? 0}. Afsluttet aktiv: ${result.completedShiftEndTransfersFromActive ?? 0}. Afsluttet afventer start: ${result.completedShiftEndTransfersFromAwaitingActivation ?? 0}. Fejl: ${result.shiftEndErrors ?? 0}.`
  );
} finally {
  await prisma.$disconnect();
}
