import { PrismaClient } from "@prisma/client";
import { sendEmailReportNow } from "./email-report-core.mjs";

const prisma = new PrismaClient();

async function main() {
  const [command, scheduleId = "monthly-summary"] = process.argv.slice(2);
  if (command !== "send-now") {
    throw new Error("Brug: email-report-cli.mjs send-now [scheduleId]");
  }
  const result = await sendEmailReportNow(prisma, scheduleId, new Date());
  console.log(JSON.stringify(result));
  if (result.failed) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
