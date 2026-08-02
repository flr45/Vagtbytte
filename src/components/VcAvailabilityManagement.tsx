"use client";

import type { AvailabilityStatus } from "@prisma/client";
import { availabilityStatusLabel } from "@/lib/availability";
import {
  VcAssignAvailabilityForm,
  VcUnassignAvailabilityForm
} from "./AvailabilityForms";
import { formatDateTime } from "./TransferSummary";

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
    <section className="grid gap-3 lg:grid-cols-2">
      <CompactPanel
        count={currentAssignments.length}
        emptyText="Ingen er tildelt vagt lige nu."
        subtitle="Gældende tildelinger"
        title="Aktuelt tildelt"
      >
        {currentAssignments.map((assignment) => (
          <article
            className="grid gap-3 rounded-xl border border-emerald-100 bg-emerald-50 p-3 sm:grid-cols-[1fr_auto] sm:items-center"
            key={assignment.id}
          >
            <div className="min-w-0">
              <p className="truncate font-black text-emerald-950">{assignment.userName}</p>
              <p className="text-sm font-semibold text-emerald-800">
                {assignment.userEmployeeNumber ?? "Uden nummer"} · tildelt {formatShortTime(assignment.assignedAt)}
              </p>
            </div>
            <VcUnassignAvailabilityForm availabilityId={assignment.id} />
          </article>
        ))}
      </CompactPanel>

      <CompactPanel
        count={availableFirefighters.length}
        emptyText="Ingen brandfolk er til rådighed."
        subtitle="Kan tildeles med det samme"
        title="Til rådighed"
      >
        {availableFirefighters.map((availability) => (
          <article
            className="grid gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3 sm:grid-cols-[1fr_auto] sm:items-center"
            key={availability.id}
          >
            <div className="min-w-0">
              <p className="truncate font-black">{availability.userName}</p>
              <p className="text-sm font-semibold text-zinc-600">
                {availability.userEmployeeNumber ?? "Uden nummer"} · {formatShortTime(availability.availableFrom)}–{formatShortTime(availability.availableUntil)}
              </p>
            </div>
            <VcAssignAvailabilityForm availabilityId={availability.id} />
          </article>
        ))}
      </CompactPanel>

      <details className="rounded-2xl border border-zinc-200 bg-white lg:col-span-2">
        <summary className="focus-ring flex min-h-12 cursor-pointer items-center justify-between gap-3 rounded-2xl px-4 text-sm font-black text-zinc-700">
          <span>Tidligere tilgængeligheder</span>
          <span className="rounded-full bg-zinc-100 px-2.5 py-1">{previousAvailabilities.length}</span>
        </summary>
        <div className="grid gap-2 border-t border-zinc-200 p-3 sm:grid-cols-2 lg:grid-cols-3">
          {previousAvailabilities.length === 0 ? (
            <p className="text-sm font-semibold text-zinc-600">Ingen tidligere tilgængeligheder.</p>
          ) : (
            previousAvailabilities.map((availability) => (
              <div className="rounded-xl bg-zinc-50 p-3" key={availability.id}>
                <p className="font-bold">{availability.userName}</p>
                <p className="text-sm font-semibold text-zinc-600">
                  {availabilityStatusLabel(availability.status)}
                  {availability.assignedAt
                    ? ` · ${formatDateTime(new Date(availability.assignedAt))}`
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

function CompactPanel({
  title,
  subtitle,
  count,
  emptyText,
  children
}: {
  title: string;
  subtitle: string;
  count: number;
  emptyText: string;
  children: React.ReactNode;
}) {
  return (
    <details className="rounded-2xl border border-zinc-200 bg-white" open={count > 0}>
      <summary className="focus-ring flex min-h-16 cursor-pointer items-center justify-between gap-3 rounded-2xl px-4">
        <div>
          <h2 className="text-lg font-black">{title}</h2>
          <p className="text-xs font-semibold text-zinc-600">{subtitle}</p>
        </div>
        <span className="rounded-full bg-zinc-100 px-3 py-1 text-sm font-black">{count}</span>
      </summary>
      <div className="grid gap-2 border-t border-zinc-200 p-3">
        {count === 0 ? <p className="text-sm font-semibold text-zinc-600">{emptyText}</p> : children}
      </div>
    </details>
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
