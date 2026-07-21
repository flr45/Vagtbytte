import { UserRole } from "@prisma/client";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canViewTransfer } from "@/lib/transfer-rules";
import { TopBar } from "@/components/TopBar";
import { TransferResponseForms } from "@/components/TransferResponseForms";
import { formatDateTime, StatusBadge } from "@/components/TransferSummary";

export default async function TransferDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const [{ id }, user] = await Promise.all([params, requireRole(UserRole.BRANDFIGHTER)]);
  const transfer = await prisma.shiftTransfer.findUnique({ where: { id } });

  if (!transfer) {
    redirect("/forbudt");
  }

  if (
    !canViewTransfer({
      userId: user.id,
      giverUserId: transfer.giverUserId,
      receiverUserId: transfer.receiverUserId
    })
  ) {
    await prisma.auditLog.create({
      data: {
        actorUserId: user.id,
        actorRole: user.role,
        action: "TRANSFER_VIEW_REJECTED",
        description: `Adgang afvist til vagtoverdragelse ${transfer.transferNumber}`
      }
    });
    redirect("/forbudt");
  }

  const isReceiver = user.id === transfer.receiverUserId;
  const canRespond = isReceiver && transfer.status === "AWAITING_RECEIVER";

  return (
    <>
      <TopBar title="Vagtoverdragelse" />
      <main className="mx-auto grid w-full max-w-2xl gap-4 px-4 py-6">
        <Link className="focus-ring w-fit rounded-md px-2 py-2 text-sm font-semibold text-zinc-700" href="/brandmand">
          Tilbage
        </Link>
        <section className="grid gap-5 rounded-lg border border-brand-line bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-zinc-600">Sag {transfer.transferNumber}</p>
              <h1 className="mt-1 text-2xl font-bold">Vagtoverdragelse</h1>
            </div>
            <StatusBadge status={transfer.status} />
          </div>
          <dl className="grid gap-4 rounded-md bg-brand-mist p-4">
            <Detail label="Afgiver" value={`${transfer.giverNameSnapshot} - ${transfer.giverEmployeeNumberSnapshot}`} />
            <Detail
              label="Overtager"
              value={`${transfer.receiverNameSnapshot} - ${transfer.receiverEmployeeNumberSnapshot}`}
            />
            <Detail label="Starttidspunkt" value={formatDateTime(transfer.requestedStartAt)} />
            <Detail
              label="Forventet sluttid"
              value={transfer.expectedEndAt ? formatDateTime(transfer.expectedEndAt) : "Ikke angivet"}
            />
            <Detail label="Oprettet" value={formatDateTime(transfer.createdAt)} />
            {transfer.comment ? <Detail label="Kommentar" value={transfer.comment} /> : null}
            {transfer.receiverResponseComment ? (
              <Detail label="Begrundelse fra modtager" value={transfer.receiverResponseComment} />
            ) : null}
          </dl>
          <p className="rounded-md bg-amber-50 p-3 text-sm font-semibold text-amber-950">
            Forventet sluttid er kun en påmindelse. Vagten tilbageleveres ikke automatisk.
          </p>
          {canRespond ? <TransferResponseForms transferId={transfer.id} /> : null}
        </section>
      </main>
    </>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-sm font-semibold text-zinc-600">{label}</dt>
      <dd className="mt-1 text-base font-bold text-zinc-950">{value}</dd>
    </div>
  );
}
