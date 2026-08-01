import { notFound } from "next/navigation";
import { UserRole } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { availabilityStatusLabel } from "@/lib/availability";
import { prisma } from "@/lib/prisma";
import { TopBar } from "@/components/TopBar";
import { formatDateTime } from "@/components/TransferSummary";

export default async function AvailabilityAssignmentPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireRole(UserRole.BRANDFIGHTER);
  const { id } = await params;
  const availability = await prisma.availability.findFirst({
    where: { id, userId: user.id }
  });

  if (!availability) {
    notFound();
  }

  return (
    <>
      <TopBar title="Vagttildeling" />
      <main className="mx-auto grid w-full max-w-xl gap-5 px-4 py-6">
        <section className="app-card grid gap-5">
          <div>
            <p className="text-sm font-bold uppercase text-emerald-700">Vagtcentralen</p>
            <h1 className="mt-2 text-3xl font-black">
              {availability.assignedAt ? "Du er blevet tildelt en vagt." : "Vagttildelingen er ændret."}
            </h1>
            <p className="mt-3 text-sm font-semibold text-zinc-600">
              {formatDateTime(availability.availableFrom)} → {formatDateTime(availability.availableUntil)}
            </p>
          </div>
          <div className="rounded-2xl border border-zinc-100 bg-zinc-50 p-4">
            <p className="font-bold">{availabilityStatusLabel(availability.status)}</p>
            {availability.assignedAt ? (
              <p className="mt-1 text-sm font-semibold text-zinc-600">
                Tildelt {formatDateTime(availability.assignedAt)}. Du skal ikke bekræfte tildelingen.
              </p>
            ) : (
              <p className="mt-1 text-sm font-semibold text-zinc-600">
                Tildelingen er fjernet af vagtcentralen.
              </p>
            )}
          </div>
        </section>
      </main>
    </>
  );
}
