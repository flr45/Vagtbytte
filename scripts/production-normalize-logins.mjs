import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function normalizeLoginIdentifier(value) {
  return String(value).trim().toLowerCase();
}

try {
  const users = await prisma.user.findMany({
    select: { id: true, loginIdentifier: true }
  });
  const groups = new Map();
  for (const user of users) {
    const normalized = normalizeLoginIdentifier(user.loginIdentifier);
    groups.set(normalized, [...(groups.get(normalized) ?? []), user]);
  }

  const conflicts = [...groups.entries()].filter(([, items]) => items.length > 1);
  if (conflicts.length > 0) {
    console.error(
      `Login-normalisering stoppet. Konflikter: ${conflicts
        .map(([loginIdentifier, items]) => `${loginIdentifier} (${items.map((item) => item.id).join(", ")})`)
        .join("; ")}`
    );
    process.exitCode = 1;
  } else {
    let updated = 0;
    for (const user of users) {
      const normalized = normalizeLoginIdentifier(user.loginIdentifier);
      if (normalized !== user.loginIdentifier) {
        await prisma.user.update({
          where: { id: user.id },
          data: { loginIdentifier: normalized }
        });
        updated += 1;
      }
    }
    console.log(`Login-normalisering fuldført. Opdateret: ${updated}.`);
  }
} finally {
  await prisma.$disconnect();
}
