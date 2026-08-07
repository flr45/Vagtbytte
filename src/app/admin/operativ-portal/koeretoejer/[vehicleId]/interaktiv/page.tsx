import Link from "next/link";
import { notFound } from "next/navigation";
import {
  OperationalPageFrame,
  OperationalPortalNav,
  OperationalScreenHeader
} from "@/components/OperationalPortalNav";
import {
  canManageOperationalPortal,
  requireOperationalPortalAccess
} from "@/lib/auth";
import { getVehicleInteractiveData, groupRooms } from "@/lib/operativ-interactive";
import { operationalImageUrl } from "@/lib/operativ-portal";

export const dynamic = "force-dynamic";
type PageProps = { params: Promise<{ vehicleId: string }> };

export default async function OperationalVehicleInteractivePage({ params }: PageProps) {
  const user = await requireOperationalPortalAccess();
  const isEditor = canManageOperationalPortal(user);
  const { vehicleId } = await params;
  const vehicle = await getVehicleInteractiveData(vehicleId);
  if (!vehicle) notFound();

  const imageId = vehicle.interactiveImageId || vehicle.coverImageId;
  const roomGroups = groupRooms(vehicle.rooms);

  return (
    <OperationalPageFrame>
      <OperationalScreenHeader backHref={`/admin/operativ-portal/koeretoejer/${vehicle.id}`} title={`Interaktiv · ${vehicle.name}`} />
      <OperationalPortalNav isEditor={isEditor} />

      <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#080c0f] shadow-2xl">
        <div className="border-b border-white/10 bg-[#b70f18] px-4 py-3 text-center">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-red-100/70">Trin 1 af 2</p>
          <h1 className="mt-0.5 text-base font-black text-white">Tryk på et + for at åbne et rum</h1>
        </div>

        {imageId ? (
          <div className="relative overflow-hidden bg-black">
            <img alt={`Interaktiv oversigt over ${vehicle.name}`} className="block w-full" src={operationalImageUrl(imageId)} />
            {vehicle.hotspots.map((hotspot) => (
              <Link
                aria-label={`Åbn ${hotspot.label || hotspot.placeName}`}
                className="absolute grid -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-white bg-[#d71920] font-black leading-none text-white shadow-[0_5px_22px_rgba(0,0,0,.75)] transition hover:scale-110 focus:scale-110"
                href={`/admin/operativ-portal/rum/${hotspot.placeId}/interaktiv`}
                key={hotspot.id}
                style={{
                  left: `${hotspot.xPercent}%`,
                  top: `${hotspot.yPercent}%`,
                  width: hotspot.sizePx,
                  height: hotspot.sizePx,
                  fontSize: Math.max(18, Math.round(hotspot.sizePx * 0.55))
                }}
                title={hotspot.label || hotspot.placeName}
              >+</Link>
            ))}
          </div>
        ) : (
          <div className="grid min-h-56 place-items-center px-6 text-center text-sm font-semibold text-slate-500">Der er endnu ikke valgt et interaktivt billede til køretøjet.</div>
        )}

        <div className="border-t border-white/10 bg-[#0d1317] p-3">
          <p className="text-center text-xs font-bold text-slate-400">Tryk på et rødt plus for at gå ind i rummet. Derinde kan du trykke videre på et nyt plus og åbne værktøjet.</p>
        </div>
      </section>

      <section className="grid gap-4">
        <div className="flex items-end justify-between px-1">
          <div><p className="text-[10px] font-black uppercase tracking-[0.16em] text-red-500">Rumoversigt</p><h2 className="text-lg font-black">Alle rum – opdelt efter placering</h2></div>
          <span className="text-xs font-bold text-slate-500">{vehicle.rooms.length} rum</span>
        </div>

        {roomGroups.map((group) => (
          <section className="overflow-hidden rounded-xl border border-white/10 bg-[#0d1317]" key={group.section}>
            <div className="flex items-center justify-between border-b border-white/10 bg-[#131a1f] px-4 py-3">
              <h3 className="text-sm font-black text-white">{group.section}</h3>
              <span className="rounded-full bg-white/5 px-2 py-1 text-[10px] font-black text-slate-400">{group.rooms.length}</span>
            </div>
            <div className="grid gap-2 p-2 sm:grid-cols-2">
              {group.rooms.map((room) => (
                <Link className="grid grid-cols-[54px_minmax(0,1fr)_22px] items-center gap-3 rounded-lg border border-white/5 bg-[#11171b] p-2 hover:border-red-500/30 hover:bg-[#161e23]" href={`/admin/operativ-portal/rum/${room.id}/interaktiv`} key={room.id}>
                  {room.coverImageId ? <img alt="" className="size-14 rounded-md bg-[#20272c] object-cover" src={operationalImageUrl(room.coverImageId)} /> : <div className="grid size-14 place-items-center rounded-md bg-[#20272c] text-[9px] font-black text-slate-500">RUM</div>}
                  <span className="min-w-0"><strong className="block truncate text-sm">{room.name}</strong><small className="mt-1 block text-xs text-slate-500">{room.itemCount} udstyrsposter</small></span>
                  <span className="text-xl text-red-500">›</span>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </section>
    </OperationalPageFrame>
  );
}
