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
import { getOperationalInteractiveContext } from "@/lib/operativ-content-builder";
import { operationalImageUrl } from "@/lib/operativ-portal";

export const dynamic = "force-dynamic";
type PageProps = {
  params: Promise<{ placeId: string }>;
  searchParams: Promise<{ node?: string | string[] }>;
};

export default async function OperationalPlaceInteractivePage({ params, searchParams }: PageProps) {
  const user = await requireOperationalPortalAccess();
  const isEditor = canManageOperationalPortal(user);
  const { placeId } = await params;
  const query = await searchParams;
  const nodeId = typeof query.node === "string" ? query.node : null;
  const context = await getOperationalInteractiveContext(placeId, nodeId);
  if (!context) notFound();

  const base = `/admin/operativ-portal/rum/${placeId}/interaktiv`;
  const backHref = context.nodeId
    ? context.parentNodeId ? `${base}?node=${context.parentNodeId}` : base
    : `/admin/operativ-portal/koeretoejer/${context.vehicleId}/interaktiv`;
  const title = context.nodeName || context.placeName;

  return (
    <OperationalPageFrame>
      <OperationalScreenHeader backHref={backHref} title={title} />
      <OperationalPortalNav isEditor={isEditor} />

      <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#080c0f] shadow-2xl">
        <div className="border-b border-white/10 bg-[#b70f18] px-4 py-3 text-center">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-red-100/70">Interaktiv placering</p>
          <h1 className="mt-0.5 text-base font-black text-white">Tryk på et + for at gå videre</h1>
        </div>

        {context.imageId ? (
          <div className="relative overflow-hidden bg-black">
            <img alt={`Interaktiv oversigt over ${title}`} className="block w-full" src={operationalImageUrl(context.imageId)} />
            {context.links.map((hotspot) => {
              const href = hotspot.targetType === "node" && hotspot.targetNodeId
                ? `${base}?node=${hotspot.targetNodeId}`
                : hotspot.itemId ? `/admin/operativ-portal/udstyr/${hotspot.itemId}` : base;
              return (
                <Link
                  aria-label={`Åbn ${hotspot.label || hotspot.targetName}`}
                  className="absolute grid -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-white bg-[#d71920] font-black leading-none text-white shadow-[0_5px_22px_rgba(0,0,0,.75)] transition hover:scale-110 focus:scale-110"
                  href={href}
                  key={hotspot.id}
                  style={{
                    left: `${hotspot.xPercent}%`,
                    top: `${hotspot.yPercent}%`,
                    width: hotspot.sizePx,
                    height: hotspot.sizePx,
                    fontSize: Math.max(18, Math.round(hotspot.sizePx * 0.55))
                  }}
                  title={hotspot.label || hotspot.targetName}
                >+</Link>
              );
            })}
          </div>
        ) : (
          <div className="grid min-h-56 place-items-center px-6 text-center text-sm font-semibold text-slate-500">Der er endnu ikke valgt et interaktivt billede til dette niveau.</div>
        )}

        <div className="border-t border-white/10 bg-[#0d1317] p-3">
          <div className="flex flex-wrap items-center justify-center gap-1 text-center text-xs font-bold text-slate-400">
            <span>{context.vehicleName}</span><span>→</span><span>{context.placeName}</span>
            {context.breadcrumbs.map((crumb) => <span className="contents" key={crumb.id}><span>→</span><span className={crumb.id === context.nodeId ? "text-white" : ""}>{crumb.name}</span></span>)}
          </div>
        </div>
      </section>

      {context.children.length > 0 ? (
        <section>
          <div className="mb-2 flex items-center justify-between px-1"><h2 className="text-sm font-black">Underområder</h2><span className="text-xs font-bold text-slate-500">{context.children.length}</span></div>
          <div className="grid gap-2 sm:grid-cols-2">
            {context.children.map((node) => (
              <Link className="grid min-h-[68px] grid-cols-[minmax(0,1fr)_22px] items-center gap-3 rounded-lg border border-white/5 bg-[#11171b] p-3 hover:border-red-500/30 hover:bg-[#161e23]" href={`${base}?node=${node.id}`} key={node.id}>
                <span className="min-w-0"><strong className="block truncate text-sm">{node.name}</strong><small className="mt-1 block truncate text-xs text-slate-500">{node.description || "Åbn næste niveau"}</small></span>
                <span className="text-xl text-red-500">›</span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {isEditor ? (
        <Link className="flex min-h-12 items-center justify-center rounded-lg border border-red-500/30 bg-red-500/10 px-4 text-sm font-black text-red-300" href={`/admin/operativ-portal/rum/${placeId}/byg${context.nodeId ? `?node=${context.nodeId}` : ""}`}>✚ Redigér dette interaktive niveau</Link>
      ) : null}
    </OperationalPageFrame>
  );
}
