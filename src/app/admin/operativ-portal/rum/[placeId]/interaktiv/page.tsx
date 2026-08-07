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
import { getPlaceInteractiveData } from "@/lib/operativ-interactive";
import { operationalImageUrl } from "@/lib/operativ-portal";

export const dynamic = "force-dynamic";
type PageProps = { params: Promise<{ placeId: string }> };

export default async function OperationalPlaceInteractivePage({ params }: PageProps) {
  const user = await requireOperationalPortalAccess();
  const isEditor = canManageOperationalPortal(user);
  const { placeId } = await params;
  const place = await getPlaceInteractiveData(placeId);
  if (!place) notFound();

  const imageId = place.interactiveImageId || place.coverImageId;

  return (
    <OperationalPageFrame>
      <OperationalScreenHeader backHref={`/admin/operativ-portal/koeretoejer/${place.vehicleId}/interaktiv`} title={place.name} />
      <OperationalPortalNav isEditor={isEditor} />

      <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#080c0f] shadow-2xl">
        <div className="border-b border-white/10 bg-[#b70f18] px-4 py-3 text-center">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-red-100/70">Trin 2 af 2</p>
          <h1 className="mt-0.5 text-base font-black text-white">Tryk på et + for at åbne værktøjet</h1>
        </div>

        {imageId ? (
          <div className="relative overflow-hidden bg-black">
            <img alt={`Interaktiv oversigt over ${place.name}`} className="block w-full" src={operationalImageUrl(imageId)} />
            {place.hotspots.map((hotspot) => (
              <Link
                aria-label={`Åbn ${hotspot.label || hotspot.itemName}`}
                className="absolute grid -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-white bg-[#d71920] font-black leading-none text-white shadow-[0_5px_22px_rgba(0,0,0,.75)] transition hover:scale-110 focus:scale-110"
                href={`/admin/operativ-portal/udstyr/${hotspot.itemId}`}
                key={hotspot.id}
                style={{
                  left: `${hotspot.xPercent}%`,
                  top: `${hotspot.yPercent}%`,
                  width: hotspot.sizePx,
                  height: hotspot.sizePx,
                  fontSize: Math.max(18, Math.round(hotspot.sizePx * 0.55))
                }}
                title={hotspot.label || hotspot.itemName}
              >+</Link>
            ))}
          </div>
        ) : (
          <div className="grid min-h-56 place-items-center px-6 text-center text-sm font-semibold text-slate-500">Der er endnu ikke valgt et interaktivt billede til rummet.</div>
        )}

        <div className="border-t border-white/10 bg-[#0d1317] p-3">
          <p className="text-center text-xs font-bold text-slate-400">{place.vehicleName} → {place.name} → vælg værktøj</p>
        </div>
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between px-1"><h2 className="text-sm font-black">Værktøj i {place.name}</h2><span className="text-xs font-bold text-slate-500">{place.items.length} poster</span></div>
        <div className="grid gap-2 sm:grid-cols-2">
          {place.items.map((item) => (
            <Link className="grid min-h-[70px] grid-cols-[58px_minmax(0,1fr)_22px] items-center gap-3 rounded-lg border border-white/5 bg-[#11171b] p-2 hover:border-red-500/30 hover:bg-[#161e23]" href={`/admin/operativ-portal/udstyr/${item.id}`} key={item.id}>
              {item.coverImageId ? <img alt="" className="size-14 rounded-md bg-[#20272c] object-cover" src={operationalImageUrl(item.coverImageId)} /> : <div className="grid size-14 place-items-center rounded-md bg-[#20272c] text-[9px] font-black text-slate-500">UD</div>}
              <span className="min-w-0"><span className="flex items-center gap-2"><strong className="block truncate text-sm">{item.name}</strong>{item.quantity > 1 ? <small className="rounded bg-red-600 px-1.5 py-0.5 text-[9px] font-black text-white">×{item.quantity}</small> : null}</span><small className="mt-1 block truncate text-xs text-slate-500">{item.note || "Åbn udstyr"}</small></span>
              <span className="text-xl text-red-500">›</span>
            </Link>
          ))}
          {place.items.length === 0 ? <p className="col-span-full rounded-lg border border-dashed border-white/15 bg-white/5 p-6 text-center text-sm text-slate-500">Ingen udstyrsposter i rummet.</p> : null}
        </div>
      </section>
    </OperationalPageFrame>
  );
}
