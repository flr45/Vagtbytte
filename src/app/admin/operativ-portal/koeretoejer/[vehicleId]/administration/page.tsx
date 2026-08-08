import Link from "next/link";
import { notFound } from "next/navigation";
import { UserRole } from "@prisma/client";
import { AppIcon } from "@/components/AppIcon";
import { OperationalAdminOrganizer } from "@/components/OperationalAdminOrganizer";
import { OperationalContentReadinessPanel } from "@/components/OperationalContentReadiness";
import { OperationalVehicleViewManager } from "@/components/OperationalVehicleViewManager";
import {
  OperationalPageFrame,
  OperationalPortalNav,
  OperationalScreenHeader
} from "@/components/OperationalPortalNav";
import { requireRole } from "@/lib/auth";
import { getOperationalAdminVehicle } from "@/lib/operativ-admin";
import { getOperationalContentReadiness } from "@/lib/operativ-content-builder";
import { getOperationalVehicle } from "@/lib/operativ-portal";
import {
  listOperationalVehicleViewHotspots,
  listOperationalVehicleViews
} from "@/lib/operativ-vehicle-views";

export const dynamic = "force-dynamic";
type PageProps = { params: Promise<{ vehicleId: string }> };

export default async function OperationalVehicleAdministrationPage({ params }: PageProps) {
  await requireRole(UserRole.ADMIN);
  const { vehicleId } = await params;
  const [vehicle, detail, views, hotspots, readiness] = await Promise.all([
    getOperationalAdminVehicle(vehicleId),
    getOperationalVehicle(vehicleId),
    listOperationalVehicleViews(vehicleId),
    listOperationalVehicleViewHotspots(vehicleId),
    getOperationalContentReadiness(vehicleId)
  ]);
  if (!vehicle || !detail || !readiness) notFound();
  const organizerKey = vehicle.rooms.map((room) => `${room.id}:${room.items.map((item) => item.id).join(",")}`).join("|");
  const viewKey = views.map((view) => `${view.viewKey}:${view.imageId}`).join("|") + hotspots.map((hotspot) => hotspot.id).join("|");

  return (
    <OperationalPageFrame>
      <OperationalScreenHeader backHref={`/admin/operativ-portal/koeretoejer/${vehicle.id}`} right={<AppIcon className="size-5" name="settings" />} title={`Organisér ${vehicle.name}`} />
      <OperationalPortalNav isEditor />

      <section className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-red-400">Administrationsværktøj</p>
        <h1 className="mt-1 text-2xl font-black">Byg pakkestrukturen hurtigere</h1>
        <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-slate-400">
          Sortér rum og udstyr, flyt flere udstyrsposter mellem rum, lav kopier, opbyg køretøjsnavigationen og se præcist hvor der stadig mangler visuelt indhold.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-white/10 bg-[#151b1f] px-3 py-2 text-xs font-black text-white" href={`/admin/operativ-portal/koeretoejer/${vehicle.id}`}><AppIcon className="size-4" name="back" /> Køretøjsside</Link>
          <Link className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-xs font-black text-white hover:bg-red-700" href={`/admin/operativ-portal/koeretoejer/${vehicle.id}/foto`}><AppIcon className="size-4" name="camera" /> Start fototur</Link>
          <Link className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-black text-red-300" href={`/admin/operativ-portal/koeretoejer/${vehicle.id}/interaktiv`}><AppIcon className="size-4" name="activity" /> Interaktiv visning</Link>
        </div>
      </section>

      <OperationalContentReadinessPanel data={readiness} />

      <OperationalVehicleViewManager
        hotspots={hotspots}
        images={detail.images.map((image) => ({ id: image.id, title: image.title, originalName: image.originalName }))}
        key={viewKey}
        places={vehicle.rooms.map((room) => ({ id: room.id, name: room.name }))}
        vehicleId={vehicle.id}
        views={views}
      />

      <OperationalAdminOrganizer key={organizerKey} initialRooms={vehicle.rooms} vehicleId={vehicle.id} vehicleName={vehicle.name} />
    </OperationalPageFrame>
  );
}
