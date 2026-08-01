import { NextResponse } from "next/server";
import {
  alarmArchiveCsv,
  listStoredAlarmsForExport,
  parseArchiveDate,
  type AlarmArchiveFilters
} from "@/lib/alarm-feed";
import { getCurrentUser } from "@/lib/auth";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || (user.role !== "ADMIN" && !user.hasAdminAccess)) {
    return NextResponse.json({ error: "Ingen adgang" }, { status: 403 });
  }

  const url = new URL(request.url);
  const filters: AlarmArchiveFilters = {
    query: url.searchParams.get("q") ?? undefined,
    station: url.searchParams.get("station") ?? undefined,
    from: parseArchiveDate(url.searchParams.get("fra")),
    to: parseArchiveDate(url.searchParams.get("til"), true),
    sort: url.searchParams.get("sortering") === "oldest" ? "oldest" : "newest",
    islOnly: url.searchParams.get("kunIsl") === "1"
  };
  const alarms = await listStoredAlarmsForExport(filters);
  const csv = alarmArchiveCsv(alarms);
  const date = new Date().toISOString().slice(0, 10);

  return new NextResponse(`\uFEFF${csv}`, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="alarmarkiv-${date}.csv"`,
      "Cache-Control": "no-store"
    }
  });
}
