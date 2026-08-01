import { PrismaClient } from "@prisma/client";
import { createBackup, restoreBackup } from "./backup-core.mjs";

const prisma = new PrismaClient();

async function main() {
  const [command, ...args] = process.argv.slice(2);

  if (command === "create") {
    const kind = args[0] === "automatic" ? "AUTOMATIC" : "MANUAL";
    const createdByUserId = args[1] || null;
    const actorRole = args[2] || null;
    const result = await createBackup(prisma, { kind, createdByUserId, actorRole });
    console.log(JSON.stringify(result));
    if (result.error) process.exitCode = 1;
    return;
  }

  if (command === "restore") {
    const filePath = args[0];
    if (!filePath) throw new Error("Stien til backupfilen mangler.");
    const result = await restoreBackup(prisma, filePath, {
      createdByUserId: args[1] || null,
      actorRole: args[2] || null,
      actorName: args[3] || null,
      expectedSha256: args[4] || null
    });
    console.log(JSON.stringify(result));
    return;
  }

  throw new Error("Brug: backup-cli.mjs create manual|automatic [userId] [role] eller restore <fil> [userId] [role] [navn] [sha256]");
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
