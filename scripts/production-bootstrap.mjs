import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { bootstrapProductionUsers } from "./production-bootstrap-core.mjs";

const prisma = new PrismaClient();

try {
  const result = await bootstrapProductionUsers(prisma, process.env);
  if (!result.ok) {
    console.error(result.message);
    process.exitCode = 1;
  } else {
    console.log(result.message);
  }
} finally {
  await prisma.$disconnect();
}
