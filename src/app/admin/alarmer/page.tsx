import Link from "next/link";
import { UserRole } from "@prisma/client";
import { AdminAlarmManagement } from "@/components/AdminAlarmManagement";
import { TopBar } from "@/components/TopBar";
import { listStoredAlarmsPage } from "@/lib/alarm-feed";
import { requireRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

type PageProps = {
  searchParams: Promise<{ side?: string | string[] }>;
};

export default async function StoredAlarmsPage({ searchParams }: PageProps) {
  await requireRole(UserRole.ADMIN);
  const params = await searchParams;
  const rawPage = Array.isArray(params.side) ? params.side[0] : params.side;
  const requestedPage = Number.parseInt(rawPage ?? "1", 10);
  const archive = await listStoredAlarmsPage(requestedPage, PAGE_SIZE);

  return (
    <>
      <TopBar title="Gemte alarmer" />
      <main className="mx-auto grid w-full max-w-5xl gap-6 px-4 py-6">
        <Link
          className="focus-ring w-fit rounded-md px-2 py-2 text-sm font-semibold text-zinc-700"
          href="/admin"
        >
          Tilbage til administration
        </Link>

        <section className="rounded-lg border border-brand-line bg-white p-5 shadow-sm">
          <h1 className="text-3xl font-black">Alle gemte alarmer</h1>
          <p className="mt-2 text-sm font-semibold text-zinc-600">
            Alle modtagne alarmer gemmes. Brandmænd kan fortsat kun se de fem seneste.
          </p>
          <p className="mt-2 text-sm text-zinc-600">
            {archive.total.toLocaleString("da-DK")} {archive.total === 1 ? "alarm" : "alarmer"} gemt i alt.
          </p>
        </section>

        <section className="rounded-lg border border-brand-line bg-white p-4">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="font-bold">
              Side {archive.page} af {archive.totalPages}
            </p>
            <p className="text-sm font-semibold text-zinc-600">Op til {archive.pageSize} alarmer pr. side</p>
          </div>

          <AdminAlarmManagement
            alarms={archive.alarms.map((alarm) => ({
              id: alarm.id,
              stationCode: alarm.stationCode,
              openedAt: alarm.openedAt.toISOString(),
              messages: alarm.messages.map((message) => ({
                id: message.id,
                sequenceNumber: message.sequenceNumber,
                rawMessage: message.rawMessage,
                receivedAt: message.receivedAt.toISOString()
              }))
            }))}
          />

          {archive.totalPages > 1 ? (
            <nav className="mt-5 flex items-center justify-between gap-3" aria-label="Sider i alarmarkivet">
              {archive.page > 1 ? (
                <Link className="app-button-secondary" href={`/admin/alarmer?side=${archive.page - 1}`}>
                  Forrige side
                </Link>
              ) : (
                <span />
              )}

              {archive.page < archive.totalPages ? (
                <Link className="app-button-secondary" href={`/admin/alarmer?side=${archive.page + 1}`}>
                  Næste side
                </Link>
              ) : null}
            </nav>
          ) : null}
        </section>
      </main>
    </>
  );
}
