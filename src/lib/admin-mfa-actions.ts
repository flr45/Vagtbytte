"use server";

import { revalidatePath } from "next/cache";
import { UserRole } from "@prisma/client";
import { requireRole } from "./auth";
import { prisma } from "./prisma";

export async function resetUserMfaAction(formData: FormData) {
  const admin = await requireRole(UserRole.ADMIN);
  const userId = String(formData.get("userId") ?? "").trim();
  if (!userId || userId === admin.id) return;

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, mfaEnabled: true, loginIdentifier: true }
  });
  if (!target || target.loginIdentifier === "__deleted_user__") return;

  await prisma.$transaction([
    prisma.user.update({
      where: { id: target.id },
      data: {
        mfaEnabled: false,
        mfaSecretEncrypted: null,
        mfaRecoveryCodes: [],
        mfaEnrolledAt: null,
        mfaLastUsedStep: null
      }
    }),
    prisma.mfaChallenge.deleteMany({ where: { userId: target.id } }),
    prisma.session.deleteMany({ where: { userId: target.id } }),
    prisma.auditLog.create({
      data: {
        actorUserId: admin.id,
        actorRole: admin.role,
        action: "MFA_RESET_BY_ADMIN",
        targetUserId: target.id,
        description: "MFA blev nulstillet af administrator; alle aktive sessioner blev lukket"
      }
    })
  ]);

  revalidatePath("/admin/brugere");
}
