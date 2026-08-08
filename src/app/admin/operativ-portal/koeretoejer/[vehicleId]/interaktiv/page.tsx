import Link from "next/link";
import { notFound } from "next/navigation";
import { AppIcon } from "@/components/AppIcon";
import { OperationalVehicleInteractiveViewer } from "@/components/OperationalVehicleInteractiveViewer";
import {
  OperationalPageFrame,
  OperationalPortalNav,
  OperationalScreenHeader
} from "@/components/OperationalPortalNav";
import {
  canManageOperationalPortal,
  requireOperationalPortalAccess
} from "@/lib/auth";
import { groupRooms } from "@/lib/operativ-interactive";
import { operationalImageUrl } from "@/lib/operativ-portal";
import { getOperationalVehicleViewBundle } from "@/lib/operativ-vehicle-views";

export const dynamic = "force-dynamic";
type PageProps = { params: Promise<{ vehicleId: string }> };

export default async function OperationalVehicleInteractivePage({ params }: PageProps) {
  const user = await requireOperationalPortalAccess();
  const isEditor = canManageOperationalPortal(user);
  const { vehicleId } = await params;
  const vehicle = await getOperationalVehicleViewBundle(vehicleId);
  if (!vehicle) notFound();

  const roomGroups = groupRooms(vehicle.rooms);

  return (
    <OperationalPageFrame>
      <OperationalScreenHeader backHref={`/admin/operativ-portal/koeretoejer/${vehicle.id}`} title={vehicle.name} />
      <OperationalPortalNav isEditor={isEditor} />

      <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#080c0f] shadow-2xl">
        <div className="border-b border-white/10 bg-[#b70f18] px-4 py-3 text-center">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-red-100/70">Find placeringen</p>
          <h1 className="mt-0.5 text-base font-black text-white">Vælg side og tryk på et + ved det rigtige rum</h1>
        </div>

        <OperationalVehicleInteractiveViewer hotspots={vehicle.viewHotspots} vehicleName={vehicle.name} views={vehicle.views} />

        <div className="border-t border-white/10 bg-[#0d1317] p-3">
          <p className="text-center text-xs font-bold leading-5 text-slate-400">Du kan skifte direkte mellem Front, Højre side, Bagende, Venstre side og Tag under billedet.</p>
        </div>
      </section>

      <details className="overflow-hidden rounded-xl border border-white/10 bg-[#0d1317]">
        <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-black text-white marker:hidden">
          <span className="flex items-center gap-2"><AppIcon className="size-5 text-red-500" name="archive" /> Kan du ikke finde rummet? Vis alle rum som liste</span>
          <AppIcon className="size-5 text-slate-500" name="chevronRight" />
        </summary>

        <div className="grid gap-4 border-t border-white/10 p-3">
          <div className="flex items-end justify-between px-1">
            <div><p className="text-[10px] font-black uppercase tracking-[0.16em] text-red-500">Rumoversigt</p><h2 className="text-base font-black">Alle rum – opdelt efter placering</h2></div>
            <span className="text-xs font-bold text-slate-500">{vehicle.rooms.length} rum</span>
          </div>

          {roomGroups.map((group) => (
            <section className="overflow-hidden rounded-xl border border-white/10 bg-[#0b1013]" key={group.section}>
              <div className="flex items-center justify-between border-b border-white/10 bg-[#131a1f] px-4 py-3">
                <h3 className="text-sm font-black text-white">{group.section}</h3>
                <span className="rounded-full bg-white/5 px-2 py-1 text-[10px] font-black text-slate-400">{group.rooms.length}</span>
              </div>
              <div className="grid gap-2 p-2 sm:grid-cols-2">
                {group.rooms.map((room) => (
                  <Link className="grid min-h-[68px] grid-cols-[54px_minmax(0,1fr)_22px] items-center gap-3 rounded-lg border border-white/5 bg-[#11171b] p-2 hover:border-red-500/30 hover:bg-[#161e23]" href={`/admin/operativ-portal/rum/${room.id}/interaktiv`} key={room.id}>
                    {room.coverImageId ? <img alt="" className="size-14 rounded-md bg-[#20272c] object-cover" loading="lazy" src={operationalImageUrl(room.coverImageId)} /> : <div className="grid size-14 place-items-center rounded-md bg-[#20272c] text-[9px] font-black text-slate-500">RUM</div>}
                    <span className="min-w-0"><strong className="block truncate text-sm">{room.name}</strong><small className="mt-1 block text-xs text-slate-500">{room.itemCount} udstyrsposter</small></span>
                    <AppIcon className="size-5 text-red-500" name="chevronRight" />
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      </details>
    </OperationalPageFrame>
  );
}
