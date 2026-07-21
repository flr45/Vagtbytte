import bcrypt from "bcryptjs";
import { UserRole } from "@prisma/client";

export const requiredBootstrapEnv = [
  "BOOTSTRAP_ADMIN_USERNAME",
  "BOOTSTRAP_ADMIN_PASSWORD",
  "BOOTSTRAP_VC_USERNAME",
  "BOOTSTRAP_VC_PASSWORD"
];

export function validateBootstrapEnv(env) {
  const missing = requiredBootstrapEnv.filter((key) => !String(env[key] ?? "").trim());
  if (missing.length > 0) {
    return { ok: false, message: `Manglende bootstrap-variabler: ${missing.join(", ")}` };
  }

  if (env.BOOTSTRAP_ADMIN_USERNAME === env.BOOTSTRAP_VC_USERNAME) {
    return { ok: false, message: "Admin og VC skal have forskellige login." };
  }

  return { ok: true };
}

export async function canBootstrapProductionUsers(prisma) {
  const existing = await prisma.user.count({
    where: {
      role: { in: [UserRole.ADMIN, UserRole.VC] }
    }
  });

  if (existing > 0) {
    return { ok: false, message: "Bootstrap er afvist, fordi admin eller VC allerede findes." };
  }

  return { ok: true };
}

export async function bootstrapProductionUsers(prisma, env) {
  const envCheck = validateBootstrapEnv(env);
  if (!envCheck.ok) {
    return envCheck;
  }

  const allowed = await canBootstrapProductionUsers(prisma);
  if (!allowed.ok) {
    return allowed;
  }

  const [adminPasswordHash, vcPasswordHash] = await Promise.all([
    bcrypt.hash(env.BOOTSTRAP_ADMIN_PASSWORD, 12),
    bcrypt.hash(env.BOOTSTRAP_VC_PASSWORD, 12)
  ]);

  const [admin, vc] = await prisma.$transaction([
    prisma.user.create({
      data: {
        name: "Administrator",
        role: UserRole.ADMIN,
        loginIdentifier: env.BOOTSTRAP_ADMIN_USERNAME,
        passwordHash: adminPasswordHash,
        isActive: true,
        mustChangePassword: true
      }
    }),
    prisma.user.create({
      data: {
        name: "Vagtcentralen",
        role: UserRole.VC,
        loginIdentifier: env.BOOTSTRAP_VC_USERNAME,
        passwordHash: vcPasswordHash,
        isActive: true,
        mustChangePassword: true
      }
    })
  ]);

  await prisma.auditLog.createMany({
    data: [
      {
        actorUserId: admin.id,
        actorRole: UserRole.ADMIN,
        action: "PRODUCTION_BOOTSTRAP_ADMIN",
        targetUserId: admin.id,
        description: "Første produktionsadmin blev oprettet"
      },
      {
        actorUserId: admin.id,
        actorRole: UserRole.ADMIN,
        action: "PRODUCTION_BOOTSTRAP_VC",
        targetUserId: vc.id,
        description: "Første produktionskonto for vagtcentral blev oprettet"
      }
    ]
  });

  return { ok: true, message: "Første admin og VC er oprettet." };
}
