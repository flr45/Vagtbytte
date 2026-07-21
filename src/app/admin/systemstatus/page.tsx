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

  const [activeUsers, activePushDevices, latestWorkerHeartbeat] = await Promise.all([
    prisma.user.count({ where: { isActive: true } }),
    prisma.pushSubscription.count({ where: { revokedAt: null } }),
    prisma.auditLog.findFirst({
      where: { action: "NOTIFICATION_WORKER_HEARTBEAT" },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true }
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
