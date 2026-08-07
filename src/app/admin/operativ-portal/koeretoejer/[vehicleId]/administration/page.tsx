import Link from "next/link";
import { notFound } from "next/navigation";
import { UserRole } from "@prisma/client";
import { OperationalAdminOrganizer } from "@/components/OperationalAdminOrganizer";
import {
  OperationalPageFrame,
  OperationalPortalNav,
  OperationalScreenHeader
} from "@/components/OperationalPortalNav";
import { requireRole } from "@/lib/auth";
import { getOperationalAdminVehicle } from "@/lib/operativ-admin";

export const dynamic = "force-dynamic";
type PageProps = { params: Promise<{ vehicleId: string }> };

export default async function OperationalVehicleAdministrationPage({ params }: PageProps) {
  await requireRole(UserRole.ADMIN);
  const { vehicleId } = await params;
  const vehicle = await getOperationalAdminVehicle(vehicleId);
  if (!vehicle) notFound();

  return (
    <OperationalPageFrame>
      <OperationalScreenHeader backHref={`/admin/operativ-portal/koeretoejer/${vehicle.id}`} right="⚙" title={`Organisér ${vehicle.name}`} />
      <OperationalPortalNav isEditor />

      <section className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-red-400">Administrationsværktøj</p>
        <h1 className="mt-1 text-2xl font-black">Byg pakkestrukturen hurtigere</h1>
        <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-slate-400">
          Sortér rum og udstyr, flyt flere udstyrsposter mellem rum og lav kopier uden at genindtaste navn, antal, note og specifikationer. Billeder, dokumenter og interaktive plusser kopieres ikke automatisk.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link className="rounded-lg border border-white/10 bg-[#151b1f] px-3 py-2 text-xs font-black text-white" href={`/admin/operativ-portal/koeretoejer/${vehicle.id}`}>← Køretøjsside</Link>
          <Link className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-black text-red-300" href={`/admin/operativ-portal/koeretoejer/${vehicle.id}/interaktiv`}>Interaktiv visning</Link>
        </div>
      </section>

      <OperationalAdminOrganizer initialRooms={vehicle.rooms} vehicleId={vehicle.id} vehicleName={vehicle.name} />
    </OperationalPageFrame>
  );
}
