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
      <OperationalScreenHeader backHref={`/admin/operativ-portal/koeretoejer/${vehicle.id}`} right={<AppIcon className="size-5" name="settings" />} title={`Administrér ${vehicle.name}`} />
      <OperationalPortalNav isEditor />

      <section className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-red-400">Køretøjsadministration</p>
        <h1 className="mt-1 text-2xl font-black">To trin — ikke flere parallelle editorer</h1>
        <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-slate-400">
          Start med billeder og pluspunkter. Gå derefter videre til rum og udstyr. Alt for køretøjet samles på denne side.
        </p>

        <nav aria-label="Sektioner i køretøjsadministration" className="mt-4 grid gap-2 sm:grid-cols-2">
          <a className="grid min-h-20 grid-cols-[40px_minmax(0,1fr)_20px] items-center gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-white hover:bg-red-500/15" href="#billeder-plus">
            <span className="grid size-10 place-items-center rounded-lg bg-red-600"><AppIcon className="size-5" name="camera" /></span>
            <span><strong className="block text-sm font-black">1. Billeder og pluspunkter</strong><small className="mt-1 block text-xs font-semibold text-slate-400">Front, højre, bagende, venstre og tag.</small></span>
            <AppIcon className="size-4 text-slate-400" name="chevronRight" />
          </a>
          <a className="grid min-h-20 grid-cols-[40px_minmax(0,1fr)_20px] items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3 text-white hover:bg-white/10" href="#rum-udstyr">
            <span className="grid size-10 place-items-center rounded-lg bg-[#242b30]"><AppIcon className="size-5" name="archive" /></span>
            <span><strong className="block text-sm font-black">2. Rum og udstyr</strong><small className="mt-1 block text-xs font-semibold text-slate-400">Sortér, flyt, kopiér og redigér pakkestrukturen.</small></span>
            <AppIcon className="size-4 text-slate-400" name="chevronRight" />
          </a>
        </nav>

        <div className="mt-3 flex flex-wrap gap-2">
          <Link className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-white/10 bg-[#151b1f] px-3 py-2 text-xs font-black text-white" href={`/admin/operativ-portal/koeretoejer/${vehicle.id}`}><AppIcon className="size-4" name="back" /> Se køretøjssiden</Link>
          <Link className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-xs font-black text-white hover:bg-red-700" href={`/admin/operativ-portal/koeretoejer/${vehicle.id}/foto`}><AppIcon className="size-4" name="camera" /> Start fototur</Link>
        </div>
      </section>

      <details className="rounded-xl border border-white/10 bg-[#0d1317] p-4">
        <summary className="cursor-pointer text-sm font-black text-slate-200">Status og manglende indhold</summary>
        <div className="mt-4"><OperationalContentReadinessPanel data={readiness} /></div>
      </details>

      <section className="scroll-mt-4" id="billeder-plus">
        <div className="mb-3">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-red-400">Trin 1</p>
          <h2 className="text-xl font-black text-white">Billeder og pluspunkter</h2>
          <p className="mt-1 text-xs font-semibold text-slate-500">Et plus gemmes kun på den valgte side af køretøjet.</p>
        </div>
        <OperationalVehicleViewManager
          hotspots={hotspots}
          images={detail.images.map((image) => ({ id: image.id, title: image.title, originalName: image.originalName }))}
          key={viewKey}
          places={vehicle.rooms.map((room) => ({ id: room.id, name: room.name }))}
          vehicleId={vehicle.id}
          views={views}
        />
      </section>

      <section className="scroll-mt-4" id="rum-udstyr">
        <div className="mb-3">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-red-400">Trin 2</p>
          <h2 className="text-xl font-black text-white">Rum og udstyr</h2>
          <p className="mt-1 text-xs font-semibold text-slate-500">Når billederne er på plads, organiserer du rummene og pakkelisten her.</p>
        </div>
        <OperationalAdminOrganizer key={organizerKey} initialRooms={vehicle.rooms} vehicleId={vehicle.id} vehicleName={vehicle.name} />
      </section>
    </OperationalPageFrame>
  );
}
