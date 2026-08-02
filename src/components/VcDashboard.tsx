"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import type { AvailabilityStatus, TransferStatus } from "@prisma/client";
import {
  formatCountdown,
  formatShortCountdown,
  getVcDashboardStatus,
  getVcPriority,
  priorityLabel,
  sortVcTasksByPriority,
  type VcPriority,
  type VcTaskKind
} from "@/lib/vc-dashboard";
import {
  VcExpectedReturnExecutionForm,
  VcReturnDecisionForms,
  VcReturnExecutionForm,
  VcTransferActivationForm,
  VcTransferDecisionForms
} from "./VcDecisionForms";
import { formatDateTime, StatusBadge } from "./TransferSummary";
import { AlertTriangleIcon, CheckIcon, ClockIcon, InboxIcon } from "./Icons";

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

export type VcDashboardAvailability = {
  id: string;
  userName: string;
  availableFrom: string;
  availableUntil: string;
  status: AvailabilityStatus;
  assignedAt: string | null;
  assignedShiftStart: string | null;
  assignedShiftEnd: string | null;
  acknowledgedAt: string | null;
  cancelledAt: string | null;
  expiredAt: string | null;
};

type DashboardTask = {
  id: string;
  kind: VcTaskKind;
  transfer: VcDashboardTransfer;
  returnRequest?: VcDashboardReturnRequest;
  transferId: string;
  returnRequestId?: string;
  transferNumber: string;
  status: TransferStatus;
  deadlineAt: Date | null;
  awaitingSince: Date | null;
};

export function VcDashboard({
  serverNow,
  awaitingTransfers,
  returnTransfers,
  activeTransfers,
  recentlyHandled,
  children
}: {
  serverNow: string;
  currentAssignments: VcDashboardAvailability[];
  availableFirefighters: VcDashboardAvailability[];
  previousAvailabilities: VcDashboardAvailability[];
  awaitingTransfers: VcDashboardTransfer[];
  returnTransfers: VcDashboardTransfer[];
  activeTransfers: VcDashboardTransfer[];
  recentlyHandled: VcDashboardTransfer[];
  children?: ReactNode;
}) {
  const router = useRouter();
  const [nowMs, setNowMs] = useState(() => new Date(serverNow).getTime());
  const now = useMemo(() => new Date(nowMs), [nowMs]);
  const tasks = useMemo<DashboardTask[]>(
    () => [
      ...awaitingTransfers.map(transferToTask),
      ...returnTransfers.map(transferToReturnTask),
      ...activeTransfers
        .filter((transfer) => transfer.status === "VC_APPROVED_AWAITING_ACTIVATION")
        .map(transferToActivationTask),
      ...activeTransfers
        .filter((transfer) => transfer.status === "RETURN_APPROVED_AWAITING_EXECUTION")
        .map(transferToReturnExecutionTask),
      ...activeTransfers
        .filter((transfer) => isExpectedEndActionable(transfer, now))
        .map(transferToExpectedEndTask)
    ],
    [activeTransfers, awaitingTransfers, returnTransfers, now]
  );
  const sortedTasks = useMemo(() => sortVcTasksByPriority(tasks, now), [tasks, now]);
  const dashboardStatus = getVcDashboardStatus(sortedTasks, now);
  const nextDeadline = sortedTasks[0]?.deadlineAt ?? null;
  const fastTick = Boolean(nextDeadline && nextDeadline.getTime() - nowMs <= 5 * 60 * 1000);

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
    <main className="mx-auto grid w-full max-w-6xl gap-5 px-4 py-5">
      <section className="grid gap-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-black sm:text-3xl">Handlinger</h1>
            <p className="text-sm font-semibold text-zinc-600">
              {sortedTasks.length === 0
                ? "Ingen sager kræver handling."
                : `${sortedTasks.length} sag${sortedTasks.length === 1 ? "" : "er"} kræver handling.`}
            </p>
          </div>
          <StatusBar status={dashboardStatus} nextDeadline={nextDeadline} now={now} />
        </div>

        {sortedTasks.length === 0 ? (
          <EmptyState text="Der er ingen sager, der kræver handling." compact />
        ) : (
          <div className="grid gap-3">
            {sortedTasks.map((task) => (
              <ActionCard
                key={task.id}
                now={now}
                returnRequest={task.returnRequest}
                transfer={task.transfer}
                type={task.kind}
              />
            ))}
          </div>
        )}
      </section>

      {children}

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
    green: "border-emerald-200 bg-emerald-50 text-emerald-950",
    yellow: "border-amber-300 bg-amber-100 text-amber-950",
    red: "border-red-600 bg-red-600 text-white",
    critical: "vc-pulse border-red-800 bg-red-700 text-white"
  } satisfies Record<VcPriority, string>;
  const countdown = nextDeadline ? formatShortCountdown(nextDeadline, now) : "";
  const message =
    !nextDeadline
      ? status.text
      : nextDeadline.getTime() <= now.getTime()
        ? "Handling forsinket"
        : status.priority === "critical"
          ? `Handling om ${countdown}`
          : status.livePrefix && countdown
            ? `${status.text} ${status.livePrefix} ${countdown}`
            : status.text;
  const Icon = status.priority === "green" ? CheckIcon : status.priority === "yellow" ? ClockIcon : AlertTriangleIcon;

  return (
    <div
      aria-live={status.ariaLive}
      className={`flex min-h-14 items-center gap-3 rounded-xl border px-4 py-3 shadow-sm lg:min-w-80 ${tone[status.priority]}`}
    >
      <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-full bg-white/20">
        <Icon className="size-5" />
      </span>
      <div className="min-w-0">
        <p className="font-black leading-tight">{message}</p>
        <p className="text-xs font-semibold opacity-85">{status.taskCount} VC-opgave(r)</p>
      </div>
    </div>
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
  type: VcTaskKind;
  now: Date;
}) {
  const deadline = taskDeadline(type, transfer, returnRequest);
  const priority = getVcPriority(deadline, now);
  const border = {
    green: "border-l-emerald-500",
    yellow: "border-l-amber-400",
    red: "border-l-red-600",
    critical: "vc-card-pulse border-l-red-800"
  } satisfies Record<VcPriority, string>;
  const priorityTone = {
    green: "bg-emerald-50 text-emerald-900",
    yellow: "bg-amber-100 text-amber-950",
    red: "bg-red-100 text-red-900",
    critical: "bg-red-700 text-white"
  } satisfies Record<VcPriority, string>;
  const expected =
    type === "RETURN" || type === "RETURN_EXECUTION"
      ? parseDate(returnRequest?.requestedReturnAt)
      : parseDate(transfer.expectedEndAt) ?? parseDate(transfer.calculatedShiftEndAt);
  const comments = [
    transfer.comment ? { label: "Kommentar fra afgiver", value: transfer.comment } : null,
    transfer.receiverResponseComment
      ? { label: "Kommentar fra overtager", value: transfer.receiverResponseComment }
      : null,
    returnRequest?.comment ? { label: "Kommentar til tilbagelevering", value: returnRequest.comment } : null,
    returnRequest?.originalResponseComment
      ? { label: "Svar på tilbagelevering", value: returnRequest.originalResponseComment }
      : null
  ].filter((item): item is { label: string; value: string } => Boolean(item));

  return (
    <article className={`fade-in grid gap-4 rounded-2xl border border-zinc-100 border-l-8 bg-white p-4 shadow-sm ${border[priority]}`}>
      <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-start">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-black uppercase tracking-wide text-zinc-500">{taskLabel(type)}</p>
            <span className={`rounded-full px-2.5 py-1 text-xs font-black ${priorityTone[priority]}`}>
              {priorityLabel(priority, deadline, now)}
            </span>
          </div>
          <h2 className="mt-2 text-xl font-black">{transfer.transferNumber}</h2>
          <p className="mt-2 break-words text-base font-black text-zinc-950 sm:text-lg">
            {transfer.giverNameSnapshot} <span className="text-zinc-400">→</span> {transfer.receiverNameSnapshot}
          </p>
          <p className="mt-1 text-sm font-semibold text-zinc-600">
            {transfer.giverEmployeeNumberSnapshot} → {transfer.receiverEmployeeNumberSnapshot}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 text-sm md:min-w-80">
          <CompactMetric label={type === "RETURN" ? "Tilbagelevering" : "Start"} value={formatDateTime(deadline ?? parseDate(transfer.requestedStartAt) ?? new Date())} />
          <CompactMetric label="Forventet slut" value={expected ? formatDateTime(expected) : expectedEndDisplay(transfer)} />
        </div>
      </div>

      <div className="grid gap-3 border-t border-zinc-100 pt-4">
        {type === "TRANSFER" ? (
          <VcTransferDecisionForms
            confirmationText={`Vil du godkende denne vagtoverdragelse?\n${transfer.giverNameSnapshot} til ${transfer.receiverNameSnapshot}\nStart: ${formatDateTime(parseDate(transfer.requestedStartAt) ?? new Date())}`}
            direct
            transferId={transfer.id}
          />
        ) : type === "ACTIVATION" ? (
          <VcTransferActivationForm
            confirmationText={`Vil du bekræfte, at vagtskiftet er udført?\n${transfer.giverNameSnapshot} til ${transfer.receiverNameSnapshot}`}
            transferId={transfer.id}
          />
        ) : type === "RETURN_EXECUTION" && returnRequest ? (
          <VcReturnExecutionForm
            confirmationText={`Vil du bekræfte, at tilbageleveringen er udført?\n${transfer.receiverNameSnapshot} tilbageleverer til ${transfer.giverNameSnapshot}`}
            returnRequestId={returnRequest.id}
          />
        ) : type === "EXPECTED_END" ? (
          <VcExpectedReturnExecutionForm
            confirmationText={`Vil du bekræfte, at vagten er tilbageleveret?\n${transfer.receiverNameSnapshot} tilbageleverer til ${transfer.giverNameSnapshot}`}
            transferId={transfer.id}
          />
        ) : type === "RETURN" && returnRequest ? (
          <VcReturnDecisionForms
            confirmationText={`Vil du godkende denne tilbagelevering?\n${transfer.receiverNameSnapshot} tilbageleverer til ${transfer.giverNameSnapshot}`}
            direct
            returnRequestId={returnRequest.id}
          />
        ) : null}
      </div>

      <details className="rounded-xl border border-zinc-200 bg-zinc-50">
        <summary className="focus-ring cursor-pointer rounded-xl px-4 py-3 text-sm font-black text-zinc-700">
          Vis detaljer
        </summary>
        <div className="grid gap-3 border-t border-zinc-200 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={transfer.status} />
            <span className="text-sm font-bold text-zinc-700">{formatCountdown(deadline, now)}</span>
          </div>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <Detail label="Starttidspunkt" value={formatDateTime(parseDate(transfer.requestedStartAt) ?? new Date())} />
            <Detail label="Forventet tilbagelevering" value={expectedEndDisplay(transfer)} />
          </dl>
          {comments.length > 0 ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {comments.map((comment) => (
                <div className="rounded-xl bg-white p-3" key={comment.label}>
                  <p className="text-xs font-black uppercase text-zinc-500">{comment.label}</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm font-semibold text-zinc-800">{comment.value}</p>
                </div>
              ))}
            </div>
          ) : null}
          <Link className="app-button-secondary w-full text-sm sm:w-fit" href={`/vagtcentral/sager/${transfer.id}`}>
            Åbn historik og alle oplysninger
          </Link>
        </div>
      </details>
    </article>
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
    <details className="rounded-2xl border border-zinc-200 bg-white" open={transfers.length > 0 && title.startsWith("Aktive")}>
      <summary className="focus-ring flex min-h-14 cursor-pointer items-center justify-between gap-3 rounded-2xl px-4 font-black">
        <span>{title}</span>
        <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-sm">{transfers.length}</span>
      </summary>
      <div className="grid gap-3 border-t border-zinc-200 p-4">
        {transfers.length === 0 ? (
          <p className="text-sm font-semibold text-zinc-600">{emptyText}</p>
        ) : (
          <div className="grid gap-2 md:grid-cols-2">
            {transfers.map((transfer) => {
              const expectedEnd = parseDate(transfer.expectedEndAt);
              return (
                <Link
                  className="focus-ring grid gap-1 rounded-xl border border-zinc-100 bg-zinc-50 p-3 hover:bg-zinc-100"
                  href={`/vagtcentral/sager/${transfer.id}`}
                  key={transfer.id}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-black">{transfer.transferNumber}</p>
                    <StatusBadge status={transfer.status} />
                  </div>
                  <p className="text-sm font-bold text-zinc-800">
                    {transfer.giverNameSnapshot} → {transfer.receiverNameSnapshot}
                  </p>
                  <p className="text-xs font-semibold text-zinc-600">{expectedEndDisplay(transfer)}</p>
                  {expectedEnd && expectedEnd < now ? (
                    <p className="text-xs font-black text-red-700">Tilbagelevering overskredet</p>
                  ) : null}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </details>
  );
}

function EmptyState({ text, compact = false }: { text: string; compact?: boolean }) {
  return (
    <div className={`app-card grid place-items-center gap-2 text-center text-sm text-zinc-600 ${compact ? "py-5" : "py-8"}`}>
      <InboxIcon className="size-7 text-zinc-400" />
      <p>{text}</p>
    </div>
  );
}

function CompactMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-zinc-50 p-3">
      <p className="text-xs font-black uppercase text-zinc-500">{label}</p>
      <p className="mt-1 text-sm font-black leading-tight text-zinc-900">{value}</p>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-black uppercase text-zinc-500">{label}</dt>
      <dd className="mt-1 font-bold text-zinc-900">{value}</dd>
    </div>
  );
}

function transferToTask(transfer: VcDashboardTransfer): DashboardTask {
  return {
    id: `transfer:${transfer.id}`,
    kind: "TRANSFER",
    transfer,
    transferId: transfer.id,
    transferNumber: transfer.transferNumber,
    status: transfer.status,
    deadlineAt: parseDate(transfer.requestedStartAt),
    awaitingSince: parseDate(transfer.receiverRespondedAt)
  };
}

function transferToReturnTask(transfer: VcDashboardTransfer): DashboardTask {
  const returnRequest = currentReturnRequest(transfer);
  return {
    id: `return:${returnRequest?.id ?? transfer.id}`,
    kind: "RETURN",
    transfer,
    returnRequest,
    transferId: transfer.id,
    returnRequestId: returnRequest?.id,
    transferNumber: transfer.transferNumber,
    status: transfer.status,
    deadlineAt: parseDate(returnRequest?.requestedReturnAt),
    awaitingSince: parseDate(returnRequest?.originalRespondedAt ?? transfer.updatedAt)
  };
}

function transferToActivationTask(transfer: VcDashboardTransfer): DashboardTask {
  return {
    id: `activation:${transfer.id}`,
    kind: "ACTIVATION",
    transfer,
    transferId: transfer.id,
    transferNumber: transfer.transferNumber,
    status: transfer.status,
    deadlineAt: parseDate(transfer.requestedStartAt),
    awaitingSince: parseDate(transfer.vcDecidedAt ?? transfer.updatedAt)
  };
}

function transferToReturnExecutionTask(transfer: VcDashboardTransfer): DashboardTask {
  const returnRequest = currentReturnRequest(transfer);
  return {
    id: `return-execution:${returnRequest?.id ?? transfer.id}`,
    kind: "RETURN_EXECUTION",
    transfer,
    returnRequest,
    transferId: transfer.id,
    returnRequestId: returnRequest?.id,
    transferNumber: transfer.transferNumber,
    status: transfer.status,
    deadlineAt: parseDate(returnRequest?.requestedReturnAt),
    awaitingSince: parseDate(returnRequest?.vcDecidedAt ?? returnRequest?.updatedAt)
  };
}

function transferToExpectedEndTask(transfer: VcDashboardTransfer): DashboardTask {
  return {
    id: `expected-end:${transfer.id}`,
    kind: "EXPECTED_END",
    transfer,
    transferId: transfer.id,
    transferNumber: transfer.transferNumber,
    status: transfer.status,
    deadlineAt: parseDate(transfer.expectedEndAt),
    awaitingSince: parseDate(transfer.activatedAt)
  };
}

function isExpectedEndActionable(transfer: VcDashboardTransfer, now: Date) {
  if (transfer.status !== "VC_APPROVED_ACTIVE" || transfer.expectedEndMode !== "SPECIFIC_TIME") return false;
  const expectedEndAt = parseDate(transfer.expectedEndAt);
  return Boolean(expectedEndAt && expectedEndAt.getTime() - now.getTime() <= 5 * 60 * 1000);
}

function taskDeadline(
  type: VcTaskKind,
  transfer: VcDashboardTransfer,
  returnRequest?: VcDashboardReturnRequest
) {
  if (type === "TRANSFER" || type === "ACTIVATION") return parseDate(transfer.requestedStartAt);
  if (type === "EXPECTED_END") return parseDate(transfer.expectedEndAt);
  return parseDate(returnRequest?.requestedReturnAt);
}

function taskLabel(type: VcTaskKind) {
  const labels: Record<VcTaskKind, string> = {
    TRANSFER: "Ny vagtoverdragelse",
    RETURN: "Tilbagelevering",
    EXPECTED_END: "Forventet tilbagelevering",
    ACTIVATION: "Vagtskifte skal bekræftes",
    RETURN_EXECUTION: "Tilbagelevering skal bekræftes"
  };
  return labels[type];
}

function currentReturnRequest(transfer: VcDashboardTransfer) {
  return transfer.returnRequests.find((request) =>
    ["AWAITING_ORIGINAL", "ORIGINAL_ACCEPTED_AWAITING_VC", "VC_APPROVED_AWAITING_EXECUTION"].includes(request.status)
  );
}

function expectedEndDisplay(transfer: VcDashboardTransfer) {
  if (transfer.expectedEndMode === "UNTIL_SHIFT_END") {
    const calculated = parseDate(transfer.calculatedShiftEndAt);
    return calculated ? `Til vagtens slutning – ${formatDateTime(calculated)}` : "Til vagtens slutning";
  }
  const expectedEnd = parseDate(transfer.expectedEndAt);
  return expectedEnd ? formatDateTime(expectedEnd) : "Mangler tidspunkt";
}

function parseDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
