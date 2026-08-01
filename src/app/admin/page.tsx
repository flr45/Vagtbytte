import { UserRole } from "@prisma/client";
import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { listRecentAlarms } from "@/lib/alarm-feed";
import { prisma } from "@/lib/prisma";
import { STATIONS, stationLabel } from "@/lib/stations";
import { AdminAlarmManagement } from "@/components/AdminAlarmManagement";
import { TopBar } from "@/components/TopBar";
import { CreateFirefighterForm, FirefighterEditForms, VcForm } from "@/components/AdminForms";
import { formatDateTime } from "@/components/TransferSummary";

export default async function AdminPage() {
  await requireRole(UserRole.ADMIN);

  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [
    users,
    vc,
    auditLogs,
    totalAlarms,
    alarmsLastDay,
    alarmsLastWeek,
    alarmsLastMonth,
    messageAggregate,
    stationStatistics,
    recentAlarms
  ] = await Promise.all([
    prisma.user.findMany({
      where: {
        role: UserRole.BRANDFIGHTER,
        loginIdentifier: { not: "__deleted_user__" }
      },
      orderBy: [{ stationCode: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        employeeNumber: true,
        loginIdentifier: true,
        isActive: true,
        stationCode: true,
        alarmStations: true,
        hasAdminAccess: true
      }
    }),
    prisma.user.findFirst({
      where: { role: UserRole.VC },
      select: { loginIdentifier: true, isActive: true }
    }),
    prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      select: { id: true, action: true, description: true, createdAt: true }
    }),
    prisma.alarmStatistic.count(),
    prisma.alarmStatistic.count({ where: { openedAt: { gte: oneDayAgo } } }),
    prisma.alarmStatistic.count({ where: { openedAt: { gte: sevenDaysAgo } } }),
    prisma.alarmStatistic.count({ where: { openedAt: { gte: thirtyDaysAgo } } }),
    prisma.alarmStatistic.aggregate({ _sum: { messageCount: true } }),
    prisma.alarmStatistic.groupBy({
      by: ["stationCode"],
      _count: { _all: true },
      orderBy: { _count: { stationCode: "desc" } }
    }),
    listRecentAlarms(5)
  ]);

  return (
    <>
      <TopBar title="Administration" />
      <main className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-6">
        <section>
          <h1 className="text-3xl font-bold">Administration</h1>
          <p className="mt-2 text-base text-zinc-700">
            Administrer brugere, stationer, alarmer og vagtcentralens fælles login.
          </p>
          <Link
            className="focus-ring mt-4 inline-flex min-h-12 items-center justify-center rounded-md border border-zinc-300 px-5 font-semibold text-zinc-900"
            href="/admin/systemstatus"
          >
            Se systemstatus
          </Link>
        </section>

        <section className="rounded-lg border border-brand-line bg-white p-4">
          <h2 className="text-xl font-bold">Alarmstatistik</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <StatCard label="Alle alarmer" value={totalAlarms} />
            <StatCard label="Seneste døgn" value={alarmsLastDay} />
            <StatCard label="Seneste 7 dage" value={alarmsLastWeek} />
            <StatCard label="Seneste 30 dage" value={alarmsLastMonth} />
            <StatCard label="Sendinger i alt" value={messageAggregate._sum.messageCount ?? 0} />
          </div>
          <details className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50">
            <summary className="focus-ring cursor-pointer rounded-lg px-4 py-3 font-bold">
              Fordeling på stationer
            </summary>
            <div className="grid gap-2 border-t border-zinc-200 p-4 sm:grid-cols-2 lg:grid-cols-3">
              {STATIONS.map((station) => {
                const row = stationStatistics.find((item) => item.stationCode === station.code);
                return (
                  <div className="rounded-lg bg-white p-3" key={station.code}>
                    <p className="font-bold">{station.label}</p>
                    <p className="text-2xl font-black">{row?._count._all ?? 0}</p>
                  </div>
                );
              })}
              {stationStatistics
                .filter((item) => !STATIONS.some((station) => station.code === item.stationCode))
                .map((item) => (
                  <div className="rounded-lg bg-white p-3" key={item.stationCode ?? "unknown"}>
                    <p className="font-bold">{stationLabel(item.stationCode)}</p>
                    <p className="text-2xl font-black">{item._count._all}</p>
                  </div>
                ))}
            </div>
          </details>
        </section>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]">
          <section className="grid content-start gap-4">
            <div>
              <h2 className="text-xl font-bold">Brugere</h2>
              <p className="mt-1 text-sm text-zinc-600">
                Åbn en station og tryk derefter på brugerens navn for at redigere.
              </p>
            </div>
            <FirefighterEditForms users={users} />
          </section>

          <aside className="grid content-start gap-6">
            <CreateFirefighterForm />
            <VcForm vc={vc} />
          </aside>
        </div>

        <section className="rounded-lg border border-brand-line bg-white p-4">
          <div>
            <h2 className="text-xl font-bold">Gemte alarmer</h2>
            <p className="mt-1 text-sm text-zinc-600">
              Systemet gemmer højst de fem seneste alarmer. Alarmstatistikken bevares, når en alarm slettes.
            </p>
          </div>
          <div className="mt-4">
            <AdminAlarmManagement
              alarms={recentAlarms.map((alarm) => ({
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
          </div>
        </section>

        <section className="rounded-lg border border-brand-line bg-white p-4">
          <h2 className="text-xl font-bold">Revisionslog</h2>
          <div className="mt-4 grid gap-3">
            {auditLogs.length === 0 ? (
              <p className="text-sm text-zinc-600">Ingen handlinger er logget endnu.</p>
            ) : (
              auditLogs.map((log) => (
                <article key={log.id} className="border-b border-zinc-100 pb-3">
                  <p className="text-sm font-bold">{log.action}</p>
                  <p className="mt-1 text-sm text-zinc-700">{log.description}</p>
                  <p className="mt-1 text-xs text-zinc-500">{formatDateTime(log.createdAt)}</p>
                </article>
              ))
            )}
          </div>
        </section>
      </main>
    </>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-zinc-100 bg-zinc-50 p-4">
      <p className="text-sm font-semibold text-zinc-600">{label}</p>
      <p className="mt-1 text-3xl font-black text-zinc-950">{value}</p>
    </div>
  );
}
