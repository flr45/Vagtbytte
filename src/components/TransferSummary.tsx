import Link from "next/link";
import type { ExpectedEndMode, TransferStatus } from "@prisma/client";
import { expectedEndLabel, statusLabel } from "@/lib/transfer-rules";

export type TransferSummaryItem = {
  id: string;
  transferNumber: string;
  status: TransferStatus;
  requestedStartAt: Date;
  expectedEndMode: ExpectedEndMode;
  expectedEndAt: Date | null;
  calculatedShiftEndAt?: Date | null;
  comment: string | null;
  receiverResponseComment: string | null;
  vcDecision?: string | null;
  vcComment?: string | null;
  cancelledAt?: Date | null;
  cancellationReason?: string | null;
  counterpartName: string;
  counterpartEmployeeNumber: string;
};

export function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("da-DK", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Europe/Copenhagen"
  }).format(date);
}

export function StatusBadge({ status }: { status: TransferStatus }) {
  const tone: Record<TransferStatus, string> = {
    AWAITING_RECEIVER: "border-amber-200 bg-amber-50 text-amber-900",
    RECEIVER_ACCEPTED_AWAITING_VC: "border-sky-200 bg-sky-50 text-sky-900",
    RECEIVER_REJECTED: "border-red-200 bg-red-50 text-red-900",
    VC_REJECTED: "border-red-200 bg-red-50 text-red-900",
    VC_APPROVED_AWAITING_ACTIVATION: "border-emerald-200 bg-emerald-50 text-emerald-900",
    VC_APPROVED_ACTIVE: "border-emerald-200 bg-emerald-50 text-emerald-900",
    RETURN_AWAITING_ORIGINAL: "border-amber-200 bg-amber-50 text-amber-900",
    RETURN_ACCEPTED_AWAITING_VC: "border-sky-200 bg-sky-50 text-sky-900",
    RETURN_APPROVED_AWAITING_EXECUTION: "border-emerald-200 bg-emerald-50 text-emerald-900",
    COMPLETED: "border-zinc-200 bg-zinc-100 text-zinc-700",
    CANCELLED: "border-zinc-200 bg-zinc-100 text-zinc-700"
  };

  return (
    <span className={`inline-flex w-fit rounded-full border px-3 py-1 text-sm font-bold shadow-sm transition-colors ${tone[status]}`}>
      {statusLabel(status)}
    </span>
  );
}

export function TransferList({
  title,
  emptyText,
  transfers
}: {
  title: string;
  emptyText: string;
  transfers: TransferSummaryItem[];
}) {
  return (
    <section className="grid gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-bold">{title}</h2>
        {transfers.length > 0 ? (
          <span className="rounded-full bg-zinc-200 px-2.5 py-1 text-xs font-black text-zinc-700">
            {transfers.length}
          </span>
        ) : null}
      </div>
      {transfers.length === 0 ? (
        <p className="rounded-2xl border border-zinc-200 bg-white p-4 text-sm font-semibold text-zinc-600">
          {emptyText}
        </p>
      ) : (
        <div className="grid gap-3">
          {transfers.map((transfer) => (
            <Link
              className="focus-ring app-card-interactive fade-in grid gap-4"
              href={`/brandmand/anmodninger/${transfer.id}`}
              key={transfer.id}
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-lg font-black">{transfer.transferNumber}</p>
                <StatusBadge status={transfer.status} />
              </div>

              <div>
                <p className="text-xs font-black uppercase tracking-wide text-zinc-500">Modpart</p>
                <p className="mt-1 break-words text-base font-black text-zinc-950">
                  {transfer.counterpartName}
                </p>
                <p className="mt-0.5 text-sm font-semibold text-zinc-600">
                  Medarbejdernummer {transfer.counterpartEmployeeNumber}
                </p>
              </div>

              <dl className="grid gap-2 sm:grid-cols-2">
                <SummaryMetric label="Start" value={formatDateTime(transfer.requestedStartAt)} />
                <SummaryMetric
                  label="Forventet tilbagelevering"
                  value={expectedEndLabel(transfer, formatDateTime)}
                />
              </dl>

              {transfer.receiverResponseComment || transfer.cancellationReason || transfer.vcComment ? (
                <p className="rounded-xl bg-zinc-50 p-3 text-sm font-semibold leading-relaxed text-zinc-700">
                  {transfer.cancellationReason
                    ? `Annullering: ${transfer.cancellationReason}`
                    : transfer.receiverResponseComment
                      ? `Svar: ${transfer.receiverResponseComment}`
                      : `VC: ${transfer.vcComment}`}
                </p>
              ) : null}

              <p className="text-sm font-black text-brand-red">Åbn sag →</p>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

function SummaryMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-zinc-50 p-3">
      <dt className="text-xs font-black uppercase tracking-wide text-zinc-500">{label}</dt>
      <dd className="mt-1 text-sm font-bold text-zinc-900">{value}</dd>
    </div>
  );
}
