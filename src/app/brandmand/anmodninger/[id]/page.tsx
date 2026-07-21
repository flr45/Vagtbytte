import { UserRole } from "@prisma/client";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canCancelTransfer, canViewTransfer, expectedEndLabel } from "@/lib/transfer-rules";
import { caseHistoryWhere } from "@/lib/case-history";
import { TopBar } from "@/components/TopBar";
import { CaseHistory } from "@/components/CaseHistory";
import { CancelTransferForm } from "@/components/CancelTransferForm";
import { ReturnRequestCreateForm, ReturnRequestResponseForms } from "@/components/ReturnRequestForms";
import { TransferResponseForms } from "@/components/TransferResponseForms";
import { formatDateTime, StatusBadge } from "@/components/TransferSummary";

export default async function TransferDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const [{ id }, user] = await Promise.all([params, requireRole(UserRole.BRANDFIGHTER)]);
  const transfer = await prisma.shiftTransfer.findUnique({
    where: { id },
    include: {
      returnRequests: {
        orderBy: { createdAt: "desc" }
      }
    }
  });

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
  const isGiver = user.id === transfer.giverUserId;
  const canRespond = isReceiver && transfer.status === "AWAITING_RECEIVER";
  const activeReturn = transfer.returnRequests.find((request) =>
    ["AWAITING_ORIGINAL", "ORIGINAL_ACCEPTED_AWAITING_VC", "VC_APPROVED_AWAITING_EXECUTION"].includes(request.status)
  );
  const canCreateReturn =
    isReceiver &&
    transfer.status === "VC_APPROVED_ACTIVE" &&
    transfer.expectedEndMode === "UNTIL_SHIFT_END" &&
    !activeReturn;
  const canAnswerReturn =
    isGiver &&
    transfer.status === "RETURN_AWAITING_ORIGINAL" &&
    activeReturn?.status === "AWAITING_ORIGINAL";
  const isOverdue = Boolean(
    transfer.expectedEndMode === "SPECIFIC_TIME" && transfer.expectedEndAt && transfer.expectedEndAt < new Date()
  );
  const canCancel = canCancelTransfer({
    role: user.role,
    userId: user.id,
    giverUserId: transfer.giverUserId,
    status: transfer.status,
    hasOpenReturnRequest: Boolean(activeReturn),
    reason: transfer.status === "AWAITING_RECEIVER" ? null : "ui-preview"
  }).ok;
  const historyEntries = await prisma.auditLog.findMany({
    where: caseHistoryWhere(transfer.id),
    orderBy: { createdAt: "asc" },
    include: { actor: { select: { name: true, role: true } } }
  });

  return (
    <>
      <TopBar title="Vagtoverdragelse" />
      <main className="mx-auto grid w-full max-w-2xl gap-4 px-4 py-6">
        <Link className="focus-ring w-fit rounded-md px-2 py-2 text-sm font-semibold text-zinc-700" href="/brandmand">
          Tilbage
        </Link>
        <section className="app-card grid gap-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-zinc-600">Sag {transfer.transferNumber}</p>
              <h1 className="mt-1 text-2xl font-bold">Vagtoverdragelse</h1>
            </div>
            <StatusBadge status={transfer.status} />
          </div>
          <dl className="grid gap-4 rounded-2xl bg-brand-mist p-4">
            <Detail label="Afgiver" value={`${transfer.giverNameSnapshot} - ${transfer.giverEmployeeNumberSnapshot}`} />
            <Detail
              label="Overtager"
              value={`${transfer.receiverNameSnapshot} - ${transfer.receiverEmployeeNumberSnapshot}`}
            />
            <Detail label="Starttidspunkt" value={formatDateTime(transfer.requestedStartAt)} />
            <Detail
              label="Forventet tilbagelevering"
              value={expectedEndLabel(transfer, formatDateTime)}
            />
            <Detail label="Oprettet" value={formatDateTime(transfer.createdAt)} />
            {transfer.comment ? <Detail label="Kommentar" value={transfer.comment} /> : null}
            {transfer.receiverResponseComment ? (
              <Detail label="Begrundelse fra modtager" value={transfer.receiverResponseComment} />
            ) : null}
            {transfer.vcDecision ? <Detail label="VC's afgørelse" value={transfer.vcDecision} /> : null}
            {transfer.vcComment ? <Detail label="VC-kommentar" value={transfer.vcComment} /> : null}
            {transfer.cancelledAt ? <Detail label="Annulleret" value={formatDateTime(transfer.cancelledAt)} /> : null}
            {transfer.cancellationReason ? <Detail label="Annulleringsbegrundelse" value={transfer.cancellationReason} /> : null}
          </dl>
          <p className="rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-950">
            VC afslutter ikke sagen automatisk.
          </p>
          {isOverdue ? (
            <p className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-950">
              Tidspunktet er overskredet. Afventer VC.
            </p>
          ) : null}
          {canRespond ? <TransferResponseForms transferId={transfer.id} /> : null}
          {canCreateReturn ? (
            <ReturnRequestCreateForm transferId={transfer.id} originalName={transfer.giverNameSnapshot} />
          ) : null}
          {canCancel ? <CancelTransferForm status={transfer.status} transferId={transfer.id} /> : null}
          {activeReturn ? (
            <section className="grid gap-3 rounded-2xl border border-zinc-100 bg-zinc-50 p-4">
              <h2 className="text-xl font-bold">Aktiv tilbagelevering</h2>
              <dl className="grid gap-3">
                <Detail label="Tilbagelevering" value={activeReturn.returnNumber} />
                <Detail label="Ønsket tidspunkt" value={formatDateTime(activeReturn.requestedReturnAt)} />
                {activeReturn.comment ? <Detail label="Kommentar" value={activeReturn.comment} /> : null}
                {activeReturn.originalResponseComment ? (
                  <Detail label="Svar fra oprindelig brandmand" value={activeReturn.originalResponseComment} />
                ) : null}
                {activeReturn.vcComment ? <Detail label="VC-kommentar" value={activeReturn.vcComment} /> : null}
              </dl>
              {canAnswerReturn ? <ReturnRequestResponseForms returnRequestId={activeReturn.id} /> : null}
            </section>
          ) : null}
        </section>
        <CaseHistory entries={historyEntries} />
      </main>
    </>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-sm font-semibold text-zinc-600">{label}</dt>
      <dd className="mt-1 break-words text-base font-bold text-zinc-950">{value}</dd>
    </div>
  );
}
