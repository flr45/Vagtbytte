import Link from "next/link";
import { Prisma, UserRole } from "@prisma/client";
import { TopBar } from "@/components/TopBar";
import { formatDateTime } from "@/components/TransferSummary";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

type SearchParams = {
  q?: string | string[];
  fra?: string | string[];
  til?: string | string[];
  handling?: string | string[];
  side?: string | string[];
};

const ACTION_LABELS: Record<string, string> = {
  AVAILABILITY_CREATED: "Stillede sig til rådighed",
  AVAILABILITY_CANCELLED: "Annullerede tilgængelighed",
  AVAILABILITY_ASSIGNED: "Vagt tildelt",
  AVAILABILITY_ASSIGNMENT_REMOVED: "Tildeling fjernet",
  AVAILABILITY_ACKNOWLEDGED: "Tildeling bekræftet",
  AVAILABILITY_EXPIRED: "Tilgængelighed udløbet"
};

export default async function VcHistoryPage({
  searchParams
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireRole(UserRole.VC);
  const params = await searchParams;
  const query = one(params.q)?.trim() ?? "";
  const fromValue = one(params.fra) ?? "";
  const toValue = one(params.til) ?? "";
  const action = one(params.handling) ?? "";
  const requestedPage = Math.max(Number.parseInt(one(params.side) ?? "1", 10) || 1, 1);
  const matchingUsers = query
    ? await prisma.user.findMany({
        where: {
          OR: [
            { name: { contains: query, mode: "insensitive" } },
            { employeeNumber: { contains: query, mode: "insensitive" } }
          ]
        },
        select: { id: true }
      })
    : [];
  const createdAt: Prisma.DateTimeFilter = {};
  const from = parseDate(fromValue, false);
  const to = parseDate(toValue, true);
  if (from) createdAt.gte = from;
  if (to) createdAt.lte = to;
  const where: Prisma.AuditLogWhereInput = {
    availabilityId: { not: null },
    action: action ? action : { startsWith: "AVAILABILITY_" },
    ...(query ? { targetUserId: { in: matchingUsers.map((user) => user.id) } } : {}),
    ...(Object.keys(createdAt).length > 0 ? { createdAt } : {})
  };
  const total = await prisma.auditLog.count({ where });
  const totalPages = Math.max(Math.ceil(total / PAGE_SIZE), 1);
  const page = Math.min(requestedPage, totalPages);
  const logs = await prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    select: {
      id: true,
      action: true,
      description: true,
      createdAt: true,
      availabilityId: true,
      actor: { select: { name: true, role: true } },
      target: { select: { name: true, employeeNumber: true } }
    }
  });
  const availabilityIds = logs
    .map((log) => log.availabilityId)
    .filter((value): value is string => Boolean(value));
  const availabilities = await prisma.availability.findMany({
    where: { id: { in: availabilityIds } },
    select: {
      id: true,
      availableFrom: true,
      availableUntil: true,
      assignedShiftStart: true,
      assignedShiftEnd: true,
      assignedAt: true,
      status: true
    }
  });
  const availabilityMap = new Map(availabilities.map((item) => [item.id, item]));
  const preserved = new URLSearchParams();
  if (query) preserved.set("q", query);
  if (fromValue) preserved.set("fra", fromValue);
  if (toValue) preserved.set("til", toValue);
  if (action) preserved.set("handling", action);

  return (
    <>
      <TopBar title="VC-historik" />
      <main className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-6">
        <Link className="focus-ring w-fit rounded-md px-2 py-2 text-sm font-semibold text-zinc-700" href="/vagtcentral">
          Tilbage til vagtcentralen
        </Link>

        <section className="rounded-lg border border-brand-line bg-white p-5 shadow-sm">
          <h1 className="text-3xl font-black">Historik for tilgængelighed og tildelte vagter</h1>
          <p className="mt-2 text-sm font-semibold text-zinc-600">
            Se hvem der stillede sig til rådighed, hvem VC tildelte, og hvornår en tildeling blev fjernet.
          </p>
        </section>

        <section className="rounded-lg border border-brand-line bg-white p-4">
          <form className="grid gap-4 md:grid-cols-4" method="get">
            <label className="grid gap-2 text-sm font-bold text-zinc-700 md:col-span-2">
              Medarbejder
              <input
                className="focus-ring min-h-12 rounded-xl border border-zinc-200 px-4 text-base"
                defaultValue={query}
                name="q"
                placeholder="Navn eller medarbejdernummer"
                type="search"
              />
            </label>
            <label className="grid gap-2 text-sm font-bold text-zinc-700">
              Fra dato
              <input className="focus-ring min-h-12 rounded-xl border border-zinc-200 px-4 text-base" defaultValue={fromValue} name="fra" type="date" />
            </label>
            <label className="grid gap-2 text-sm font-bold text-zinc-700">
              Til dato
              <input className="focus-ring min-h-12 rounded-xl border border-zinc-200 px-4 text-base" defaultValue={toValue} name="til" type="date" />
            </label>
            <label className="grid gap-2 text-sm font-bold text-zinc-700 md:col-span-2">
              Handling
              <select className="focus-ring min-h-12 rounded-xl border border-zinc-200 bg-white px-4 text-base" defaultValue={action} name="handling">
                <option value="">Alle handlinger</option>
                <option value="AVAILABILITY_CREATED">Stillede sig til rådighed</option>
                <option value="AVAILABILITY_ASSIGNED">Vagt tildelt</option>
                <option value="AVAILABILITY_ASSIGNMENT_REMOVED">Tildeling fjernet</option>
                <option value="AVAILABILITY_CANCELLED">Tilgængelighed annulleret</option>
                <option value="AVAILABILITY_EXPIRED">Tilgængelighed udløbet</option>
              </select>
            </label>
            <div className="flex flex-wrap items-end gap-3 md:col-span-2">
              <button className="app-button-primary" type="submit">Anvend filtre</button>
              <Link className="app-button-secondary" href="/vagtcentral/historik">Nulstil</Link>
            </div>
          </form>
        </section>

        <section className="rounded-lg border border-brand-line bg-white p-4">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-black">Hændelser ({total})</h2>
            <p className="text-sm font-semibold text-zinc-600">Side {page} af {totalPages}</p>
          </div>
          {logs.length === 0 ? (
            <p className="text-sm font-semibold text-zinc-600">Ingen hændelser matcher filtrene.</p>
          ) : (
            <div className="grid gap-3">
              {logs.map((log) => {
                const availability = log.availabilityId
                  ? availabilityMap.get(log.availabilityId)
                  : null;
                return (
                  <article className="rounded-xl border border-zinc-200 bg-zinc-50 p-4" key={log.id}>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="font-black">{ACTION_LABELS[log.action] ?? log.action}</p>
                        <p className="mt-1 text-lg font-bold">{log.target?.name ?? "Ukendt medarbejder"}</p>
                        <p className="text-sm font-semibold text-zinc-600">
                          Medarbejdernummer: {log.target?.employeeNumber ?? "Ikke angivet"}
                        </p>
                      </div>
                      <time className="text-sm font-bold text-zinc-600" dateTime={log.createdAt.toISOString()}>
                        {formatDateTime(log.createdAt)}
                      </time>
                    </div>
                    <p className="mt-3 text-sm font-semibold text-zinc-700">{log.description}</p>
                    <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
                      <Info label="Udført af" value={log.actor?.name ?? "Systemet"} />
                      <Info label="Rolle" value={log.actor?.role === "VC" ? "Vagtcentral" : log.actor?.role ?? "System"} />
                      <Info
                        label="Til rådighed"
                        value={availability ? `${formatDateTime(availability.availableFrom)} → ${formatDateTime(availability.availableUntil)}` : "—"}
                      />
                      <Info
                        label="Tildelt vagt"
                        value={
                          availability?.assignedShiftStart && availability.assignedShiftEnd
                            ? `${formatDateTime(availability.assignedShiftStart)} → ${formatDateTime(availability.assignedShiftEnd)}`
                            : "—"
                        }
                      />
                    </dl>
                  </article>
                );
              })}
            </div>
          )}

          {totalPages > 1 ? (
            <nav className="mt-5 flex items-center justify-between gap-3">
              {page > 1 ? <Link className="app-button-secondary" href={pageHref(preserved, page - 1)}>Forrige</Link> : <span />}
              {page < totalPages ? <Link className="app-button-secondary" href={pageHref(preserved, page + 1)}>Næste</Link> : null}
            </nav>
          ) : null}
        </section>
      </main>
    </>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white p-3">
      <dt className="text-xs font-black uppercase text-zinc-500">{label}</dt>
      <dd className="mt-1 font-semibold text-zinc-800">{value}</dd>
    </div>
  );
}

function parseDate(value: string, endOfDay: boolean) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}${endOfDay ? "T23:59:59.999+02:00" : "T00:00:00.000+02:00"}`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function pageHref(filters: URLSearchParams, page: number) {
  const params = new URLSearchParams(filters);
  params.set("side", String(page));
  return `/vagtcentral/historik?${params.toString()}`;
}
