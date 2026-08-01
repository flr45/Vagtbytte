"use client";

import type { AvailabilityStatus } from "@prisma/client";
import { availabilityStatusLabel } from "@/lib/availability";
import {
  VcAssignAvailabilityForm,
  VcUnassignAvailabilityForm
} from "./AvailabilityForms";
import { formatDateTime } from "./TransferSummary";
import { InboxIcon } from "./Icons";

export type ManagedAvailability = {
  id: string;
  userName: string;
  userEmployeeNumber: string | null;
  availableFrom: string;
  availableUntil: string;
  status: AvailabilityStatus;
  assignedAt: string | null;
  acknowledgedAt: string | null;
};

export function VcAvailabilityManagement({
  currentAssignments,
  availableFirefighters,
  previousAvailabilities
}: {
  currentAssignments: ManagedAvailability[];
  availableFirefighters: ManagedAvailability[];
  previousAvailabilities: ManagedAvailability[];
}) {
  return (
    <div className="mx-auto grid w-full max-w-6xl gap-6 px-4 pt-6">
      <CurrentAssignments assignments={currentAssignments} />
      <AvailableFirefighters
        availabilities={availableFirefighters}
        previousAvailabilities={previousAvailabilities}
      />
    </div>
  );
}

function CurrentAssignments({ assignments }: { assignments: ManagedAvailability[] }) {
  return (
    <section className="grid gap-4">
      <div>
        <h1 className="text-3xl font-bold">Aktuelt tildelt ({assignments.length})</h1>
        <p className="text-sm font-semibold text-zinc-600">
          Tildelingen er gældende med det samme og kræver ikke svar fra brandmanden.
        </p>
      </div>
      {assignments.length === 0 ? (
        <EmptyState text="Ingen er tildelt vagt lige nu." />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {assignments.map((assignment) => (
            <article
              className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5 shadow-[0_10px_30px_rgba(15,23,42,0.08)]"
              key={assignment.id}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-xl font-black text-emerald-950">{assignment.userName}</h2>
                  <p className="mt-1 text-sm font-bold text-emerald-800">
                    Medarbejdernummer: {assignment.userEmployeeNumber ?? "Ikke angivet"}
                  </p>
                  <dl className="mt-3 grid gap-2 text-sm font-semibold text-emerald-950">
                    <div>
                      <dt className="text-xs font-black uppercase text-emerald-700">Tildelt</dt>
                      <dd className="text-lg font-black">{formatShortTime(assignment.assignedAt)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-black uppercase text-emerald-700">Status</dt>
                      <dd className="text-base font-black">Tildelt</dd>
                    </div>
                  </dl>
                </div>
                <span className="w-fit rounded-full bg-emerald-100 px-3 py-1 text-sm font-black text-emerald-900">
                  ● Tildelt
                </span>
              </div>
              <VcUnassignAvailabilityForm availabilityId={assignment.id} />
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function AvailableFirefighters({
  availabilities,
  previousAvailabilities
}: {
  availabilities: ManagedAvailability[];
  previousAvailabilities: ManagedAvailability[];
}) {
  return (
    <section className="grid gap-4">
      <div>
        <h1 className="text-3xl font-bold">Til rådighed</h1>
        <p className="text-sm font-semibold text-zinc-600">Til rådighed ({availabilities.length})</p>
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
                <p className="mt-1 text-sm font-bold text-zinc-600">
                  Medarbejdernummer: {availability.userEmployeeNumber ?? "Ikke angivet"}
                </p>
                <p className="mt-1 text-lg font-bold text-zinc-700">
                  {formatShortTime(availability.availableFrom)} → {formatShortTime(availability.availableUntil)}
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
                <p className="text-sm font-semibold text-zinc-600">
                  Medarbejdernummer: {availability.userEmployeeNumber ?? "Ikke angivet"}
                </p>
                <p className="mt-1 text-sm font-semibold text-zinc-600">
                  {availabilityStatusLabel(availability.status)}
                  {availability.assignedAt
                    ? ` · tildelt ${formatDateTime(new Date(availability.assignedAt))}`
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

function EmptyState({ text }: { text: string }) {
  return (
    <div className="app-card grid place-items-center gap-3 py-8 text-center text-sm text-zinc-600">
      <InboxIcon className="size-9 text-zinc-400" />
      <p>{text}</p>
    </div>
  );
}

function formatShortTime(value: string | null) {
  if (!value) return "Ukendt";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Ukendt";
  return new Intl.DateTimeFormat("da-DK", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Copenhagen"
  }).format(date);
}
