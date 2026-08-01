import Link from "next/link";
import { UserRole } from "@prisma/client";
import { AdminAlarmManagement } from "@/components/AdminAlarmManagement";
import { TopBar } from "@/components/TopBar";
import {
  listStoredAlarmsPage,
  parseArchiveDate,
  type AlarmArchiveFilters
} from "@/lib/alarm-feed";
import { requireRole } from "@/lib/auth";
import { STATIONS } from "@/lib/stations";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

type ArchiveSearchParams = {
  side?: string | string[];
  q?: string | string[];
  station?: string | string[];
  fra?: string | string[];
  til?: string | string[];
  sortering?: string | string[];
  kunIsl?: string | string[];
};

type PageProps = {
  searchParams: Promise<ArchiveSearchParams>;
};

export default async function StoredAlarmsPage({ searchParams }: PageProps) {
  await requireRole(UserRole.ADMIN);
  const params = await searchParams;
  const requestedPage = Number.parseInt(one(params.side) ?? "1", 10);
  const query = one(params.q) ?? "";
  const station = one(params.station) ?? "";
  const fromValue = one(params.fra) ?? "";
  const toValue = one(params.til) ?? "";
  const sort = one(params.sortering) === "oldest" ? "oldest" : "newest";
  const islOnly = one(params.kunIsl) === "1";
  const filters: AlarmArchiveFilters = {
    query,
    station,
    from: parseArchiveDate(fromValue),
    to: parseArchiveDate(toValue, true),
    sort,
    islOnly
  };
  const archive = await listStoredAlarmsPage(requestedPage, PAGE_SIZE, filters);
  const filterParams = new URLSearchParams();
  if (query) filterParams.set("q", query);
  if (station) filterParams.set("station", station);
  if (fromValue) filterParams.set("fra", fromValue);
  if (toValue) filterParams.set("til", toValue);
  if (sort === "oldest") filterParams.set("sortering", "oldest");
  if (islOnly) filterParams.set("kunIsl", "1");
  const exportParams = filterParams.toString();

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
            Søg i alarmtekster, filtrer efter station og periode, eller eksportér det viste resultat.
          </p>
          <p className="mt-2 text-sm text-zinc-600">
            {archive.total.toLocaleString("da-DK")} {archive.total === 1 ? "alarm matcher" : "alarmer matcher"}.
          </p>
        </section>

        <section className="rounded-lg border border-brand-line bg-white p-4">
          <form className="grid gap-4" method="get">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-2 text-sm font-bold text-zinc-700 md:col-span-2">
                Søg i alarmtekst
                <input
                  className="focus-ring min-h-12 rounded-xl border border-zinc-200 px-4 text-base"
                  defaultValue={query}
                  name="q"
                  placeholder="Eksempel: bygningsbrand, vejnavn eller alarm-id"
                  type="search"
                />
              </label>

              <label className="grid gap-2 text-sm font-bold text-zinc-700">
                Station
                <select
                  className="focus-ring min-h-12 rounded-xl border border-zinc-200 bg-white px-4 text-base"
                  defaultValue={station}
                  name="station"
                >
                  <option value="">Alle stationer</option>
                  {STATIONS.map((item) => (
                    <option key={item.code} value={item.code}>
                      {item.label}
                    </option>
                  ))}
                  <option value="UNKNOWN">Ukendt station</option>
                </select>
              </label>

              <label className="grid gap-2 text-sm font-bold text-zinc-700">
                Sortering
                <select
                  className="focus-ring min-h-12 rounded-xl border border-zinc-200 bg-white px-4 text-base"
                  defaultValue={sort}
                  name="sortering"
                >
                  <option value="newest">Nyeste først</option>
                  <option value="oldest">Ældste først</option>
                </select>
              </label>

              <label className="grid gap-2 text-sm font-bold text-zinc-700">
                Fra dato
                <input
                  className="focus-ring min-h-12 rounded-xl border border-zinc-200 px-4 text-base"
                  defaultValue={fromValue}
                  name="fra"
                  type="date"
                />
              </label>

              <label className="grid gap-2 text-sm font-bold text-zinc-700">
                Til dato
                <input
                  className="focus-ring min-h-12 rounded-xl border border-zinc-200 px-4 text-base"
                  defaultValue={toValue}
                  name="til"
                  type="date"
                />
              </label>
            </div>

            <label className="flex min-h-11 items-center gap-3 rounded-lg border border-zinc-200 bg-zinc-50 px-4 font-semibold">
              <input defaultChecked={islOnly} name="kunIsl" type="checkbox" value="1" />
              Vis kun ISL-alarmer
            </label>

            <div className="flex flex-wrap gap-3">
              <button className="app-button-primary" type="submit">
                Anvend filtre
              </button>
              <Link className="app-button-secondary" href="/admin/alarmer">
                Nulstil filtre
              </Link>
              <a
                className="app-button-secondary"
                href={`/api/admin/alarmer/export${exportParams ? `?${exportParams}` : ""}`}
              >
                Eksportér resultat til CSV
              </a>
            </div>
          </form>
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
                <Link className="app-button-secondary" href={pageHref(filterParams, archive.page - 1)}>
                  Forrige side
                </Link>
              ) : (
                <span />
              )}

              {archive.page < archive.totalPages ? (
                <Link className="app-button-secondary" href={pageHref(filterParams, archive.page + 1)}>
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

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function pageHref(filters: URLSearchParams, page: number) {
  const params = new URLSearchParams(filters);
  params.set("side", String(page));
  return `/admin/alarmer?${params.toString()}`;
}
