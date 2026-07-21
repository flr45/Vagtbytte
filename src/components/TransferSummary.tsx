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
    AWAITING_RECEIVER: "bg-amber-50 text-amber-900",
    RECEIVER_ACCEPTED_AWAITING_VC: "bg-emerald-50 text-emerald-900",
    RECEIVER_REJECTED: "bg-red-50 text-red-900",
    VC_REJECTED: "bg-red-50 text-red-900",
    VC_APPROVED_AWAITING_ACTIVATION: "bg-amber-50 text-amber-900",
    VC_APPROVED_ACTIVE: "bg-emerald-50 text-emerald-900",
    RETURN_AWAITING_ORIGINAL: "bg-amber-50 text-amber-900",
    RETURN_ACCEPTED_AWAITING_VC: "bg-emerald-50 text-emerald-900",
    RETURN_APPROVED_AWAITING_EXECUTION: "bg-amber-50 text-amber-900",
    COMPLETED: "bg-zinc-100 text-zinc-700",
    CANCELLED: "bg-zinc-100 text-zinc-700"
  };

  return (
    <span className={`inline-flex w-fit rounded-full px-3 py-1 text-sm font-semibold ${tone[status]}`}>
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
      <h2 className="text-xl font-bold">{title}</h2>
      {transfers.length === 0 ? (
        <p className="rounded-lg border border-brand-line bg-white p-4 text-sm text-zinc-600">
          {emptyText}
        </p>
      ) : (
        <div className="grid gap-3">
          {transfers.map((transfer) => (
            <Link
              className="focus-ring grid gap-3 rounded-lg border border-brand-line bg-white p-4 shadow-sm"
              href={`/brandmand/anmodninger/${transfer.id}`}
              key={transfer.id}
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="font-bold">{transfer.transferNumber}</p>
                <StatusBadge status={transfer.status} />
              </div>
              <p className="text-sm text-zinc-700">
                Modpart: {transfer.counterpartName} - {transfer.counterpartEmployeeNumber}
              </p>
              <p className="text-sm text-zinc-700">Start: {formatDateTime(transfer.requestedStartAt)}</p>
              <p className="text-sm text-zinc-700">
                Forventet tilbagelevering: {expectedEndLabel(transfer, formatDateTime)}
              </p>
              {transfer.comment ? <p className="text-sm text-zinc-700">Kommentar: {transfer.comment}</p> : null}
              {transfer.receiverResponseComment ? (
                <p className="text-sm text-zinc-700">Begrundelse: {transfer.receiverResponseComment}</p>
              ) : null}
              {transfer.vcDecision ? <p className="text-sm text-zinc-700">VC: {transfer.vcDecision}</p> : null}
              {transfer.vcComment ? <p className="text-sm text-zinc-700">VC-kommentar: {transfer.vcComment}</p> : null}
              {transfer.cancelledAt ? (
                <p className="text-sm text-zinc-700">Annulleret: {formatDateTime(transfer.cancelledAt)}</p>
              ) : null}
              {transfer.cancellationReason ? (
                <p className="text-sm text-zinc-700">Annulleringsbegrundelse: {transfer.cancellationReason}</p>
              ) : null}
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
