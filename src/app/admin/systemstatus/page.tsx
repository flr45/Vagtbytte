import Link from "next/link";
import { UserRole } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fetchSmsGatewayHealth, smsModemIsOnline } from "@/lib/sms-gateway-status";
import { isWebPushConfigured, isWorkerStale } from "@/lib/system-status";
import { TopBar } from "@/components/TopBar";
import { formatDateTime } from "@/components/TransferSummary";

export default async function AdminSystemStatusPage() {
  await requireRole(UserRole.ADMIN);

  let databaseOk = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    databaseOk = true;
  } catch {
    databaseOk = false;
  }

  const [
    smsGateway,
    activeUsers,
    activePushDevices,
    latestWorkerHeartbeat,
    pushStatusCounts,
    latestPushDeliveries,
    latestOrdinaryPushDelivery,
    latestAlarmMessage,
    latestPushError,
    latestSystemMonitorEvent
  ] = await Promise.all([
    fetchSmsGatewayHealth(),
    prisma.user.count({ where: { isActive: true } }),
    prisma.pushSubscription.count({ where: { revokedAt: null } }),
    prisma.auditLog.findFirst({
      where: { action: "NOTIFICATION_WORKER_HEARTBEAT" },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true }
    }),
    prisma.pushDelivery.groupBy({
      by: ["status"],
      _count: { status: true }
    }),
    prisma.pushDelivery.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        status: true,
        sentAt: true,
        failedAt: true,
        createdAt: true,
        lastError: true,
        notification: {
          select: {
            type: true,
            recipient: { select: { role: true } }
          }
        }
      }
    }),
    prisma.pushDelivery.findFirst({
      where: { notification: { type: { not: "TEST" } } },
      orderBy: { createdAt: "desc" },
      select: {
        status: true,
        sentAt: true,
        failedAt: true,
        createdAt: true,
        lastError: true,
        notification: {
          select: {
            type: true,
            publishedAt: true,
            recipient: { select: { role: true } }
          }
        }
      }
    }),
    prisma.alarmMessage.findFirst({
      orderBy: { receivedAt: "desc" },
      select: { receivedAt: true, senderNumber: true, alarm: { select: { stationCode: true } } }
    }),
    prisma.pushDelivery.findFirst({
      where: { status: { in: ["FAILED", "PERMANENT_FAILURE"] } },
      orderBy: { failedAt: "desc" },
      select: { failedAt: true, createdAt: true, lastError: true }
    }),
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

  const workerLastActive = latestWorkerHeartbeat?.createdAt ?? null;
  const workerStale = isWorkerStale(workerLastActive);
  const modemOnline = smsModemIsOnline(smsGateway);
  const gatewayOnline = smsGateway.reachable && smsGateway.gateway.database === "online";
  const vagtbytteForwardingOk =
    gatewayOnline && !smsGateway.gateway.lastVagtbytteError;
  const webPushConfigured = isWebPushConfigured(process.env);
  const buildVersion =
    process.env.RENDER_GIT_COMMIT?.slice(0, 12) ??
    process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ??
    process.env.GIT_COMMIT_SHA?.slice(0, 12) ??
    "Ikke oplyst";
  const latestError = selectLatestError({
    gatewayError: smsGateway.error,
    modemError: smsGateway.modem.lastError,
    forwardingError: smsGateway.gateway.lastVagtbytteError,
    forwardingErrorAt: smsGateway.gateway.lastVagtbytteErrorAt,
    pushError: latestPushError?.lastError ?? null,
    pushErrorAt: latestPushError?.failedAt ?? latestPushError?.createdAt ?? null
  });

  return (
    <>
      <TopBar title="Systemstatus" />
      <main className="mx-auto grid w-full max-w-5xl gap-6 px-4 py-6">
        <Link
          className="focus-ring w-fit rounded-md px-2 py-2 text-sm font-semibold text-zinc-700"
          href="/admin"
        >
          Tilbage til administration
        </Link>

        <section className="rounded-lg border border-brand-line bg-white p-5 shadow-sm">
          <h1 className="text-3xl font-bold">Systemstatus</h1>
          <p className="mt-2 text-sm text-zinc-600">
            Status opdateres, hver gang siden genindlæses. Telefonnummer og SMS-tekst vises ikke.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-black">Kritiske systemer</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <StatusCard
              label="SMS-gateway"
              value={smsGateway.reachable ? "Online" : "Offline"}
              ok={smsGateway.reachable}
              warning={smsGateway.error ?? undefined}
            />
            <StatusCard
              label="SMS-modem"
              value={modemOnline ? "Online" : smsGateway.modem.state}
              ok={modemOnline}
              warning={
                smsGateway.modem.stale
                  ? "Modemstatus er for gammel eller mangler."
                  : smsGateway.modem.lastError ?? undefined
              }
            />
            <StatusCard
              label="Gateway-database"
              value={smsGateway.gateway.database}
              ok={gatewayOnline}
            />
            <StatusCard
              label="SMS-gateway → Vagtbytte"
              value={vagtbytteForwardingOk ? "OK" : "Fejl"}
              ok={vagtbytteForwardingOk}
              warning={smsGateway.gateway.lastVagtbytteError ?? undefined}
            />
            <StatusCard
              label="Vagtbytte-database"
              value={databaseOk ? "Online" : "Fejl"}
              ok={databaseOk}
            />
            <StatusCard
              label="Notifikations-worker"
              value={workerLastActive ? formatDateTime(workerLastActive) : "Ikke registreret"}
              ok={!workerStale}
              warning={
                workerStale
                  ? "Workeren har ikke været aktiv inden for forventet interval."
                  : undefined
              }
            />
          </div>
        </section>

        <section className="rounded-lg border border-brand-line bg-white p-5 shadow-sm">
          <h2 className="text-xl font-black">Seneste aktivitet</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <InfoCard
              label="Seneste SMS hos gateway"
              value={formatOptionalDate(smsGateway.gateway.lastReceivedSmsAt)}
            />
            <InfoCard
              label="Seneste SMS i Vagtbytte"
              value={latestAlarmMessage ? formatDateTime(latestAlarmMessage.receivedAt) : "Ingen endnu"}
              detail={latestAlarmMessage?.alarm.stationCode ?? ""}
            />
            <InfoCard
              label="Seneste vellykkede videresendelse"
              value={formatOptionalDate(smsGateway.gateway.lastVagtbytteSuccessAt)}
            />
            <InfoCard
              label="Modemstatus opdateret"
              value={formatOptionalDate(smsGateway.modem.updatedAt)}
              detail={smsGateway.modem.device ?? ""}
            />
            <InfoCard label="Aktive brugere" value={String(activeUsers)} />
            <InfoCard label="Aktive push-enheder" value={String(activePushDevices)} />
          </div>
        </section>

        <section className="rounded-lg border border-brand-line bg-white p-5 shadow-sm">
          <h2 className="text-xl font-black">Seneste systemfejl</h2>
          {latestError ? (
            <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-4">
              <p className="font-black text-red-950">{latestError.source}</p>
              <p className="mt-1 break-words text-sm font-semibold text-red-900">
                {latestError.message}
              </p>
              <p className="mt-2 text-xs font-semibold text-red-700">
                {latestError.at ? formatDateTime(latestError.at) : "Tidspunkt ikke registreret"}
              </p>
            </div>
          ) : (
            <p className="mt-3 text-sm font-semibold text-emerald-800">
              Ingen aktuelle fejl registreret.
            </p>
          )}
          {latestSystemMonitorEvent ? (
            <div className="mt-4 rounded-lg bg-zinc-50 p-3 text-sm">
              <p className="font-bold">Seneste overvågningshændelse</p>
              <p className="mt-1">{latestSystemMonitorEvent.description}</p>
              <p className="mt-1 text-xs text-zinc-500">
                {formatDateTime(latestSystemMonitorEvent.createdAt)}
              </p>
            </div>
          ) : null}
        </section>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <StatusCard
            label="Web-push konfigureret"
            value={webPushConfigured ? "Ja" : "Nej"}
            ok={webPushConfigured}
          />
          <StatusCard label="Aktive push-enheder" value={String(activePushDevices)} ok />
          <StatusCard label="Build-version" value={buildVersion} ok />
        </section>

        <section className="rounded-lg border border-brand-line bg-white p-5 shadow-sm">
          <h2 className="text-xl font-bold">Pushlevering</h2>
          <div className="mt-3 rounded-md bg-zinc-50 p-3 text-sm text-zinc-700">
            <p className="font-bold text-zinc-950">Seneste almindelige push</p>
            {latestOrdinaryPushDelivery ? (
              <div className="mt-2 grid gap-1 break-words">
                <p>Type: {latestOrdinaryPushDelivery.notification.type}</p>
                <p>Modtagerrolle: {latestOrdinaryPushDelivery.notification.recipient.role}</p>
                <p>
                  Publiceret:{" "}
                  {latestOrdinaryPushDelivery.notification.publishedAt
                    ? formatDateTime(latestOrdinaryPushDelivery.notification.publishedAt)
                    : "Nej"}
                </p>
                <p>Status: {latestOrdinaryPushDelivery.status}</p>
                <p>Fejl: {latestOrdinaryPushDelivery.lastError ?? "-"}</p>
              </div>
            ) : (
              <p className="mt-2">Ingen almindelig push registreret endnu.</p>
            )}
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-4">
            {["SENT", "FAILED", "PERMANENT_FAILURE", "NO_ACTIVE_DEVICE"].map((status) => (
              <StatusCard
                key={status}
                label={status}
                ok={status === "SENT" || status === "NO_ACTIVE_DEVICE"}
                value={String(
                  pushStatusCounts.find((item) => item.status === status)?._count.status ?? 0
                )}
              />
            ))}
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-brand-line text-zinc-600">
                <tr>
                  <th className="py-2 pr-3">Tidspunkt</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Modtagerrolle</th>
                  <th className="py-2 pr-3">Type</th>
                  <th className="py-2 pr-3">Fejl</th>
                </tr>
              </thead>
              <tbody>
                {latestPushDeliveries.map((delivery) => (
                  <tr
                    className="border-b border-brand-line"
                    key={`${delivery.status}-${delivery.createdAt.toISOString()}`}
                  >
                    <td className="py-2 pr-3">
                      {formatDateTime(delivery.sentAt ?? delivery.failedAt ?? delivery.createdAt)}
                    </td>
                    <td className="py-2 pr-3 font-semibold">{delivery.status}</td>
                    <td className="py-2 pr-3">{delivery.notification.recipient.role}</td>
                    <td className="py-2 pr-3">{delivery.notification.type}</td>
                    <td className="py-2 pr-3">{delivery.lastError ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </>
  );
}

function StatusCard({
  label,
  value,
  ok,
  warning
}: {
  label: string;
  value: string;
  ok: boolean;
  warning?: string;
}) {
  return (
    <article className="rounded-lg border border-brand-line bg-white p-4 shadow-sm">
      <p className="text-sm font-semibold text-zinc-600">{label}</p>
      <p className={`mt-2 break-words text-2xl font-bold ${ok ? "text-emerald-800" : "text-red-800"}`}>
        {value}
      </p>
      {warning ? (
        <p className="mt-2 break-words rounded-md bg-red-50 p-2 text-sm font-semibold text-red-900">
          {warning}
        </p>
      ) : null}
    </article>
  );
}

function InfoCard({
  label,
  value,
  detail
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <article className="rounded-lg border border-zinc-100 bg-zinc-50 p-4">
      <p className="text-sm font-semibold text-zinc-600">{label}</p>
      <p className="mt-2 break-words text-lg font-black text-zinc-950">{value}</p>
      {detail ? <p className="mt-1 text-sm font-semibold text-zinc-500">{detail}</p> : null}
    </article>
  );
}

function formatOptionalDate(value: Date | null) {
  return value ? formatDateTime(value) : "Ikke registreret";
}

function selectLatestError(input: {
  gatewayError: string | null;
  modemError: string | null;
  forwardingError: string | null;
  forwardingErrorAt: Date | null;
  pushError: string | null;
  pushErrorAt: Date | null;
}) {
  const candidates = [
    input.gatewayError
      ? { source: "SMS-gateway", message: input.gatewayError, at: null as Date | null }
      : null,
    input.modemError
      ? { source: "SMS-modem", message: input.modemError, at: null as Date | null }
      : null,
    input.forwardingError
      ? {
          source: "Videresendelse til Vagtbytte",
          message: input.forwardingError,
          at: input.forwardingErrorAt
        }
      : null,
    input.pushError
      ? { source: "Pushlevering", message: input.pushError, at: input.pushErrorAt }
      : null
  ].filter((value): value is { source: string; message: string; at: Date | null } => Boolean(value));

  return candidates.sort((a, b) => (b.at?.getTime() ?? 0) - (a.at?.getTime() ?? 0))[0] ?? null;
}
