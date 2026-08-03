import { AvailabilityStatus, UserRole } from "@prisma/client";
import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { availabilityStatusLabel, calculateAssignedShiftWindow } from "@/lib/availability";
import { prisma } from "@/lib/prisma";
import { AvailabilityActiveForm, AvailabilityCreateForm } from "@/components/AvailabilityForms";
import { TopBar } from "@/components/TopBar";
import { formatDateTime, TransferList } from "@/components/TransferSummary";

export default async function FirefighterPage() {
  const user = await requireRole(UserRole.BRANDFIGHTER);
  const now = new Date();
  const currentShift = calculateAssignedShiftWindow(now);
  const [requestsToMe, myCreatedRequests, activeAvailability, currentAssignment, availabilityHistory] = await Promise.all([
    prisma.shiftTransfer.findMany({
      where: { receiverUserId: user.id },
      orderBy: { createdAt: "desc" }
    }),
    prisma.shiftTransfer.findMany({
      where: { giverUserId: user.id },
      orderBy: { createdAt: "desc" }
    }),
    prisma.availability.findFirst({
      where: { userId: user.id, status: AvailabilityStatus.AVAILABLE },
      orderBy: { createdAt: "desc" }
    }),
    prisma.availability.findFirst({
      where: {
        userId: user.id,
        status: { in: [AvailabilityStatus.ASSIGNED, AvailabilityStatus.ACKNOWLEDGED] },
        assignedShiftStart: currentShift.start,
        assignedShiftEnd: currentShift.end
      },
      orderBy: { assignedAt: "desc" }
    }),
    prisma.availability.findMany({
      where: {
        userId: user.id,
        status: { in: [AvailabilityStatus.ASSIGNED, AvailabilityStatus.ACKNOWLEDGED, AvailabilityStatus.CANCELLED, AvailabilityStatus.EXPIRED] }
      },
      orderBy: { updatedAt: "desc" },
      take: 10
    })
  ]);
  const activeStatuses = new Set([
    "AWAITING_RECEIVER",
    "RECEIVER_ACCEPTED_AWAITING_VC",
    "VC_APPROVED_AWAITING_ACTIVATION",
    "VC_APPROVED_ACTIVE",
    "RETURN_AWAITING_ORIGINAL",
    "RETURN_ACCEPTED_AWAITING_VC",
    "RETURN_APPROVED_AWAITING_EXECUTION"
  ]);
  const requestsRequiringMyResponse = requestsToMe.filter(
    (transfer) => transfer.status === "AWAITING_RECEIVER"
  );
  const activeTransfersReceivedByMe = requestsToMe.filter(
    (transfer) => activeStatuses.has(transfer.status) && transfer.status !== "AWAITING_RECEIVER"
  );
  const activeMyCreatedRequests = myCreatedRequests.filter((transfer) => activeStatuses.has(transfer.status));
  const previousTransfers = [...requestsToMe, ...myCreatedRequests].filter((transfer) => !activeStatuses.has(transfer.status));
  const previousAvailabilityHistory = availabilityHistory.filter(
    (availability) => availability.id !== currentAssignment?.id
  );

  return (
    <>
      <TopBar title="Vagtoverdragelse" />
      <main className="mx-auto grid w-full max-w-3xl gap-5 px-4 py-5">
        <section className="app-card grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
          <div className="min-w-0">
            <p className="text-sm font-black uppercase tracking-wide text-brand-red">Din vagtoversigt</p>
            <h1 className="mt-1 truncate text-2xl font-black">{user.name}</h1>
            <p className="mt-1 text-sm font-semibold text-zinc-600">
              Medarbejdernummer {user.employeeNumber ?? "ikke registreret"}
            </p>
          </div>
          <Link className="app-button-primary w-full sm:w-auto" href="/brandmand/ny">
            Opret vagtoverdragelse
          </Link>
        </section>

        {currentAssignment ? (
          <section
            className={`app-card grid gap-4 ${
              currentAssignment.acknowledgedAt ? "border-emerald-100 bg-emerald-50" : "border-amber-200 bg-amber-50"
            }`}
          >
            <div>
              <p
                className={`text-sm font-bold uppercase ${
                  currentAssignment.acknowledgedAt ? "text-emerald-700" : "text-amber-800"
                }`}
              >
                {currentAssignment.acknowledgedAt ? "● Bekræftet" : "● Afventer bekræftelse"}
              </p>
              <h2
                className={`mt-1 text-2xl font-black ${
                  currentAssignment.acknowledgedAt ? "text-emerald-950" : "text-amber-950"
                }`}
              >
                Du er tildelt en vagt
              </h2>
              <dl className="mt-3 grid gap-2">
                <div>
                  <dt className="text-xs font-black uppercase text-zinc-600">Tildelt</dt>
                  <dd className="text-xl font-black">{formatShortTime(currentAssignment.assignedAt ?? currentAssignment.availableFrom)}</dd>
                </div>
              </dl>
              {currentAssignment.acknowledgedAt ? (
                <p className="mt-3 text-lg font-black text-emerald-900">
                  Bekræftet kl. {formatShortTime(currentAssignment.acknowledgedAt)}
                </p>
              ) : (
                <p className="mt-3 text-sm font-semibold text-amber-900">Tryk for at bekræfte.</p>
              )}
            </div>
            <Link className="app-button-secondary w-full sm:w-fit" href={`/brandmand/til-raadighed/${currentAssignment.id}`}>
              {currentAssignment.acknowledgedAt ? "Åbn tildeling" : "Tryk for at bekræfte"}
            </Link>
          </section>
        ) : null}

        {requestsRequiringMyResponse.length > 0 ? (
          <TransferList
            emptyText="Der er ingen anmodninger, som kræver dit svar."
            title="Kræver dit svar"
            transfers={requestsRequiringMyResponse.map((transfer) => ({
              id: transfer.id,
              transferNumber: transfer.transferNumber,
              status: transfer.status,
              requestedStartAt: transfer.requestedStartAt,
              expectedEndMode: transfer.expectedEndMode,
              expectedEndAt: transfer.expectedEndAt,
              calculatedShiftEndAt: transfer.calculatedShiftEndAt,
              comment: transfer.comment,
              receiverResponseComment: transfer.receiverResponseComment,
              vcDecision: transfer.vcDecision,
              vcComment: transfer.vcComment,
              cancelledAt: transfer.cancelledAt,
              cancellationReason: transfer.cancellationReason,
              counterpartName: transfer.giverNameSnapshot,
              counterpartEmployeeNumber: transfer.giverEmployeeNumberSnapshot
            }))}
          />
        ) : null}

        {activeTransfersReceivedByMe.length > 0 ? (
          <TransferList
            emptyText="Du har ingen aktive vagter overdraget til dig."
            title="Vagter overdraget til dig"
            transfers={activeTransfersReceivedByMe.map((transfer) => ({
              id: transfer.id,
              transferNumber: transfer.transferNumber,
              status: transfer.status,
              requestedStartAt: transfer.requestedStartAt,
              expectedEndMode: transfer.expectedEndMode,
              expectedEndAt: transfer.expectedEndAt,
              calculatedShiftEndAt: transfer.calculatedShiftEndAt,
              comment: transfer.comment,
              receiverResponseComment: transfer.receiverResponseComment,
              vcDecision: transfer.vcDecision,
              vcComment: transfer.vcComment,
              cancelledAt: transfer.cancelledAt,
              cancellationReason: transfer.cancellationReason,
              counterpartName: transfer.giverNameSnapshot,
              counterpartEmployeeNumber: transfer.giverEmployeeNumberSnapshot
            }))}
          />
        ) : null}

        {activeAvailability ? (
          <AvailabilityActiveForm
            availabilityId={activeAvailability.id}
            from={formatShortTime(activeAvailability.availableFrom)}
            until={formatShortTime(activeAvailability.availableUntil)}
          />
        ) : (
          <AvailabilityCreateForm defaultFrom={toDateTimeLocalValue(new Date())} />
        )}

        <TransferList
          emptyText="Du har ikke nogen aktive oprettede anmodninger."
          title="Mine aktive vagtoverdragelser"
          transfers={activeMyCreatedRequests.map((transfer) => ({
            id: transfer.id,
            transferNumber: transfer.transferNumber,
            status: transfer.status,
            requestedStartAt: transfer.requestedStartAt,
            expectedEndMode: transfer.expectedEndMode,
            expectedEndAt: transfer.expectedEndAt,
            calculatedShiftEndAt: transfer.calculatedShiftEndAt,
            comment: transfer.comment,
            receiverResponseComment: transfer.receiverResponseComment,
            vcDecision: transfer.vcDecision,
            vcComment: transfer.vcComment,
            cancelledAt: transfer.cancelledAt,
            cancellationReason: transfer.cancellationReason,
            counterpartName: transfer.receiverNameSnapshot,
            counterpartEmployeeNumber: transfer.receiverEmployeeNumberSnapshot
          }))}
        />

        <details className="grid gap-3 rounded-2xl border border-zinc-200 bg-white p-4">
          <summary className="focus-ring cursor-pointer rounded-xl text-xl font-bold">Tidligere sager</summary>
          <div className="mt-3 grid gap-4">
            <TransferList
              emptyText="Der er ingen tidligere sager."
              title="Tidligere vagtoverdragelser"
              transfers={previousTransfers.map((transfer) => ({
                id: transfer.id,
                transferNumber: transfer.transferNumber,
                status: transfer.status,
                requestedStartAt: transfer.requestedStartAt,
                expectedEndMode: transfer.expectedEndMode,
                expectedEndAt: transfer.expectedEndAt,
                calculatedShiftEndAt: transfer.calculatedShiftEndAt,
                comment: transfer.comment,
                receiverResponseComment: transfer.receiverResponseComment,
                vcDecision: transfer.vcDecision,
                vcComment: transfer.vcComment,
                cancelledAt: transfer.cancelledAt,
                cancellationReason: transfer.cancellationReason,
                counterpartName:
                  transfer.giverUserId === user.id ? transfer.receiverNameSnapshot : transfer.giverNameSnapshot,
                counterpartEmployeeNumber:
                  transfer.giverUserId === user.id
                    ? transfer.receiverEmployeeNumberSnapshot
                    : transfer.giverEmployeeNumberSnapshot
              }))}
            />
            <section className="app-card grid gap-3">
              <h2 className="text-xl font-bold">Tidligere tilgængeligheder</h2>
              {previousAvailabilityHistory.length === 0 ? (
                <p className="text-sm font-semibold text-zinc-600">Ingen tidligere tilgængeligheder.</p>
              ) : (
                <div className="grid gap-2">
                  {previousAvailabilityHistory.map((availability) => (
                    <div
                      className="rounded-2xl border border-zinc-100 bg-zinc-50 p-4"
                      key={availability.id}
                    >
                      <p className="font-bold">{availabilityStatusLabel(availability.status)}</p>
                      <p className="mt-1 text-sm font-semibold text-zinc-600">
                        {formatShortTime(availability.availableFrom)} → {formatShortTime(availability.availableUntil)}
                      </p>
                      {availability.status === AvailabilityStatus.ACKNOWLEDGED && availability.acknowledgedAt ? (
                        <p className="mt-1 text-sm font-semibold text-emerald-700">
                          Bekræftet {formatDateTime(availability.acknowledgedAt)}
                        </p>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </details>
      </main>
    </>
  );
}

function toDateTimeLocalValue(date: Date) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Copenhagen",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    }).formatToParts(date).map((part) => [part.type, part.value])
  );

  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

function formatShortTime(date: Date) {
  return new Intl.DateTimeFormat("da-DK", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Copenhagen"
  }).format(date);
}
