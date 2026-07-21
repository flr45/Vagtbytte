import Link from "next/link";
import { UserRole } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
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
    activeUsers,
    activePushDevices,
    latestWorkerHeartbeat,
    pushStatusCounts,
    latestPushDeliveries,
    latestOrdinaryPushDelivery
  ] = await Promise.all([
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
    })
  ]);
  const workerLastActive = latestWorkerHeartbeat?.createdAt ?? null;
  const workerStale = isWorkerStale(workerLastActive);
  const buildVersion = process.env.RENDER_GIT_COMMIT?.slice(0, 12) ?? process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ?? "Ikke oplyst";

  return (
    <>
      <TopBar title="Systemstatus" />
      <main className="mx-auto grid w-full max-w-4xl gap-6 px-4 py-6">
        <Link className="focus-ring w-fit rounded-md px-2 py-2 text-sm font-semibold text-zinc-700" href="/admin">
          Tilbage til administration
        </Link>
        <section className="rounded-lg border border-brand-line bg-white p-5 shadow-sm">
          <h1 className="text-3xl font-bold">Systemstatus</h1>
          <p className="mt-2 text-sm text-zinc-600">Kun ufølsomme driftsoplysninger vises her.</p>
        </section>
        <section className="grid gap-3 sm:grid-cols-2">
          <StatusCard label="Databaseforbindelse" value={databaseOk ? "OK" : "Fejl"} ok={databaseOk} />
          <StatusCard label="Web-push konfigureret" value={isWebPushConfigured(process.env) ? "Ja" : "Nej"} ok={isWebPushConfigured(process.env)} />
          <StatusCard
            label="Notifikations-worker"
            value={workerLastActive ? formatDateTime(workerLastActive) : "Ikke registreret"}
            ok={!workerStale}
            warning={workerStale ? "Workeren har ikke været aktiv inden for forventet interval." : undefined}
          />
          <StatusCard label="Aktive brugere" value={String(activeUsers)} ok />
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
                <p>Publiceret: {latestOrdinaryPushDelivery.notification.publishedAt ? formatDateTime(latestOrdinaryPushDelivery.notification.publishedAt) : "Nej"}</p>
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
                value={String(pushStatusCounts.find((item) => item.status === status)?._count.status ?? 0)}
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
                  <tr className="border-b border-brand-line" key={`${delivery.status}-${delivery.createdAt.toISOString()}`}>
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

function StatusCard({ label, value, ok, warning }: { label: string; value: string; ok: boolean; warning?: string }) {
  return (
    <article className="rounded-lg border border-brand-line bg-white p-4 shadow-sm">
      <p className="text-sm font-semibold text-zinc-600">{label}</p>
      <p className={`mt-2 text-2xl font-bold ${ok ? "text-emerald-800" : "text-red-800"}`}>{value}</p>
      {warning ? <p className="mt-2 rounded-md bg-red-50 p-2 text-sm font-semibold text-red-900">{warning}</p> : null}
    </article>
  );
}
