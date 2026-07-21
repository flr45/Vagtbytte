import { AvailabilityStatus, UserRole } from "@prisma/client";
import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { availabilityStatusLabel } from "@/lib/availability";
import { prisma } from "@/lib/prisma";
import { AvailabilityActiveForm, AvailabilityCreateForm } from "@/components/AvailabilityForms";
import { TopBar } from "@/components/TopBar";
import { formatDateTime, TransferList } from "@/components/TransferSummary";

export default async function FirefighterPage() {
  const user = await requireRole(UserRole.BRANDFIGHTER);
  const [requestsToMe, myCreatedRequests, activeAvailability, availabilityHistory] = await Promise.all([
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
  const activeRequestsToMe = requestsToMe.filter((transfer) => activeStatuses.has(transfer.status));
  const activeMyCreatedRequests = myCreatedRequests.filter((transfer) => activeStatuses.has(transfer.status));
  const previousTransfers = [...requestsToMe, ...myCreatedRequests].filter((transfer) => !activeStatuses.has(transfer.status));

  return (
    <>
      <TopBar title="Vagtoverdragelse" />
      <main className="mx-auto grid w-full max-w-3xl gap-6 px-4 py-6">
        <section className="rounded-lg border border-brand-line bg-white p-5 shadow-sm">
          <h1 className="text-3xl font-bold">Vagtoverdragelse</h1>
          <dl className="mt-5 grid gap-3 rounded-md bg-brand-mist p-4">
            <div>
              <dt className="text-sm font-semibold text-zinc-600">Navn</dt>
              <dd className="mt-1 text-lg font-bold">{user.name}</dd>
            </div>
            <div>
              <dt className="text-sm font-semibold text-zinc-600">Medarbejdernummer</dt>
              <dd className="mt-1 text-lg font-bold">{user.employeeNumber}</dd>
            </div>
          </dl>
          <Link
            className="focus-ring mt-5 inline-flex min-h-14 w-full items-center justify-center rounded-md bg-brand-red px-5 text-lg font-bold text-white sm:w-auto"
            href="/brandmand/ny"
          >
            Opret vagtoverdragelse
          </Link>
        </section>
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
          emptyText="Der er ingen anmodninger rettet til dig."
          title="Anmodninger til mig"
          transfers={activeRequestsToMe.map((transfer) => ({
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
        <TransferList
          emptyText="Du har ikke oprettet nogen anmodninger."
          title="Mine oprettede anmodninger"
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
        <details className="grid gap-3">
          <summary className="cursor-pointer text-xl font-bold">Tidligere sager</summary>
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
              <h2 className="text-xl font-bold">Til rådighed</h2>
              {availabilityHistory.length === 0 ? (
                <p className="text-sm font-semibold text-zinc-600">Ingen tidligere tilgængeligheder.</p>
              ) : (
                <div className="grid gap-2">
                  {availabilityHistory.map((availability) => (
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
