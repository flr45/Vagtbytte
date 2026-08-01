"use server";

import { revalidatePath } from "next/cache";
import { UserRole } from "@prisma/client";
import { ALARM_STATISTICS_RESET_ACTION } from "./alarm-statistics";
import { requireRole } from "./auth";
import { prisma } from "./prisma";

export type AlarmStatisticsActionState = {
  ok?: boolean;
  message?: string;
};

export async function resetAlarmStatisticsAction(
  _state: AlarmStatisticsActionState,
  _formData: FormData
): Promise<AlarmStatisticsActionState> {
  const admin = await requireRole(UserRole.ADMIN);
  const resetAt = new Date();

  await prisma.auditLog.create({
    data: {
      actorUserId: admin.id,
      actorRole: admin.role,
      action: ALARM_STATISTICS_RESET_ACTION,
      description: `Alarmstatistikken blev nulstillet ${resetAt.toISOString()}`
    }
  });

  revalidatePath("/admin");
  revalidatePath("/admin/alarmstatistik");
  return { ok: true, message: "Alarmstatistikken er nulstillet." };
}
