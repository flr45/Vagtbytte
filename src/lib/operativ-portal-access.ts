import { UserRole } from "@prisma/client";
import { prisma } from "./prisma";

export type OperationalPortalPrincipal = {
  role: UserRole;
  hasAdminAccess: boolean;
  hasOperationalPortalAccess?: boolean;
};

export function canManageOperationalPortal(user: OperationalPortalPrincipal | null | undefined) {
  return Boolean(user && (user.role === UserRole.ADMIN || user.hasAdminAccess));
}

export function canAccessOperationalPortal(user: OperationalPortalPrincipal | null | undefined) {
  return Boolean(
    user && (canManageOperationalPortal(user) || user.hasOperationalPortalAccess)
  );
}

export async function hasOperationalPortalGrant(userId: string) {
  const rows = await prisma.$queryRaw<Array<{ granted: boolean }>>`
    SELECT EXISTS(
      SELECT 1
      FROM operational_portal_user_access
      WHERE user_id = ${userId}
    ) AS granted
  `;

  return rows[0]?.granted ?? false;
}

export async function listOperationalPortalGrantUserIds() {
  const rows = await prisma.$queryRaw<Array<{ userId: string }>>`
    SELECT user_id AS "userId"
    FROM operational_portal_user_access
  `;

  return new Set(rows.map((row) => row.userId));
}

export async function setOperationalPortalGrant(userId: string, enabled: boolean) {
  if (enabled) {
    await prisma.$executeRaw`
      INSERT INTO operational_portal_user_access (user_id)
      VALUES (${userId})
      ON CONFLICT (user_id) DO NOTHING
    `;
    return;
  }

  await prisma.$executeRaw`
    DELETE FROM operational_portal_user_access
    WHERE user_id = ${userId}
  `;
}
