import Link from "next/link";
import type { ShiftTransfer } from "@prisma/client";
import { formatDateTime, StatusBadge } from "./TransferSummary";

export function VcTransferList({
  title,
  emptyText,
  transfers
}: {
  title: string;
  emptyText: string;
  transfers: ShiftTransfer[];
}) {
  return (
    <section className="grid gap-3">
      <h2 className="text-xl font-bold">{title}</h2>
      {transfers.length === 0 ? (
        <p className="rounded-lg border border-brand-line bg-white p-4 text-sm text-zinc-600">{emptyText}</p>
      ) : (
        <div className="grid gap-3">
          {transfers.map((transfer) => (
            <Link
              className="focus-ring grid gap-3 rounded-lg border border-brand-line bg-white p-4 shadow-sm"
              href={`/vagtcentral/sager/${transfer.id}`}
              key={transfer.id}
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="font-bold">{transfer.transferNumber}</p>
                <StatusBadge status={transfer.status} />
              </div>
              <p className="text-sm text-zinc-700">
                Afgiver: {transfer.giverNameSnapshot} - {transfer.giverEmployeeNumberSnapshot}
              </p>
              <p className="text-sm text-zinc-700">
                Overtager: {transfer.receiverNameSnapshot} - {transfer.receiverEmployeeNumberSnapshot}
              </p>
              <p className="text-sm text-zinc-700">Start: {formatDateTime(transfer.requestedStartAt)}</p>
              {transfer.expectedEndAt ? (
                <p className="text-sm text-zinc-700">
                  Forventet sluttid: {formatDateTime(transfer.expectedEndAt)}
                </p>
              ) : null}
              {transfer.comment ? <p className="text-sm text-zinc-700">Kommentar fra A: {transfer.comment}</p> : null}
              {transfer.receiverRespondedAt ? (
                <p className="text-sm text-zinc-700">
                  B accepterede: {formatDateTime(transfer.receiverRespondedAt)}
                </p>
              ) : null}
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
