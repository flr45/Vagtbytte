import Link from "next/link";
import { UserRole } from "@prisma/client";
import {
  EmailReportSettingsForm,
  SendEmailReportNowForm
} from "@/components/EmailReportForms";
import { TopBar } from "@/components/TopBar";
import { formatDateTime } from "@/components/TransferSummary";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const SCHEDULE_ID = "monthly-summary";

export default async function EmailReportsPage() {
  await requireRole(UserRole.ADMIN);
  const [schedule, deliveries] = await Promise.all([
    prisma.emailReportSchedule.findUnique({ where: { id: SCHEDULE_ID } }),
    prisma.emailReportDelivery.findMany({
      where: { scheduleId: SCHEDULE_ID },
      orderBy: { createdAt: "desc" },
      take: 20
    })
  ]);
  const configured = Boolean(process.env.SMTP_HOST && process.env.SMTP_FROM);
  const view = schedule ?? {
    name: "Samlet vagtoversigt",
    enabled: false,
    recipients: [],
    daysOfMonth: [1],
    sendHour: 8,
    sendMinute: 0,
    lastSentAt: null,
    lastAttemptAt: null,
    lastError: null
  };

  return (
    <>
      <TopBar title="Mailrapporter" />
      <main className="mx-auto grid w-full max-w-5xl gap-6 px-4 py-6">
        <Link className="focus-ring w-fit rounded-md px-2 py-2 text-sm font-semibold text-zinc-700" href="/admin">
          Tilbage til administration
        </Link>

        <section className="rounded-lg border border-brand-line bg-white p-5 shadow-sm">
          <h1 className="text-3xl font-black">Automatiske mailrapporter</h1>
          <p className="mt-2 text-sm font-semibold text-zinc-600">
            Send et samlet overblik over vagtbytter og tildelte vagter på selvvalgte dage hver måned.
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatusCard label="Automatik" value={view.enabled ? "Aktiv" : "Deaktiveret"} ok={view.enabled} />
            <StatusCard label="SMTP" value={configured ? "Konfigureret" : "Mangler"} ok={configured} />
            <StatusCard label="Senest sendt" value={view.lastSentAt ? formatDateTime(view.lastSentAt) : "Aldrig"} ok={Boolean(view.lastSentAt)} />
            <StatusCard label="Modtagere" value={String(view.recipients.length)} ok={view.recipients.length > 0} />
          </div>
          {view.lastError ? (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-900">
              Seneste fejl: {view.lastError}
            </div>
          ) : null}
        </section>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <EmailReportSettingsForm
            schedule={{
              name: view.name,
              enabled: view.enabled,
              recipients: view.recipients,
              daysOfMonth: view.daysOfMonth,
              sendHour: view.sendHour,
              sendMinute: view.sendMinute
            }}
            smtpConfigured={configured}
          />
          <aside className="grid content-start gap-4">
            <SendEmailReportNowForm disabled={!configured || view.recipients.length === 0} />
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
              <p className="font-black">SMTP-status</p>
              <dl className="mt-3 grid gap-2">
                <Info label="Server" value={process.env.SMTP_HOST ?? "Ikke angivet"} />
                <Info label="Afsender" value={process.env.SMTP_FROM ?? "Ikke angivet"} />
                <Info label="Godkendelse" value={process.env.SMTP_USER ? "Aktiveret" : "Ikke angivet"} />
              </dl>
            </div>
          </aside>
        </div>

        <section className="overflow-hidden rounded-lg border border-brand-line bg-white">
          <div className="border-b border-brand-line p-4">
            <h2 className="text-xl font-black">Afsendelseshistorik</h2>
          </div>
          {deliveries.length === 0 ? (
            <p className="p-5 text-sm font-semibold text-zinc-600">Der er endnu ikke forsøgt sendt en rapport.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px] border-collapse text-left text-sm">
                <thead className="bg-zinc-50 text-xs uppercase text-zinc-600">
                  <tr>
                    <th className="px-4 py-3">Oprettet</th>
                    <th className="px-4 py-3">Periode</th>
                    <th className="px-4 py-3">Modtagere</th>
                    <th className="px-4 py-3">Forsøg</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Fejl</th>
                  </tr>
                </thead>
                <tbody>
                  {deliveries.map((delivery) => (
                    <tr className="border-t border-zinc-100" key={delivery.id}>
                      <td className="px-4 py-3 font-semibold">{formatDateTime(delivery.createdAt)}</td>
                      <td className="px-4 py-3">
                        {formatDateTime(delivery.periodStart)} → {formatDateTime(delivery.periodEnd)}
                      </td>
                      <td className="px-4 py-3">{delivery.recipientCount}</td>
                      <td className="px-4 py-3">{delivery.attemptCount}</td>
                      <td className="px-4 py-3">
                        <span className={delivery.status === "SENT" ? "font-bold text-emerald-700" : delivery.status === "FAILED" ? "font-bold text-red-700" : "font-bold text-amber-700"}>
                          {delivery.status === "SENT" ? "Sendt" : delivery.status === "FAILED" ? "Fejlet" : "Afventer"}
                        </span>
                      </td>
                      <td className="max-w-sm break-words px-4 py-3 text-xs text-red-700">{delivery.errorMessage ?? "—"}</td>
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

function StatusCard({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className={ok ? "rounded-lg border border-emerald-200 bg-emerald-50 p-4" : "rounded-lg border border-amber-200 bg-amber-50 p-4"}>
      <p className="text-xs font-black uppercase text-zinc-600">{label}</p>
      <p className="mt-1 break-words text-lg font-black">{value}</p>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-black uppercase text-zinc-500">{label}</dt>
      <dd className="mt-1 break-words font-semibold">{value}</dd>
    </div>
  );
}
