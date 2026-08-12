"use server";

import { UserRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { requireRole } from "./auth";
import { prisma } from "./prisma";
import { vcSmsPhoneUpdateSchema } from "./validation";

export type VcSettingsActionState = {
  ok?: boolean;
  message?: string;
};

function firstError(error: unknown) {
  if (typeof error === "object" && error && "issues" in error) {
    const issues = (error as { issues?: Array<{ message: string }> }).issues;
    return issues?.[0]?.message ?? "Formularen er ikke udfyldt korrekt.";
  }
  return "Der opstod en fejl.";
}

export async function updateVcSmsPhoneAction(
  _state: VcSettingsActionState,
  formData: FormData
): Promise<VcSettingsActionState> {
  const admin = await requireRole(UserRole.ADMIN);
  const parsed = vcSmsPhoneUpdateSchema.safeParse({
    vcSmsPhoneNumber: formData.get("vcSmsPhoneNumber") ?? ""
  });

  if (!parsed.success) {
    return { ok: false, message: firstError(parsed.error) };
  }

  const vc = await prisma.user.findFirst({
    where: { role: UserRole.VC },
    select: { id: true }
  });
  if (!vc) {
    return { ok: false, message: "Opret VC-kontoen først." };
  }

  await prisma.user.update({
    where: { id: vc.id },
    data: { vcSmsPhoneNumber: parsed.data.vcSmsPhoneNumber }
  });
  await prisma.auditLog.create({
    data: {
      actorUserId: admin.id,
      actorRole: admin.role,
      action: "VC_SMS_PHONE_UPDATED",
      targetUserId: vc.id,
      description: parsed.data.vcSmsPhoneNumber
        ? "VC SMS-nummer blev opdateret"
        : "VC SMS-varsling blev slået fra"
    }
  });

  revalidatePath("/admin");
  return parsed.data.vcSmsPhoneNumber
    ? { ok: true, message: "VC SMS-nummeret er gemt." }
    : { ok: true, message: "VC SMS-varsling er slået fra." };
}
