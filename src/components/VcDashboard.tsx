"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { TransferStatus } from "@prisma/client";
import { statusLabel } from "@/lib/transfer-rules";
import {
  formatCountdown,
  getVcDashboardStatus,
  getVcPriority,
  priorityLabel,
  sortVcTasksByDeadline,
  type VcPriority
} from "@/lib/vc-dashboard";
import {
  VcExpectedReturnExecutionForm,
  VcReturnDecisionForms,
  VcReturnExecutionForm,
  VcTransferActivationForm,
  VcTransferDecisionForms
} from "./VcDecisionForms";
import { formatDateTime, StatusBadge } from "./TransferSummary";
import { CheckIcon, InboxIcon } from "./Icons";

export type VcDashboardTransfer = {
  id: string;
  transferNumber: string;
  status: TransferStatus;
  giverNameSnapshot: string;
  giverEmployeeNumberSnapshot: string;
  receiverNameSnapshot: string;
  receiverEmployeeNumberSnapshot: string;
  requestedStartAt: string;
  expectedEndMode: "SPECIFIC_TIME" | "UNTIL_SHIFT_END";
  expectedEndAt: string | null;
  calculatedShiftEndAt: string | null;
  comment: string | null;
  receiverRespondedAt: string | null;
  receiverResponseComment: string | null;
  vcDecidedAt: string | null;
  activatedAt: string | null;
  updatedAt: string;
  returnRequests: VcDashboardReturnRequest[];
};

export type VcDashboardReturnRequest = {
  id: string;
  returnNumber: string;
  requestedReturnAt: string;
  comment: string | null;
  originalRespondedAt: string | null;
  originalResponseComment: string | null;
  vcDecidedAt: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
};

export function VcDashboard({
  serverNow,
  awaitingTransfers,
  returnTransfers,
  activeTransfers,
  recentlyHandled
}: {
  serverNow: string;
  awaitingTransfers: VcDashboardTransfer[];
  returnTransfers: VcDashboardTransfer[];
  activeTransfers: VcDashboardTransfer[];
  recentlyHandled: VcDashboardTransfer[];
}) {
  const router = useRouter();
  const [nowMs, setNowMs] = useState(() => new Date(serverNow).getTime());
  const now = useMemo(() => new Date(nowMs), [nowMs]);
  const tasks = useMemo(
    () => [
      ...awaitingTransfers.map((transfer) => transferToTask(transfer)),
      ...returnTransfers.map((transfer) => transferToReturnTask(transfer)),
      ...activeTransfers
        .filter((transfer) => transfer.status === "VC_APPROVED_AWAITING_ACTIVATION")
        .map((transfer) => transferToActivationTask(transfer)),
      ...activeTransfers
        .filter((transfer) => transfer.status === "RETURN_APPROVED_AWAITING_EXECUTION")
        .map((transfer) => transferToReturnExecutionTask(transfer)),
      ...activeTransfers
        .filter((transfer) => isExpectedEndActionable(transfer, now))
        .map((transfer) => transferToExpectedEndTask(transfer))
    ],
    [activeTransfers, awaitingTransfers, returnTransfers, now]
  );
  const sortedTasks = useMemo(() => sortVcTasksByDeadline(tasks, now), [tasks, now]);
  const dashboardStatus = getVcDashboardStatus(sortedTasks, now);
  const nextDeadlineMs = sortedTasks[0]?.deadlineAt?.getTime() ?? nowMs;
  const fastTick = nextDeadlineMs - nowMs <= 5 * 60 * 1000;

  useEffect(() => {
    const startedAt = Date.now();
    const serverStartedAt = new Date(serverNow).getTime();
    const timer = window.setInterval(
      () => setNowMs(serverStartedAt + (Date.now() - startedAt)),
      fastTick ? 1000 : 15000
    );
    return () => window.clearInterval(timer);
  }, [fastTick, serverNow]);

  useEffect(() => {
    const timer = window.setInterval(() => router.refresh(), 15000);
    return () => window.clearInterval(timer);
  }, [router]);

  return (
    <main className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-6">
      <StatusBar status={dashboardStatus} nextDeadline={sortedTasks[0]?.deadlineAt ?? null} now={now} />
      <section className="grid gap-4">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold">Handlinger</h1>
            <p className="text-sm text-zinc-600">Det vigtigste først.</p>
          </div>
          <p className="text-sm font-semibold text-zinc-700">{sortedTasks.length} opgave(r)</p>
        </div>
        {sortedTasks.length === 0 ? (
          <EmptyState text="Der er ingen sager, der kræver handling." />
        ) : (
          <div className="grid gap-4">
            {sortedTasks.map((task) => (
              <ActionCard
                key={task.id}
                now={now}
                returnRequest={task.kind === "RETURN" ? task.returnRequest : undefined}
                transfer={task.transfer}
                type={task.kind}
              />
            ))}
          </div>
        )}
      </section>
      <CompactTransferSection
        emptyText="Ingen aktive vagtoverdragelser."
        now={now}
        title="Aktive vagtoverdragelser"
        transfers={activeTransfers}
      />
      <CompactTransferSection
        emptyText="Ingen behandlede sager endnu."
        now={now}
        title="Senest behandlede sager"
        transfers={recentlyHandled}
      />
    </main>
  );
}

function transferToTask(transfer: VcDashboardTransfer) {
  return {
    id: `transfer:${transfer.id}`,
    kind: "TRANSFER" as const,
    transfer,
    transferId: transfer.id,
    transferNumber: transfer.transferNumber,
    status: transfer.status,
    deadlineAt: parseDate(transfer.requestedStartAt),
    awaitingSince: parseDate(transfer.receiverRespondedAt)
  };
}

function transferToReturnTask(transfer: VcDashboardTransfer) {
  const returnRequest = currentReturnRequest(transfer);
  return {
    id: `return:${returnRequest?.id ?? transfer.id}`,
    kind: "RETURN" as const,
    transfer,
    returnRequest,
    transferId: transfer.id,
    returnRequestId: returnRequest?.id,
    transferNumber: transfer.transferNumber,
    status: transfer.status,
    deadlineAt: returnRequest ? parseDate(returnRequest.requestedReturnAt) : null,
    awaitingSince: returnRequest ? parseDate(returnRequest.originalRespondedAt) : parseDate(transfer.updatedAt)
  };
}

function transferToExpectedEndTask(transfer: VcDashboardTransfer) {
  return {
    id: `expected-end:${transfer.id}`,
    kind: "EXPECTED_END" as const,
    transfer,
    transferId: transfer.id,
    transferNumber: transfer.transferNumber,
    status: transfer.status,
    deadlineAt: parseDate(transfer.expectedEndAt),
    awaitingSince: parseDate(transfer.activatedAt)
  };
}

function isExpectedEndActionable(transfer: VcDashboardTransfer, now: Date) {
  if (transfer.status !== "VC_APPROVED_ACTIVE" || transfer.expectedEndMode !== "SPECIFIC_TIME" || !transfer.expectedEndAt) {
    return false;
  }

  const expectedEndAt = parseDate(transfer.expectedEndAt);
  if (!expectedEndAt) {
    return false;
  }

  return expectedEndAt.getTime() - now.getTime() <= 5 * 60 * 1000;
}

function transferToActivationTask(transfer: VcDashboardTransfer) {
  return {
    id: `activation:${transfer.id}`,
    kind: "ACTIVATION" as const,
    transfer,
    transferId: transfer.id,
    transferNumber: transfer.transferNumber,
    status: transfer.status,
    deadlineAt: parseDate(transfer.requestedStartAt),
    awaitingSince: parseDate(transfer.vcDecidedAt ?? transfer.updatedAt)
  };
}

function transferToReturnExecutionTask(transfer: VcDashboardTransfer) {
  const returnRequest = currentReturnRequest(transfer);
  return {
    id: `return-execution:${returnRequest?.id ?? transfer.id}`,
    kind: "RETURN_EXECUTION" as const,
    transfer,
    returnRequest,
    transferId: transfer.id,
    returnRequestId: returnRequest?.id,
    transferNumber: transfer.transferNumber,
    status: transfer.status,
    deadlineAt: returnRequest ? parseDate(returnRequest.requestedReturnAt) : null,
    awaitingSince: returnRequest ? parseDate(returnRequest.vcDecidedAt ?? returnRequest.updatedAt) : parseDate(transfer.updatedAt)
  };
}

function StatusBar({
  status,
  nextDeadline,
  now
}: {
  status: ReturnType<typeof getVcDashboardStatus>;
  nextDeadline: Date | null;
  now: Date;
}) {
  const tone = {
    green: "border-emerald-700 bg-emerald-700 text-white",
    yellow: "border-amber-400 bg-amber-300 text-amber-950",
    red: "border-red-700 bg-red-700 text-white",
    critical: "vc-pulse border-red-900 bg-red-800 text-white"
  } satisfies Record<VcPriority, string>;
  const countdown = nextDeadline ? formatCountdown(nextDeadline, now).replace(/^Om /, "") : "";
  const message =
    status.livePrefix && countdown ? `${status.text} - ${status.livePrefix} ${countdown}` : status.text;

  return (
    <section
      aria-live={status.ariaLive}
      className={`flex min-h-24 items-center gap-4 rounded-2xl border px-5 py-4 shadow-lg ${tone[status.priority]}`}
    >
      <span aria-hidden="true" className="grid size-12 shrink-0 place-items-center rounded-full bg-white/20">
        <CheckIcon className="size-6" />
      </span>
      <div>
        <p className="text-2xl font-bold">{message}</p>
        <p className="mt-1 text-sm font-semibold opacity-90">VC-opgaver lige nu.</p>
      </div>
    </section>
  );
}

function ActionCard({
  transfer,
  returnRequest,
  type,
  now
}: {
  transfer: VcDashboardTransfer;
  returnRequest?: VcDashboardReturnRequest;
  type: "TRANSFER" | "RETURN" | "EXPECTED_END" | "ACTIVATION" | "RETURN_EXECUTION";
  now: Date;
}) {
  const deadline =
    type === "TRANSFER"
      ? parseDate(transfer.requestedStartAt)
      : type === "EXPECTED_END"
        ? parseDate(transfer.expectedEndAt)
        : type === "ACTIVATION"
          ? parseDate(transfer.requestedStartAt)
        : parseDate(returnRequest?.requestedReturnAt);
  const priority = getVcPriority(deadline, now);
  const border = {
    green: "border-l-emerald-600",
    yellow: "border-l-amber-400",
    red: "border-l-red-600",
    critical: "vc-card-pulse border-l-red-800"
  } satisfies Record<VcPriority, string>;

  return (
    <article className={`fade-in grid gap-4 rounded-2xl border border-white/70 border-l-8 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.08)] ${border[priority]}`}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm font-bold uppercase text-zinc-600">
            {type === "TRANSFER"
              ? "Ny vagtoverdragelse"
              : type === "RETURN"
                ? "Tilbagelevering"
                : type === "ACTIVATION"
                  ? "Vagtskifte skal bekræftes"
                  : type === "RETURN_EXECUTION"
                    ? "Tilbagelevering skal bekræftes"
                    : "Forventet tilbagelevering"}
          </p>
          <h2 className="mt-1 text-2xl font-bold">{transfer.transferNumber}</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusBadge status={transfer.status} />
          <span className="rounded-full bg-zinc-100 px-3 py-1 text-sm font-bold text-zinc-800">
            {priorityLabel(priority, deadline, now)}
          </span>
        </div>
      </div>
      {type === "TRANSFER" || type === "ACTIVATION" ? (
        <TransferDetails deadline={deadline} now={now} transfer={transfer} />
      ) : type === "EXPECTED_END" ? (
        <ExpectedEndDetails deadline={deadline} now={now} transfer={transfer} />
      ) : (
        <ReturnDetails deadline={deadline} now={now} returnRequest={returnRequest} transfer={transfer} />
      )}
      {type === "TRANSFER" ? (
        <VcTransferDecisionForms
          confirmationText={`Vil du godkende denne vagtoverdragelse?\n${transfer.giverNameSnapshot} til ${transfer.receiverNameSnapshot}\nStart: ${formatDateTime(parseDate(transfer.requestedStartAt) ?? new Date())}`}
          direct
          transferId={transfer.id}
        />
      ) : type === "ACTIVATION" ? (
        <VcTransferActivationForm
          confirmationText={`Vil du bekræfte, at vagtskiftet er udført?\n${transfer.giverNameSnapshot} til ${transfer.receiverNameSnapshot}\nTidspunkt: ${formatDateTime(parseDate(transfer.requestedStartAt) ?? new Date())}`}
          transferId={transfer.id}
        />
      ) : type === "RETURN_EXECUTION" && returnRequest ? (
        <VcReturnExecutionForm
          confirmationText={`Vil du bekræfte, at tilbageleveringen er udført?\n${transfer.receiverNameSnapshot} tilbageleverer til ${transfer.giverNameSnapshot}\nTidspunkt: ${formatDateTime(parseDate(returnRequest.requestedReturnAt) ?? new Date())}`}
          returnRequestId={returnRequest.id}
        />
      ) : type === "EXPECTED_END" ? (
        <VcExpectedReturnExecutionForm
          confirmationText={`Vil du bekræfte, at vagten er tilbageleveret?\n${transfer.receiverNameSnapshot} tilbageleverer til ${transfer.giverNameSnapshot}\nTidspunkt: ${formatDateTime(parseDate(transfer.expectedEndAt) ?? new Date())}`}
          transferId={transfer.id}
        />
      ) : type === "RETURN" && returnRequest ? (
        <VcReturnDecisionForms
          confirmationText={`Vil du godkende denne tilbagelevering?\n${transfer.receiverNameSnapshot} tilbageleverer til ${transfer.giverNameSnapshot}\nTidspunkt: ${formatDateTime(parseDate(returnRequest.requestedReturnAt) ?? new Date())}`}
          direct
          returnRequestId={returnRequest.id}
        />
      ) : null}
      <Link className="app-button-secondary w-full text-sm sm:w-fit" href={`/vagtcentral/sager/${transfer.id}`}>
        Detaljer
      </Link>
    </article>
  );
}

function TransferDetails({ transfer, deadline, now }: { transfer: VcDashboardTransfer; deadline: Date | null; now: Date }) {
  return (
    <div className="grid gap-3 text-sm text-zinc-700 md:grid-cols-2">
      <Detail label="Status" value={statusLabel(transfer.status)} />
      <Detail label="Afgiver" value={`${transfer.giverNameSnapshot} - ${transfer.giverEmployeeNumberSnapshot}`} />
      <Detail label="Overtager" value={`${transfer.receiverNameSnapshot} - ${transfer.receiverEmployeeNumberSnapshot}`} />
      <Detail label="Ønsket start" value={deadline ? formatDateTime(deadline) : "Mangler tidspunkt"} />
      <Detail label="Nedtælling" value={formatCountdown(deadline, now)} strong />
      <Detail label="Forventet tilbagelevering" value={expectedEndDisplay(transfer)} />
      <Detail label="Kommentar fra A" value={transfer.comment || "Ingen kommentar"} />
      <Detail label="B accepterede" value={transfer.receiverRespondedAt ? formatDateTime(parseDate(transfer.receiverRespondedAt) ?? new Date()) : "Ikke registreret"} />
      <Detail label="Kommentar fra B" value={transfer.receiverResponseComment || "Ingen kommentar"} />
      <Detail label="Afventet VC" value={transfer.receiverRespondedAt ? formatCountdown(parseDate(transfer.receiverRespondedAt), now).replace("Overskredet med", "") : "Ikke registreret"} />
      <p className="rounded-md bg-amber-50 p-3 font-semibold text-amber-950 md:col-span-2">
        Overdragelsen er ikke gyldig, før vagtcentralen godkender den.
      </p>
    </div>
  );
}

function ExpectedEndDetails({ transfer, deadline, now }: { transfer: VcDashboardTransfer; deadline: Date | null; now: Date }) {
  return (
    <div className="grid gap-3 text-sm text-zinc-700 md:grid-cols-2">
      <Detail label="Afgiver" value={`${transfer.giverNameSnapshot} - ${transfer.giverEmployeeNumberSnapshot}`} />
      <Detail label="Overtager" value={`${transfer.receiverNameSnapshot} - ${transfer.receiverEmployeeNumberSnapshot}`} />
      <Detail label="Forventet tilbagelevering" value={deadline ? formatDateTime(deadline) : "Mangler tidspunkt"} />
      <Detail label="Nedtælling" value={formatCountdown(deadline, now)} strong />
      <Detail label="Aktuel status" value={statusLabel(transfer.status)} />
      <p className="rounded-md bg-red-50 p-3 font-semibold text-red-950 md:col-span-2">
        A og B har accepteret tilbageleveringen i den oprindelige sag. Bekræft udførelsen, når vagten er tilbageleveret.
      </p>
    </div>
  );
}

function ReturnDetails({
  transfer,
  returnRequest,
  deadline,
  now
}: {
  transfer: VcDashboardTransfer;
  returnRequest?: VcDashboardReturnRequest;
  deadline: Date | null;
  now: Date;
}) {
  return (
    <div className="grid gap-3 text-sm text-zinc-700 md:grid-cols-2">
      <Detail label="Afgiver" value={`${transfer.giverNameSnapshot} - ${transfer.giverEmployeeNumberSnapshot}`} />
      <Detail label="Overtager" value={`${transfer.receiverNameSnapshot} - ${transfer.receiverEmployeeNumberSnapshot}`} />
      <Detail label="Tilbageleveres til" value={`${transfer.giverNameSnapshot} - ${transfer.giverEmployeeNumberSnapshot}`} />
      <Detail label="Oprindelig overdragelse" value={formatDateTime(parseDate(transfer.requestedStartAt) ?? new Date())} />
      <Detail label="Ønsket tilbagelevering" value={deadline ? formatDateTime(deadline) : "Mangler tidspunkt"} />
      <Detail label="Nedtælling" value={formatCountdown(deadline, now)} strong />
      <Detail label="Kommentar fra B" value={returnRequest?.comment || "Ingen kommentar"} />
      <Detail label="A accepterede" value={returnRequest?.originalRespondedAt ? formatDateTime(parseDate(returnRequest.originalRespondedAt) ?? new Date()) : "Ikke registreret"} />
      <Detail label="Kommentar fra A" value={returnRequest?.originalResponseComment || "Ingen kommentar"} />
      <p className="rounded-md bg-amber-50 p-3 font-semibold text-amber-950 md:col-span-2">
        Den oprindelige overdragelse fortsætter, indtil vagtcentralen godkender tilbageleveringen.
      </p>
    </div>
  );
}

function CompactTransferSection({
  title,
  emptyText,
  transfers,
  now
}: {
  title: string;
  emptyText: string;
  transfers: VcDashboardTransfer[];
  now: Date;
}) {
  return (
    <section className="grid gap-3">
      <h2 className="text-xl font-bold">{title}</h2>
      {transfers.length === 0 ? (
        <EmptyState text={emptyText} />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {transfers.map((transfer) => {
            const expectedEnd = transfer.expectedEndMode === "SPECIFIC_TIME" ? parseDate(transfer.expectedEndAt) : null;
            const activeReturn = currentReturnRequest(transfer);
            return (
              <Link
                className="focus-ring app-card-interactive grid gap-2"
                href={`/vagtcentral/sager/${transfer.id}`}
                key={transfer.id}
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="font-bold">{transfer.transferNumber}</p>
                  <StatusBadge status={transfer.status} />
                </div>
                <p className="text-sm text-zinc-700">
                  A: {transfer.giverNameSnapshot} - B: {transfer.receiverNameSnapshot}
                </p>
                <p className="text-sm text-zinc-700">Start: {formatDateTime(parseDate(transfer.requestedStartAt) ?? new Date())}</p>
                <p className="text-sm text-zinc-700">
                  Forventet tilbagelevering: {expectedEndDisplay(transfer)}
                </p>
                {expectedEnd && expectedEnd < now ? (
                  <p className="text-sm font-semibold text-red-700">Forventet tilbageleveringstidspunkt er overskredet.</p>
                ) : null}
                {activeReturn ? (
                  <p className="text-sm font-semibold text-amber-800">
                    Tilbagelevering i gang: {activeReturn.returnNumber}
                  </p>
                ) : null}
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="app-card grid place-items-center gap-3 py-8 text-center text-sm text-zinc-600">
      <InboxIcon className="size-9 text-zinc-400" />
      <p>{text}</p>
    </div>
  );
}

function Detail({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="rounded-md bg-zinc-50 p-3">
      <p className="text-xs font-bold uppercase text-zinc-500">{label}</p>
      <p className={`mt-1 ${strong ? "text-lg font-bold text-zinc-950" : "font-semibold text-zinc-800"}`}>{value}</p>
    </div>
  );
}

function currentReturnRequest(transfer: VcDashboardTransfer) {
  return transfer.returnRequests.find((request) =>
    ["AWAITING_ORIGINAL", "ORIGINAL_ACCEPTED_AWAITING_VC", "VC_APPROVED_AWAITING_EXECUTION"].includes(request.status)
  );
}

function expectedEndDisplay(transfer: VcDashboardTransfer) {
  if (transfer.expectedEndMode === "UNTIL_SHIFT_END") {
    const calculated = parseDate(transfer.calculatedShiftEndAt);
    return calculated ? `Til vagtens slutning - ${formatDateTime(calculated)}` : "Til vagtens slutning";
  }
  const expectedEnd = parseDate(transfer.expectedEndAt);
  return expectedEnd ? formatDateTime(expectedEnd) : "Mangler tidspunkt";
}

function parseDate(value?: string | null) {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
