import { UserRole } from "@prisma/client";
import { alarmStatisticsCsv, loadAlarmStatisticsRows } from "@/lib/alarm-statistics";
import { requireRole } from "@/lib/auth";

export async function GET() {
  await requireRole(UserRole.ADMIN);
  const { rows } = await loadAlarmStatisticsRows();
  const csv = `\uFEFF${alarmStatisticsCsv(rows)}`;
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Copenhagen",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="alarmstatistik-${date}.csv"`,
      "Cache-Control": "no-store"
    }
  });
}
