"use server";

import { revalidatePath } from "next/cache";
import { UserRole } from "@prisma/client";
import { z } from "zod";
import { requireRole } from "./auth";
import { prisma } from "./prisma";

export type AlarmAdminActionState = {
  ok?: boolean;
  message?: string;
};

const alarmIdSchema = z.object({ alarmId: z.string().min(1) });

export async function deleteAlarmAction(
  _state: AlarmAdminActionState,
  formData: FormData
): Promise<AlarmAdminActionState> {
  const admin = await requireRole(UserRole.ADMIN);
  const parsed = alarmIdSchema.safeParse({ alarmId: formData.get("alarmId") });

  if (!parsed.success) {
    return { ok: false, message: "Alarmen kunne ikke identificeres." };
  }

  const alarm = await prisma.alarm.findUnique({
    where: { id: parsed.data.alarmId },
    select: { id: true, stationCode: true, openedAt: true }
  });

  if (!alarm) {
    return { ok: false, message: "Alarmen findes ikke længere." };
  }

  await prisma.$transaction(async (tx) => {
    await tx.alarm.delete({ where: { id: alarm.id } });
    await tx.auditLog.create({
      data: {
        actorUserId: admin.id,
        actorRole: admin.role,
        action: "ALARM_DELETED",
        description: `Alarm ${alarm.id} (${alarm.stationCode ?? "ukendt station"}) blev slettet manuelt`
      }
    });
  });

  revalidatePath("/admin");
  revalidatePath("/admin/alarmer");
  revalidatePath("/brandmand/alarmer");
  return { ok: true, message: "Alarmen er slettet." };
}
