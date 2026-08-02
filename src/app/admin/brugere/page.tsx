import Link from "next/link";
import { Prisma, UserRole } from "@prisma/client";
import { TopBar } from "@/components/TopBar";
import { formatDateTime } from "@/components/TransferSummary";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { STATIONS, stationLabel } from "@/lib/stations";

export const dynamic = "force-dynamic";

type SearchParams = {
  q?: string | string[];
  station?: string | string[];
  status?: string | string[];
};

export default async function UserOverviewPage({
  searchParams
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireRole(UserRole.ADMIN);
  const params = await searchParams;
  const query = one(params.q)?.trim() ?? "";
  const station = one(params.station)?.trim() ?? "";
  const status = one(params.status)?.trim() ?? "";
  const baseWhere: Prisma.UserWhereInput = {
    role: UserRole.BRANDFIGHTER,
    loginIdentifier: { not: "__deleted_user__" }
  };
  const where: Prisma.UserWhereInput = {
    ...baseWhere,
    ...(station === "NONE" ? { stationCode: null } : station ? { stationCode: station } : {}),
    ...(status === "active"
      ? { isActive: true }
      : status === "inactive"
        ? { isActive: false }
        : status === "admin"
          ? { hasAdminAccess: true }
          : status === "no-email"
            ? { email: null }
            : status === "no-push"
              ? { pushSubscriptions: { none: { revokedAt: null } } }
              : status === "never-login"
                ? { lastLoginAt: null }
                : {}),
    ...(query
      ? {
          OR: [
            { name: { contains: query, mode: "insensitive" } },
            { employeeNumber: { contains: query, mode: "insensitive" } },
            { loginIdentifier: { contains: query, mode: "insensitive" } },
            { email: { contains: query, mode: "insensitive" } }
          ]
        }
      : {})
  };

  const [users, allUsers] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: [{ stationCode: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        employeeNumber: true,
        email: true,
        stationCode: true,
        isActive: true,
        hasAdminAccess: true,
        receiveAlarmFollowUps: true,
        lastLoginAt: true,
        createdAt: true,
        _count: {
          select: {
            pushSubscriptions: { where: { revokedAt: null } }
          }
        }
      }
    }),
    prisma.user.findMany({
      where: baseWhere,
      select: {
        stationCode: true,
        email: true,
        isActive: true,
        hasAdminAccess: true,
        lastLoginAt: true,
        _count: {
          select: {
            pushSubscriptions: { where: { revokedAt: null } }
          }
        }
      }
    })
  ]);

  const activeCount = allUsers.filter((user) => user.isActive).length;
  const adminCount = allUsers.filter((user) => user.hasAdminAccess).length;
  const missingEmailCount = allUsers.filter((user) => !user.email).length;
  const missingPushCount = allUsers.filter((user) => user._count.pushSubscriptions === 0).length;
  const neverLoggedInCount = allUsers.filter((user) => !user.lastLoginAt).length;

  return (
    <>
      <TopBar title="Brugeroverblik" />
      <main className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-6">
        <Link className="focus-ring w-fit rounded-md px-2 py-2 text-sm font-semibold text-zinc-700" href="/admin">
          Tilbage til administration
        </Link>

        <section className="rounded-lg border border-brand-line bg-white p-5 shadow-sm">
          <h1 className="text-3xl font-black">Brugeroverblik</h1>
          <p className="mt-2 text-sm font-semibold text-zinc-600">
            Se stationstilknytning, mail, opfølgende alarmsendinger, administratoradgang, push-enheder og seneste login.
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
            <Stat label="Brugere i alt" value={allUsers.length} />
            <Stat label="Aktive" value={activeCount} />
            <Stat label="Administratoradgang" value={adminCount} />
            <Stat label="Mangler mail" value={missingEmailCount} warning={missingEmailCount > 0} />
            <Stat label="Mangler push" value={missingPushCount} warning={missingPushCount > 0} />
            <Stat label="Aldrig logget ind" value={neverLoggedInCount} warning={neverLoggedInCount > 0} />
          </div>
        </section>

        <section className="rounded-lg border border-brand-line bg-white p-4">
          <h2 className="text-xl font-black">Brugere pr. station</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {STATIONS.map((item) => {
              const count = allUsers.filter((user) => user.stationCode === item.code).length;
              const active = allUsers.filter(
                (user) => user.stationCode === item.code && user.isActive
              ).length;
              return (
                <div className="rounded-lg border border-zinc-100 bg-zinc-50 p-4" key={item.code}>
                  <p className="font-black">{item.label}</p>
                  <p className="mt-1 text-2xl font-black">{count}</p>
                  <p className="text-sm font-semibold text-zinc-600">{active} aktive</p>
                </div>
              );
            })}
            <div className="rounded-lg border border-zinc-100 bg-zinc-50 p-4">
              <p className="font-black">Uden station</p>
              <p className="mt-1 text-2xl font-black">
                {allUsers.filter((user) => !user.stationCode).length}
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-brand-line bg-white p-4">
          <form className="grid gap-4 md:grid-cols-4" method="get">
            <label className="grid gap-2 text-sm font-bold text-zinc-700 md:col-span-2">
              Søg efter navn, medarbejdernummer eller mail
              <input
                className="focus-ring min-h-12 rounded-xl border border-zinc-200 px-4 text-base"
                defaultValue={query}
                name="q"
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
                  <option key={item.code} value={item.code}>{item.label}</option>
                ))}
                <option value="NONE">Uden station</option>
              </select>
            </label>
            <label className="grid gap-2 text-sm font-bold text-zinc-700">
              Status
              <select
                className="focus-ring min-h-12 rounded-xl border border-zinc-200 bg-white px-4 text-base"
                defaultValue={status}
                name="status"
              >
                <option value="">Alle</option>
                <option value="active">Aktive</option>
                <option value="inactive">Deaktiverede</option>
                <option value="admin">Administratoradgang</option>
                <option value="no-email">Mangler mail</option>
                <option value="no-push">Mangler push</option>
                <option value="never-login">Aldrig logget ind</option>
              </select>
            </label>
            <div className="flex flex-wrap gap-3 md:col-span-4">
              <button className="app-button-primary" type="submit">Anvend filtre</button>
              <Link className="app-button-secondary" href="/admin/brugere">Nulstil</Link>
            </div>
          </form>
        </section>

        <section className="overflow-hidden rounded-lg border border-brand-line bg-white">
          <div className="border-b border-brand-line p-4">
            <h2 className="text-xl font-black">Brugere ({users.length})</h2>
          </div>
          {users.length === 0 ? (
            <p className="p-5 text-sm font-semibold text-zinc-600">Ingen brugere matcher filtrene.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px] border-collapse text-left text-sm">
                <thead className="bg-zinc-50 text-xs uppercase text-zinc-600">
                  <tr>
                    <th className="px-4 py-3">Navn</th>
                    <th className="px-4 py-3">Medarbejdernummer</th>
                    <th className="px-4 py-3">Mail</th>
                    <th className="px-4 py-3">Station</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Sending 2+</th>
                    <th className="px-4 py-3">Admin</th>
                    <th className="px-4 py-3">Push-enheder</th>
                    <th className="px-4 py-3">Seneste login</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr className="border-t border-zinc-100" key={user.id}>
                      <td className="px-4 py-3 font-bold">{user.name}</td>
                      <td className="px-4 py-3 font-semibold">{user.employeeNumber ?? "—"}</td>
                      <td className="max-w-xs break-all px-4 py-3">
                        {user.email ? user.email : <span className="font-bold text-amber-700">Mangler</span>}
                      </td>
                      <td className="px-4 py-3">{stationLabel(user.stationCode)}</td>
                      <td className="px-4 py-3">
                        <span className={user.isActive ? "font-bold text-emerald-700" : "font-bold text-red-700"}>
                          {user.isActive ? "Aktiv" : "Deaktiveret"}
                        </span>
                      </td>
                      <td className="px-4 py-3">{user.receiveAlarmFollowUps ? "Ja" : "Nej"}</td>
                      <td className="px-4 py-3">{user.hasAdminAccess ? "Ja" : "Nej"}</td>
                      <td className="px-4 py-3">
                        <span className={user._count.pushSubscriptions > 0 ? "font-bold text-emerald-700" : "font-bold text-red-700"}>
                          {user._count.pushSubscriptions}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {user.lastLoginAt ? formatDateTime(user.lastLoginAt) : "Aldrig"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </>
  );
}

function Stat({ label, value, warning = false }: { label: string; value: number; warning?: boolean }) {
  return (
    <div className={warning ? "rounded-lg border border-amber-200 bg-amber-50 p-4" : "rounded-lg border border-zinc-100 bg-zinc-50 p-4"}>
      <p className="text-sm font-semibold text-zinc-600">{label}</p>
      <p className="mt-1 text-3xl font-black">{value}</p>
    </div>
  );
}

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
