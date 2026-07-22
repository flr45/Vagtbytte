"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { AvailabilityStatus, TransferStatus } from "@prisma/client";
import { availabilityStatusLabel } from "@/lib/availability";
import {
  formatCountdown,
  formatShortCountdown,
  getVcDashboardStatus,
  getVcPriority,
  priorityLabel,
  sortVcTasksByPriority,
  type VcPriority
} from "@/lib/vc-dashboard";
import {
  VcExpectedReturnExecutionForm,
  VcReturnDecisionForms,
  VcReturnExecutionForm,
  VcTransferActivationForm,
  VcTransferDecisionForms
} from "./VcDecisionForms";
import { VcAssignAvailabilityForm } from "./AvailabilityForms";
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

export function VcDashboard({
  serverNow,
  currentAssignments,
  availableFirefighters,
  previousAvailabilities,
  awaitingTransfers,
  returnTransfers,
  activeTransfers,
  recentlyHandled
}: {
  serverNow: string;
  currentAssignments: VcDashboardAvailability[];
  availableFirefighters: VcDashboardAvailability[];
  previousAvailabilities: VcDashboardAvailability[];
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
  const sortedTasks = useMemo(() => sortVcTasksByPriority(tasks, now), [tasks, now]);
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
      <CurrentAssignmentsSection assignments={currentAssignments} />
      <AvailabilitySection availabilities={availableFirefighters} previousAvailabilities={previousAvailabilities} />
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

function CurrentAssignmentsSection({ assignments }: { assignments: VcDashboardAvailability[] }) {
  const sortedAssignments = [...assignments].sort((a, b) => {
    const aConfirmed = Boolean(a.acknowledgedAt);
    const bConfirmed = Boolean(b.acknowledgedAt);
    if (aConfirmed !== bConfirmed) {
      return aConfirmed ? 1 : -1;
    }
    return (parseDate(a.assignedAt)?.getTime() ?? 0) - (parseDate(b.assignedAt)?.getTime() ?? 0);
  });

  return (
    <section className="grid gap-4">
      <div>
        <h1 className="text-3xl font-bold">Aktuelt tildelt ({sortedAssignments.length})</h1>
        <p className="text-sm font-semibold text-zinc-600">Brandfolk tildelt i dette vagttidsrum.</p>
      </div>
      {sortedAssignments.length === 0 ? (
        <EmptyState text="Ingen er tildelt vagt lige nu." />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {sortedAssignments.map((assignment) => (
            <article
              className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5 shadow-[0_10px_30px_rgba(15,23,42,0.08)]"
              key={assignment.id}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-xl font-black text-emerald-950">{assignment.userName}</h2>
                  <dl className="mt-3 grid gap-2 text-sm font-semibold text-emerald-950">
                    <div>
                      <dt className="text-xs font-black uppercase text-emerald-700">Tildelt</dt>
                      <dd className="text-lg font-black">{formatShortTime(parseDate(assignment.assignedAt))}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-black uppercase text-emerald-700">Status</dt>
                      <dd className="text-base font-black">
                        {assignment.acknowledgedAt ? "Bekræftet" : "Afventer bekræftelse"}
                      </dd>
                    </div>
                  </dl>
                </div>
                <span
                  className={`w-fit rounded-full px-3 py-1 text-sm font-black ${
                    assignment.acknowledgedAt ? "bg-emerald-100 text-emerald-900" : "bg-amber-100 text-amber-950"
                  }`}
                >
                  <span aria-hidden="true">{assignment.acknowledgedAt ? "●" : "●"}</span>{" "}
                  {assignment.acknowledgedAt ? "Bekræftet" : "Afventer"}
                </span>
              </div>
              {assignment.acknowledgedAt ? (
                <p className="mt-3 text-sm font-semibold text-emerald-800">
                  Bekræftet {formatDateTime(parseDate(assignment.acknowledgedAt) ?? new Date(assignment.acknowledgedAt))}
                </p>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function AvailabilitySection({
  availabilities,
  previousAvailabilities
}: {
  availabilities: VcDashboardAvailability[];
  previousAvailabilities: VcDashboardAvailability[];
}) {
  return (
    <section className="grid gap-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Til rådighed</h1>
          <p className="text-sm font-semibold text-zinc-600">Til rådighed ({availabilities.length})</p>
        </div>
      </div>
      {availabilities.length === 0 ? (
        <EmptyState text="Der er ingen brandmænd til rådighed." />
      ) : (
        <div className="grid gap-3">
          {availabilities.map((availability) => (
            <article
              className="grid gap-4 rounded-2xl border border-emerald-100 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.08)] sm:grid-cols-[1fr_auto] sm:items-center"
              key={availability.id}
            >
              <div>
                <h2 className="text-xl font-black">{availability.userName}</h2>
                <p className="mt-1 text-lg font-bold text-zinc-700">
                  {formatShortTime(parseDate(availability.availableFrom))} → {formatShortTime(parseDate(availability.availableUntil))}
                </p>
              </div>
              <VcAssignAvailabilityForm availabilityId={availability.id} />
            </article>
          ))}
        </div>
      )}
      <details className="grid gap-3">
        <summary className="cursor-pointer text-base font-bold text-zinc-700">Tidligere tilgængeligheder</summary>
        <div className="mt-3 grid gap-2">
          {previousAvailabilities.length === 0 ? (
            <p className="rounded-2xl border border-zinc-100 bg-white p-4 text-sm font-semibold text-zinc-600">
              Ingen tidligere tilgængeligheder.
            </p>
          ) : (
            previousAvailabilities.map((availability) => (
              <div className="rounded-2xl border border-zinc-100 bg-white p-4" key={availability.id}>
                <p className="font-bold">{availability.userName}</p>
                <p className="mt-1 text-sm font-semibold text-zinc-600">
                  {availabilityStatusLabel(availability.status)}
                  {availability.acknowledgedAt
                    ? ` · bekræftet ${formatDateTime(parseDate(availability.acknowledgedAt) ?? new Date(availability.acknowledgedAt))}`
                    : availability.assignedAt
                      ? ` · tildelt ${formatDateTime(parseDate(availability.assignedAt) ?? new Date(availability.assignedAt))}`
                      : ""}
                </p>
              </div>
            ))
          )}
        </div>
      </details>
    </section>
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
    green: "border-emerald-200 bg-emerald-50 text-emerald-950",
    yellow: "border-amber-300 bg-amber-200 text-amber-950",
    red: "border-red-700 bg-red-700 text-white",
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
    <section
      aria-live={status.ariaLive}
      className={`flex min-h-24 items-center gap-4 rounded-2xl border px-5 py-4 shadow-lg ${tone[status.priority]}`}
    >
      <span aria-hidden="true" className="grid size-12 shrink-0 place-items-center rounded-full bg-white/20">
        <Icon className="size-6" />
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
    green: "border-l-emerald-500",
    yellow: "border-l-amber-400",
    red: "border-l-red-600",
    critical: "vc-card-pulse border-l-red-800"
  } satisfies Record<VcPriority, string>;
  const priorityTone = {
    green: "bg-emerald-50 text-emerald-900 ring-emerald-100",
    yellow: "bg-amber-100 text-amber-950 ring-amber-200",
    red: "bg-red-100 text-red-900 ring-red-200",
    critical: "bg-red-700 text-white ring-red-800"
  } satisfies Record<VcPriority, string>;
  const label =
    type === "TRANSFER"
      ? "Ny vagtoverdragelse"
      : type === "RETURN"
        ? "Tilbagelevering"
        : type === "ACTIVATION"
          ? "Vagtskifte skal bekræftes"
          : type === "RETURN_EXECUTION"
            ? "Tilbagelevering skal bekræftes"
            : "Forventet tilbagelevering";

  return (
    <article className={`fade-in grid gap-4 rounded-2xl border border-zinc-100 border-l-8 bg-white p-4 shadow-[0_10px_30px_rgba(15,23,42,0.08)] sm:p-5 ${border[priority]}`}>
      <div className="flex flex-col gap-3 rounded-xl bg-zinc-50 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase text-zinc-500">{label}</p>
          <h2 className="mt-1 text-xl font-black text-zinc-950">{transfer.transferNumber}</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusBadge status={transfer.status} />
          <span className={`rounded-full px-3 py-1 text-sm font-black ring-1 ${priorityTone[priority]}`}>
            {priorityLabel(priority, deadline, now)}
          </span>
        </div>
      </div>
      <TimeOverview transfer={transfer} returnRequest={returnRequest} deadline={deadline} now={now} type={type} />
      <PeopleAndStatus transfer={transfer} returnRequest={returnRequest} type={type} />
      {type === "TRANSFER" || type === "ACTIVATION" ? (
        <TransferDetails transfer={transfer} />
      ) : type === "EXPECTED_END" ? (
        <ExpectedEndDetails transfer={transfer} />
      ) : (
        <ReturnDetails returnRequest={returnRequest} />
      )}
      <div className="grid gap-3 border-t border-zinc-100 pt-4">
        <h3 className="text-sm font-black uppercase text-zinc-500">Handlinger</h3>
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
          Detaljer og historik
        </Link>
      </div>
    </article>
  );
}

function TimeOverview({
  transfer,
  returnRequest,
  deadline,
  now,
  type
}: {
  transfer: VcDashboardTransfer;
  returnRequest?: VcDashboardReturnRequest;
  deadline: Date | null;
  now: Date;
  type: "TRANSFER" | "RETURN" | "EXPECTED_END" | "ACTIVATION" | "RETURN_EXECUTION";
}) {
  const awaitingSince =
    type === "TRANSFER"
      ? parseDate(transfer.receiverRespondedAt)
      : type === "RETURN"
        ? parseDate(returnRequest?.originalRespondedAt)
        : type === "ACTIVATION"
          ? parseDate(transfer.vcDecidedAt ?? transfer.updatedAt)
          : type === "EXPECTED_END"
            ? parseDate(transfer.activatedAt)
            : parseDate(returnRequest?.vcDecidedAt ?? returnRequest?.updatedAt);
  const expected =
    type === "RETURN" || type === "RETURN_EXECUTION"
      ? deadline
      : type === "EXPECTED_END"
        ? deadline
        : parseDate(transfer.expectedEndAt) ?? parseDate(transfer.calculatedShiftEndAt);

  return (
    <section className="grid gap-2">
      <h3 className="text-sm font-black uppercase text-zinc-500">Tidsoversigt</h3>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Ønsket start" value={formatDateTime(parseDate(transfer.requestedStartAt) ?? new Date())} />
        <Metric label="Forventet tilbagelevering" value={expected ? formatDateTime(expected) : expectedEndDisplay(transfer)} />
        <Metric label="Nedtælling" strong value={formatCountdown(deadline, now)} />
        <Metric label="Afventet VC" value={awaitingSince ? formatElapsed(awaitingSince, now) : "Ikke registreret"} />
      </div>
    </section>
  );
}

function PeopleAndStatus({
  transfer,
  returnRequest,
  type
}: {
  transfer: VcDashboardTransfer;
  returnRequest?: VcDashboardReturnRequest;
  type: "TRANSFER" | "RETURN" | "EXPECTED_END" | "ACTIVATION" | "RETURN_EXECUTION";
}) {
  return (
    <section className="grid gap-3 lg:grid-cols-2">
      <div className="rounded-xl border border-zinc-100 bg-white p-4">
        <h3 className="text-sm font-black uppercase text-zinc-500">Overdragelse</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
          <PersonBlock label="Afgiver" name={transfer.giverNameSnapshot} number={transfer.giverEmployeeNumberSnapshot} />
          <PersonBlock label="Overtager" name={transfer.receiverNameSnapshot} number={transfer.receiverEmployeeNumberSnapshot} />
        </div>
      </div>
      <div className="rounded-xl border border-zinc-100 bg-white p-4">
        <h3 className="text-sm font-black uppercase text-zinc-500">Statusforløb</h3>
        <StatusTimeline transfer={transfer} returnRequest={returnRequest} type={type} />
      </div>
    </section>
  );
}

function TransferDetails({ transfer }: { transfer: VcDashboardTransfer }) {
  return (
    <section className="grid gap-3">
      <CommentsPanel
        items={[
          { label: "Kommentar fra A", value: transfer.comment },
          { label: "Kommentar fra B", value: transfer.receiverResponseComment }
        ]}
      />
      <InfoBar text="Overdragelsen er ikke gyldig, før vagtcentralen godkender den." />
    </section>
  );
}

function ExpectedEndDetails({ transfer }: { transfer: VcDashboardTransfer }) {
  return (
    <section className="grid gap-3">
      <CommentsPanel
        items={[
          { label: "Kommentar fra A", value: transfer.comment },
          { label: "Kommentar fra B", value: transfer.receiverResponseComment }
        ]}
      />
      <InfoBar
        tone="red"
        text="A og B har accepteret tilbageleveringen i den oprindelige sag. Bekræft udførelsen, når vagten er tilbageleveret."
      />
    </section>
  );
}

function ReturnDetails({ returnRequest }: { returnRequest?: VcDashboardReturnRequest }) {
  return (
    <section className="grid gap-3">
      <CommentsPanel
        items={[
          { label: "Kommentar fra B", value: returnRequest?.comment },
          { label: "Kommentar fra A", value: returnRequest?.originalResponseComment }
        ]}
      />
      <InfoBar text="Den oprindelige overdragelse fortsætter, indtil vagtcentralen godkender tilbageleveringen." />
    </section>
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

function Metric({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="rounded-xl border border-zinc-100 bg-white p-3">
      <p className="text-xs font-bold uppercase text-zinc-500">{label}</p>
      <p className={`mt-1 leading-tight ${strong ? "text-lg font-black text-zinc-950" : "font-bold text-zinc-800"}`}>{value}</p>
    </div>
  );
}

function PersonBlock({ label, name, number }: { label: string; name: string; number: string }) {
  return (
    <div className="rounded-xl bg-zinc-50 p-3">
      <p className="text-xs font-black uppercase text-zinc-500">{label}</p>
      <p className="mt-1 text-base font-black text-zinc-950">{name}</p>
      <p className="mt-0.5 text-sm font-semibold text-zinc-600">{number}</p>
    </div>
  );
}

function StatusTimeline({
  transfer,
  returnRequest,
  type
}: {
  transfer: VcDashboardTransfer;
  returnRequest?: VcDashboardReturnRequest;
  type: "TRANSFER" | "RETURN" | "EXPECTED_END" | "ACTIVATION" | "RETURN_EXECUTION";
}) {
  const steps =
    type === "RETURN" || type === "RETURN_EXECUTION"
      ? [
          { label: "Oprettet", at: parseDate(returnRequest?.createdAt), done: Boolean(returnRequest?.createdAt), current: false },
          {
            label: "A accepterede",
            at: parseDate(returnRequest?.originalRespondedAt),
            done: Boolean(returnRequest?.originalRespondedAt),
            current: false
          },
          { label: "Afventer VC", at: null, done: false, current: type === "RETURN" },
          { label: "Godkendt", at: parseDate(returnRequest?.vcDecidedAt), done: Boolean(returnRequest?.vcDecidedAt), current: false }
        ]
      : [
          { label: "Oprettet", at: parseDate(transfer.requestedStartAt), done: true, current: false },
          {
            label: "B accepterede",
            at: parseDate(transfer.receiverRespondedAt),
            done: Boolean(transfer.receiverRespondedAt),
            current: false
          },
          { label: "Afventer VC", at: null, done: false, current: transfer.status === "RECEIVER_ACCEPTED_AWAITING_VC" },
          {
            label: "Godkendt",
            at: parseDate(transfer.vcDecidedAt),
            done: Boolean(transfer.vcDecidedAt) || transfer.status === "VC_APPROVED_ACTIVE",
            current: false
          }
        ];

  const explicitCurrentIndex = steps.findIndex((step) => step.current);
  const firstPendingIndex = explicitCurrentIndex === -1 ? steps.findIndex((step) => !step.done) : explicitCurrentIndex;
  const currentIndex = firstPendingIndex === -1 ? steps.length - 1 : firstPendingIndex;

  return (
    <ol className="mt-3 grid gap-2">
      {steps.map((step, index) => {
        const isCurrent = index === currentIndex || (step.done && index === steps.length - 1);
        return (
          <li className="grid grid-cols-[auto_1fr_auto] items-center gap-2 text-sm" key={`${step.label}-${index}`}>
            <span
              className={`size-2.5 rounded-full ${
                isCurrent ? "bg-brand-red" : step.done ? "bg-emerald-500" : "bg-zinc-300"
              }`}
            />
            <span className={isCurrent ? "font-black text-zinc-950" : step.done ? "font-semibold text-zinc-700" : "font-semibold text-zinc-400"}>
              {step.label}
            </span>
            <span className="text-xs font-semibold text-zinc-500">{step.at ? formatShortTime(step.at) : ""}</span>
          </li>
        );
      })}
    </ol>
  );
}

function CommentsPanel({ items }: { items: Array<{ label: string; value?: string | null }> }) {
  return (
    <section className="rounded-xl border border-zinc-100 bg-white p-4">
      <h3 className="text-sm font-black uppercase text-zinc-500">Kommentarer</h3>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        {items.map((item) => (
          <div className="rounded-xl bg-zinc-50 p-3" key={item.label}>
            <p className="text-xs font-black uppercase text-zinc-500">{item.label}</p>
            <p className="mt-1 text-sm font-semibold text-zinc-800">{item.value?.trim() || "Ingen kommentar"}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function InfoBar({ text, tone = "amber" }: { text: string; tone?: "amber" | "red" }) {
  const className =
    tone === "red"
      ? "rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-bold text-red-950"
      : "rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-950";
  return <p className={className}>{text}</p>;
}

function formatElapsed(from: Date, now: Date) {
  return formatCountdown(from, now).replace("Overskredet med ", "").replace("Om ", "");
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

function formatShortTime(date: Date | null) {
  if (!date) {
    return "Ukendt";
  }
  return new Intl.DateTimeFormat("da-DK", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Copenhagen"
  }).format(date);
}

function parseDate(value?: string | null) {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
