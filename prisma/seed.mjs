import { PrismaClient, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

function envPassword(name, fallback) {
  return process.env[name] ?? fallback;
}

async function upsertUser(input) {
  const passwordHash = await bcrypt.hash(input.password, 12);

  return prisma.user.upsert({
    where: { loginIdentifier: input.loginIdentifier },
    update: {
      name: input.name,
      role: input.role,
      employeeNumber: input.employeeNumber ?? null,
      passwordHash,
      isActive: true,
      mustChangePassword: false
    },
    create: {
      name: input.name,
      role: input.role,
      employeeNumber: input.employeeNumber ?? null,
      loginIdentifier: input.loginIdentifier,
      passwordHash,
      isActive: true,
      mustChangePassword: false
    }
  });
}

async function main() {
  const admin = await upsertUser({
    name: "Administrator",
    role: UserRole.ADMIN,
    loginIdentifier: "admin",
    password: envPassword("SEED_ADMIN_PASSWORD", "Admin123!")
  });

  const vc = await upsertUser({
    name: "Vagtcentralen",
    role: UserRole.VC,
    loginIdentifier: "vc",
    password: envPassword("SEED_VC_PASSWORD", "Vc123456!")
  });

  const firefighterPassword = envPassword("SEED_FIREFIGHTER_PASSWORD", "Brand123!");

  await upsertUser({
    name: "Frederik Racher",
    role: UserRole.BRANDFIGHTER,
    employeeNumber: "1001",
    loginIdentifier: "1001",
    password: firefighterPassword
  });

  await upsertUser({
    name: "Test Brandmand",
    role: UserRole.BRANDFIGHTER,
    employeeNumber: "1002",
    loginIdentifier: "1002",
    password: firefighterPassword
  });

  await prisma.auditLog.createMany({
    data: [
      {
        actorUserId: admin.id,
        actorRole: UserRole.ADMIN,
        action: "SEED_ADMIN",
        targetUserId: admin.id,
        description: "Udviklings-admin er oprettet eller opdateret"
      },
      {
        actorUserId: admin.id,
        actorRole: UserRole.ADMIN,
        action: "SEED_VC",
        targetUserId: vc.id,
        description: "Udviklingskonto for vagtcentral er oprettet eller opdateret"
      }
    ]
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
