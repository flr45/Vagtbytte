import { UserRole } from "@prisma/client";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { expectedEndLabel } from "@/lib/transfer-rules";
import { TopBar } from "@/components/TopBar";
import {
  VcExpectedReturnExecutionForm,
  VcReturnDecisionForms,
  VcReturnExecutionForm,
  VcTransferActivationForm,
  VcTransferDecisionForms
} from "@/components/VcDecisionForms";
import { formatDateTime, StatusBadge } from "@/components/TransferSummary";

export default async function VcTransferDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }] = await Promise.all([params, requireRole(UserRole.VC)]);
  const transfer = await prisma.shiftTransfer.findUnique({
    where: { id },
    include: {
      returnRequests: { orderBy: { createdAt: "desc" } }
    }
  });

  if (!transfer) {
    redirect("/forbudt");
  }

  const activeReturn = transfer.returnRequests.find((request) =>
    ["AWAITING_ORIGINAL", "ORIGINAL_ACCEPTED_AWAITING_VC", "VC_APPROVED_AWAITING_EXECUTION"].includes(request.status)
  );
  const now = new Date();
  const canConfirmExpectedReturn =
    transfer.status === "VC_APPROVED_ACTIVE" &&
    transfer.expectedEndMode === "SPECIFIC_TIME" &&
    Boolean(transfer.expectedEndAt && transfer.expectedEndAt.getTime() - now.getTime() <= 5 * 60 * 1000) &&
    !activeReturn;

  return (
    <>
      <TopBar title="Vagtcentral" />
      <main className="mx-auto grid w-full max-w-3xl gap-4 px-4 py-6">
        <Link className="focus-ring w-fit rounded-md px-2 py-2 text-sm font-semibold text-zinc-700" href="/vagtcentral">
          Tilbage
        </Link>
        <section className="grid gap-5 rounded-lg border border-brand-line bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-zinc-600">Sag {transfer.transferNumber}</p>
              <h1 className="mt-1 text-2xl font-bold">VC-behandling</h1>
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
              label="Forventet tilbagelevering"
              value={expectedEndLabel(transfer, formatDateTime)}
            />
            {transfer.comment ? <Detail label="Kommentar fra A" value={transfer.comment} /> : null}
            {transfer.receiverRespondedAt ? (
              <Detail label="B accepterede" value={formatDateTime(transfer.receiverRespondedAt)} />
            ) : null}
            {transfer.receiverResponseComment ? (
              <Detail label="Kommentar fra B" value={transfer.receiverResponseComment} />
            ) : null}
            {transfer.vcDecision ? <Detail label="VC's afgørelse" value={transfer.vcDecision} /> : null}
            {transfer.vcComment ? <Detail label="VC-kommentar" value={transfer.vcComment} /> : null}
          </dl>
          <p className="rounded-md bg-amber-50 p-3 text-sm font-semibold text-amber-950">
            Forventet tilbagelevering medfører ikke automatisk tilbagelevering.
          </p>
          {canConfirmExpectedReturn ? (
            <VcExpectedReturnExecutionForm
              confirmationText={`Vil du bekræfte, at vagten er tilbageleveret?\n${transfer.receiverNameSnapshot} tilbageleverer til ${transfer.giverNameSnapshot}\nTidspunkt: ${formatDateTime(transfer.expectedEndAt ?? new Date())}`}
              transferId={transfer.id}
            />
          ) : null}
          {transfer.status === "RECEIVER_ACCEPTED_AWAITING_VC" ? (
            <VcTransferDecisionForms transferId={transfer.id} />
          ) : null}
          {transfer.status === "VC_APPROVED_AWAITING_ACTIVATION" ? (
            <VcTransferActivationForm
              confirmationText={`Vil du bekræfte, at vagtskiftet er udført?\n${transfer.giverNameSnapshot} til ${transfer.receiverNameSnapshot}\nTidspunkt: ${formatDateTime(transfer.requestedStartAt)}`}
              transferId={transfer.id}
            />
          ) : null}
          {activeReturn ? (
            <section className="grid gap-3 rounded-md border border-brand-line p-4">
              <h2 className="text-xl font-bold">Tilbagelevering</h2>
              <dl className="grid gap-3">
                <Detail label="Sagsnummer" value={activeReturn.returnNumber} />
                <Detail label="Ønsket tidspunkt" value={formatDateTime(activeReturn.requestedReturnAt)} />
                {activeReturn.comment ? <Detail label="Kommentar fra B" value={activeReturn.comment} /> : null}
                {activeReturn.originalRespondedAt ? (
                  <Detail label="A svarede" value={formatDateTime(activeReturn.originalRespondedAt)} />
                ) : null}
                {activeReturn.originalResponseComment ? (
                  <Detail label="Kommentar fra A" value={activeReturn.originalResponseComment} />
                ) : null}
              </dl>
              {transfer.status === "RETURN_ACCEPTED_AWAITING_VC" &&
              activeReturn.status === "ORIGINAL_ACCEPTED_AWAITING_VC" ? (
                <VcReturnDecisionForms returnRequestId={activeReturn.id} />
              ) : null}
              {transfer.status === "RETURN_APPROVED_AWAITING_EXECUTION" &&
              activeReturn.status === "VC_APPROVED_AWAITING_EXECUTION" ? (
                <VcReturnExecutionForm
                  confirmationText={`Vil du bekræfte, at tilbageleveringen er udført?\n${transfer.receiverNameSnapshot} tilbageleverer til ${transfer.giverNameSnapshot}\nTidspunkt: ${formatDateTime(activeReturn.requestedReturnAt)}`}
                  returnRequestId={activeReturn.id}
                />
              ) : null}
            </section>
          ) : null}
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
