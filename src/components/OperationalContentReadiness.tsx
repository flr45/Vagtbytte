import Link from "next/link";
import type { OperationalContentReadiness } from "@/lib/operativ-content-builder";

const chipClass = "rounded-md border border-white/10 bg-black/20 px-2 py-1 text-[10px] font-bold text-slate-400";
const linkChipClass = `${chipClass} transition hover:border-red-500/40 hover:text-white`;

export function OperationalContentReadinessPanel({ data }: { data: OperationalContentReadiness }) {
  const issueCount = data.missingVehicleViews.length
    + data.roomsMissingImage.length
    + data.roomsMissingInteractiveLinks.length
    + data.itemsMissingImage.length
    + data.nodesMissingImage.length
    + data.nodesMissingLinks.length;
  const ready = issueCount === 0;

  return (
    <section className={`rounded-xl border p-4 ${ready ? "border-emerald-500/25 bg-emerald-500/5" : "border-amber-500/25 bg-amber-500/5"}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className={`text-[10px] font-black uppercase tracking-[0.16em] ${ready ? "text-emerald-400" : "text-amber-400"}`}>Indholdskontrol</p>
          <h2 className="mt-1 text-xl font-black text-white">{ready ? "Køretøjet er visuelt komplet" : `${issueCount} ting mangler indhold`}</h2>
          <p className="mt-1 text-xs font-semibold leading-5 text-slate-400">Kontrollen ser efter køretøjsvisninger, interaktive billeder, pluspunkter og værktøjsbilleder.</p>
        </div>
        <div className={`grid min-w-20 place-items-center rounded-xl px-4 py-3 text-center ${ready ? "bg-emerald-500/15" : "bg-amber-500/15"}`}>
          <strong className="text-2xl text-white">{ready ? "✓" : issueCount}</strong>
          <small className="text-[9px] font-black uppercase tracking-wide text-slate-400">{ready ? "klar" : "mangler"}</small>
        </div>
      </div>

      {!ready ? (
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {data.missingVehicleViews.length ? <Issue count={data.missingVehicleViews.length} title="Køretøjsvisninger">{data.missingVehicleViews.map((name) => <span className={chipClass} key={name}>{name}</span>)}</Issue> : null}
          {data.roomsMissingImage.length ? <Issue count={data.roomsMissingImage.length} title="Rum uden interaktivt billede">{data.roomsMissingImage.map((room) => <Link className={linkChipClass} href={`/admin/operativ-portal/rum/${room.id}/byg`} key={room.id}>{room.name}</Link>)}</Issue> : null}
          {data.roomsMissingInteractiveLinks.length ? <Issue count={data.roomsMissingInteractiveLinks.length} title="Rum uden pluspunkter">{data.roomsMissingInteractiveLinks.map((room) => <Link className={linkChipClass} href={`/admin/operativ-portal/rum/${room.id}/byg`} key={room.id}>{room.name}</Link>)}</Issue> : null}
          {data.itemsMissingImage.length ? <Issue count={data.itemsMissingImage.length} title="Værktøj uden billede">{data.itemsMissingImage.slice(0, 18).map((item) => <Link className={linkChipClass} href={`/admin/operativ-portal/udstyr/${item.id}`} key={item.id}>{item.placeName} · {item.name}</Link>)}</Issue> : null}
          {data.nodesMissingImage.length ? <Issue count={data.nodesMissingImage.length} title="Underområder uden billede">{data.nodesMissingImage.map((node) => <Link className={linkChipClass} href={`/admin/operativ-portal/rum/${node.placeId}/byg?node=${node.id}`} key={node.id}>{node.placeName} · {node.name}</Link>)}</Issue> : null}
          {data.nodesMissingLinks.length ? <Issue count={data.nodesMissingLinks.length} title="Underområder uden næste trin">{data.nodesMissingLinks.map((node) => <Link className={linkChipClass} href={`/admin/operativ-portal/rum/${node.placeId}/byg?node=${node.id}`} key={node.id}>{node.placeName} · {node.name}</Link>)}</Issue> : null}
        </div>
      ) : null}
    </section>
  );
}

function Issue({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-white/10 bg-[#11191e] p-3">
      <div className="mb-2 flex items-center justify-between gap-2"><strong className="text-xs text-white">{title}</strong><span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-black text-slate-400">{count}</span></div>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}
