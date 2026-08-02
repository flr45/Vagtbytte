import { UserRole } from "@prisma/client";
import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { listRecentAlarms } from "@/lib/alarm-feed";
import {
  loadAlarmStatisticsRows,
  summarizeAlarmStatistics
} from "@/lib/alarm-statistics";
import { prisma } from "@/lib/prisma";
import { AdminAlarmManagement } from "@/components/AdminAlarmManagement";
import { TopBar } from "@/components/TopBar";
import { CreateFirefighterForm, FirefighterEditForms, VcForm } from "@/components/AdminForms";
import { formatDateTime } from "@/components/TransferSummary";

export default async function AdminPage() {
  await requireRole(UserRole.ADMIN);

  const [users, vc, auditLogs, alarmStatistics, recentAlarms, latestSystemMonitorEvent] =
    await Promise.all([
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
          email: true,
          isActive: true,
          stationCode: true,
          alarmStations: true,
          receiveAlarmFollowUps: true,
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
      loadAlarmStatisticsRows(),
      listRecentAlarms(),
      prisma.auditLog.findFirst({
        where: {
          action: {
            in: ["SMS_GATEWAY_ONLINE", "SMS_GATEWAY_DEGRADED", "SMS_GATEWAY_OFFLINE"]
          }
        },
        orderBy: { createdAt: "desc" },
        select: { action: true, description: true, createdAt: true }
      })
    ]);
  const summary = summarizeAlarmStatistics(alarmStatistics.rows);
  const smsSystemHasProblem =
    latestSystemMonitorEvent && latestSystemMonitorEvent.action !== "SMS_GATEWAY_ONLINE";

  return (
    <>
      <TopBar title="Administration" />
      <main className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-6">
        <section>
          <h1 className="text-3xl font-bold">Administration</h1>
          <p className="mt-2 text-base text-zinc-700">
            Administrer brugere, stationer, alarmer, rapporter, backups og vagtcentralens fælles login.
          </p>
        </section>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <AdminLink href="/admin/systemstatus" title="Systemstatus" text="Modem, SMS-gateway, push og seneste fejl." />
          <AdminLink href="/admin/alarmstatistik" title="Alarmstatistik" text="Detaljer, grafer, CSV og nulstilling." />
          <AdminLink href="/admin/alarmer" title="Alarmarkiv" text="Søg, filtrer og eksportér alle gemte alarmer." />
          <AdminLink href="/admin/brugere" title="Brugeroverblik" text="Stationer, login, mail, adminadgang og push-enheder." />
          <AdminLink href="/admin/backups" title="Backup og gendannelse" text="Automatiske og manuelle backups samt restore." />
          <AdminLink href="/admin/mailrapporter" title="Mailrapporter" text="Planlæg samlet overblik over vagter og vagtbytter." />
        </section>

        {smsSystemHasProblem ? (
          <section className="rounded-lg border border-red-300 bg-red-50 p-4 shadow-sm" role="alert">
            <p className="text-lg font-black text-red-950">SMS-systemet kræver opmærksomhed</p>
            <p className="mt-1 break-words text-sm font-semibold text-red-900">
              {latestSystemMonitorEvent.description}
            </p>
            <p className="mt-2 text-xs font-semibold text-red-700">
              Registreret {formatDateTime(latestSystemMonitorEvent.createdAt)}
            </p>
            <Link className="app-button-danger mt-4" href="/admin/systemstatus">
              Åbn systemstatus
            </Link>
          </section>
        ) : null}

        <section className="rounded-lg border border-brand-line bg-white p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-xl font-bold">Alarmstatistik</h2>
              <p className="mt-1 text-sm text-zinc-600">
                Senest nulstillet: {alarmStatistics.resetAt ? formatDateTime(alarmStatistics.resetAt) : "Aldrig"}
              </p>
            </div>
            <Link className="app-button-secondary" href="/admin/alarmstatistik">
              Detaljer, eksport og nulstilling
            </Link>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <StatCard label="Alarmer" value={summary.totalAlarms} />
            <StatCard label="Sendinger" value={summary.totalMessages} />
            <StatCard label="ISL" value={summary.islAlarms} />
            <StatCard label="Ukendt station" value={summary.unknownAlarms} />
            <StatCard
              label="Gns. sendinger"
              value={Number(summary.averageMessagesPerAlarm.toFixed(1))}
            />
          </div>
          <details className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50">
            <summary className="focus-ring cursor-pointer rounded-lg px-4 py-3 font-bold">
              Fordeling på stationer
            </summary>
            <div className="grid gap-2 border-t border-zinc-200 p-4 sm:grid-cols-2 lg:grid-cols-3">
              {summary.byStation.map((station) => (
                <div className="rounded-lg bg-white p-3" key={station.key}>
                  <p className="font-bold">{station.label}</p>
                  <p className="text-2xl font-black">{station.count}</p>
                </div>
              ))}
            </div>
          </details>
        </section>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]">
          <section className="grid content-start gap-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-xl font-bold">Brugere</h2>
                <p className="mt-1 text-sm text-zinc-600">
                  Åbn en station og tryk derefter på brugerens navn for at redigere.
                </p>
              </div>
              <Link className="app-button-secondary" href="/admin/brugere">
                Åbn brugeroverblik
              </Link>
            </div>
            <FirefighterEditForms users={users} />
          </section>

          <aside className="grid content-start gap-6">
            <CreateFirefighterForm />
            <VcForm vc={vc} />
          </aside>
        </div>

        <section className="rounded-lg border border-brand-line bg-white p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-xl font-bold">Gemte alarmer</h2>
              <p className="mt-1 text-sm text-zinc-600">
                Alle alarmer gemmes. De fem seneste vises her, og kun administratorer har adgang til hele arkivet.
              </p>
            </div>
            <Link className="app-button-secondary" href="/admin/alarmer">
              Søg i hele alarmarkivet
            </Link>
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

function AdminLink({ href, title, text }: { href: string; title: string; text: string }) {
  return (
    <Link className="app-card-interactive grid gap-2" href={href}>
      <h2 className="text-lg font-black">{title}</h2>
      <p className="text-sm font-semibold text-zinc-600">{text}</p>
    </Link>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-zinc-100 bg-zinc-50 p-4">
      <p className="text-sm font-semibold text-zinc-600">{label}</p>
      <p className="mt-1 text-3xl font-black text-zinc-950">
        {value.toLocaleString("da-DK", { maximumFractionDigits: 1 })}
      </p>
    </div>
  );
}
