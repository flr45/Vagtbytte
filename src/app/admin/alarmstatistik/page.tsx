import Link from "next/link";
import { UserRole } from "@prisma/client";
import {
  loadAlarmStatisticsRows,
  summarizeAlarmStatistics,
  type AlarmStatisticsBucket
} from "@/lib/alarm-statistics";
import { requireRole } from "@/lib/auth";
import { AlarmStatisticsControls } from "@/components/AlarmStatisticsControls";
import { TopBar } from "@/components/TopBar";
import { formatDateTime } from "@/components/TransferSummary";

export default async function AlarmStatisticsPage() {
  await requireRole(UserRole.ADMIN);
  const { resetAt, rows } = await loadAlarmStatisticsRows();
  const summary = summarizeAlarmStatistics(rows);

  return (
    <>
      <TopBar title="Alarmstatistik" />
      <main className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-6">
        <Link
          className="focus-ring w-fit rounded-md px-2 py-2 text-sm font-semibold text-zinc-700"
          href="/admin"
        >
          Tilbage til administration
        </Link>

        <section className="rounded-lg border border-brand-line bg-white p-5 shadow-sm">
          <div className="grid gap-4 lg:grid-cols-[1fr_360px] lg:items-start">
            <div>
              <h1 className="text-3xl font-black">Alarmstatistik</h1>
              <p className="mt-2 text-sm font-semibold text-zinc-600">
                Statistikken beregnes i dansk tid og omfatter kun alarmer efter seneste nulstilling.
              </p>
              <p className="mt-2 text-sm text-zinc-600">
                Senest nulstillet: {resetAt ? formatDateTime(resetAt) : "Aldrig"}
              </p>
            </div>
            <AlarmStatisticsControls />
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Alarmer" value={String(summary.totalAlarms)} />
          <StatCard label="Sendinger" value={String(summary.totalMessages)} />
          <StatCard
            label="Gns. sendinger pr. alarm"
            value={summary.averageMessagesPerAlarm.toLocaleString("da-DK", {
              minimumFractionDigits: 1,
              maximumFractionDigits: 1
            })}
          />
          <StatCard
            label="Travleste tidspunkt"
            value={summary.busiestHour?.label ?? "Ingen data"}
            detail={
              summary.busiestHour
                ? `${summary.busiestHour.count} alarmer`
                : undefined
            }
          />
        </section>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Almindelige alarmer" value={String(summary.ordinaryAlarms)} />
          <StatCard label="ISL-alarmer" value={String(summary.islAlarms)} />
          <StatCard label="Ukendt station" value={String(summary.unknownAlarms)} />
          <StatCard
            label="Travleste ugedag"
            value={summary.busiestWeekday?.label ?? "Ingen data"}
            detail={
              summary.busiestWeekday
                ? `${summary.busiestWeekday.count} alarmer`
                : undefined
            }
          />
        </section>

        <StatisticsChart title="Alarmer pr. station" buckets={summary.byStation} />
        <StatisticsChart title="Alarmer pr. ugedag" buckets={summary.byWeekday} />
        <StatisticsChart
          compact
          title="Alarmer pr. time"
          buckets={summary.byHour}
        />

        <section className="rounded-lg border border-brand-line bg-white p-5 shadow-sm">
          <h2 className="text-xl font-black">Seneste statistiske registreringer</h2>
          {rows.length === 0 ? (
            <p className="mt-3 text-sm font-semibold text-zinc-600">
              Der er endnu ingen alarmer efter seneste nulstilling.
            </p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="border-b border-brand-line text-zinc-600">
                  <tr>
                    <th className="py-2 pr-3">Åbnet</th>
                    <th className="py-2 pr-3">Station</th>
                    <th className="py-2 pr-3">Sendinger</th>
                    <th className="py-2 pr-3">Seneste sending</th>
                  </tr>
                </thead>
                <tbody>
                  {[...rows].reverse().slice(0, 20).map((row) => (
                    <tr className="border-b border-brand-line" key={row.alarmId}>
                      <td className="py-2 pr-3">{formatDateTime(row.openedAt)}</td>
                      <td className="py-2 pr-3 font-semibold">
                        {row.stationCode ?? "Ukendt"}
                      </td>
                      <td className="py-2 pr-3">{row.messageCount}</td>
                      <td className="py-2 pr-3">{formatDateTime(row.lastMessageAt)}</td>
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

function StatCard({
  label,
  value,
  detail
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <article className="rounded-lg border border-brand-line bg-white p-4 shadow-sm">
      <p className="text-sm font-semibold text-zinc-600">{label}</p>
      <p className="mt-2 break-words text-2xl font-black text-zinc-950">{value}</p>
      {detail ? <p className="mt-1 text-sm font-semibold text-zinc-500">{detail}</p> : null}
    </article>
  );
}

function StatisticsChart({
  title,
  buckets,
  compact = false
}: {
  title: string;
  buckets: AlarmStatisticsBucket[];
  compact?: boolean;
}) {
  const maximum = Math.max(1, ...buckets.map((bucket) => bucket.count));

  return (
    <section className="rounded-lg border border-brand-line bg-white p-5 shadow-sm">
      <h2 className="text-xl font-black">{title}</h2>
      <div className={`mt-4 grid gap-3 ${compact ? "sm:grid-cols-2 lg:grid-cols-4" : ""}`}>
        {buckets.map((bucket) => (
          <div className="grid gap-1" key={bucket.key}>
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="font-semibold text-zinc-700">{bucket.label}</span>
              <span className="font-black text-zinc-950">{bucket.count}</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-zinc-100" aria-hidden="true">
              <div
                className="h-full rounded-full bg-brand-red"
                style={{ width: `${(bucket.count / maximum) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
