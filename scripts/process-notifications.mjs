import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { publishDueNotifications } from "./notification-worker-core.mjs";

const prisma = new PrismaClient();

try {
  const result = await publishDueNotifications(prisma);
  console.log(`Notifikationer behandlet. Publiceret: ${result.published}. Annulleret: ${result.cancelled}.`);
} finally {
  await prisma.$disconnect();
}
