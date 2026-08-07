"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { operationalImageUrl } from "@/lib/operativ-client";
import type {
  OperationalVehicleView,
  OperationalVehicleViewHotspot,
  OperationalVehicleViewKey
} from "@/lib/operativ-vehicle-view-model";

const groundOrder: OperationalVehicleViewKey[] = ["front", "right", "rear", "left"];

export function OperationalVehicleInteractiveViewer({
  vehicleName,
  views,
  hotspots
}: {
  vehicleName: string;
  views: OperationalVehicleView[];
  hotspots: OperationalVehicleViewHotspot[];
}) {
  const firstGround = groundOrder.find((key) => views.some((view) => view.viewKey === key));
  const firstView = views.find((view) => view.viewKey === firstGround) ?? views[0] ?? null;
  const [activeKey, setActiveKey] = useState<OperationalVehicleViewKey | null>(firstView?.viewKey ?? null);
  const [lastGroundKey, setLastGroundKey] = useState<OperationalVehicleViewKey>(firstGround ?? "front");

  const activeView = useMemo(
    () => views.find((view) => view.viewKey === activeKey) ?? firstView,
    [activeKey, firstView, views]
  );
  const activeHotspots = useMemo(
    () => activeView ? hotspots.filter((hotspot) => hotspot.viewKey === activeView.viewKey) : [],
    [activeView, hotspots]
  );
  const roof = views.find((view) => view.viewKey === "roof") ?? null;

  function goGround(key: OperationalVehicleViewKey) {
    if (!views.some((view) => view.viewKey === key)) return;
    setActiveKey(key);
    setLastGroundKey(key);
  }

  function rotate(delta: number) {
    if (!activeView) return;
    const currentGroundKey = activeView.viewKey === "roof" ? lastGroundKey : activeView.viewKey;
    const currentIndex = groundOrder.indexOf(currentGroundKey);
    if (currentIndex < 0) return;
    for (let step = 1; step <= groundOrder.length; step += 1) {
      const nextIndex = (currentIndex + delta * step + groundOrder.length * 4) % groundOrder.length;
      const nextKey = groundOrder[nextIndex];
      if (views.some((view) => view.viewKey === nextKey)) {
        goGround(nextKey);
        return;
      }
    }
  }

  if (!activeView) {
    return <div className="grid min-h-56 place-items-center px-6 text-center text-sm font-semibold text-slate-500">Der er endnu ikke valgt billeder til den interaktive køretøjsvisning.</div>;
  }

  const onRoof = activeView.viewKey === "roof";

  return (
    <div className="relative overflow-hidden bg-black">
      <img alt={`${activeView.label} af ${vehicleName}`} className="block w-full" src={operationalImageUrl(activeView.imageId)} />

      {activeHotspots.map((hotspot) => (
        <Link
          aria-label={`Åbn ${hotspot.label || hotspot.placeName}`}
          className="absolute z-20 grid -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-white bg-[#d71920] font-black leading-none text-white shadow-[0_5px_22px_rgba(0,0,0,.75)] transition hover:scale-110 focus:scale-110"
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

      {!onRoof ? (
        <>
          <button aria-label="Vis forrige side af køretøjet" className="absolute left-2 top-1/2 z-30 grid size-12 -translate-y-1/2 place-items-center rounded-full border border-white/40 bg-black/65 text-3xl font-light text-white shadow-xl backdrop-blur hover:bg-black/80" onClick={() => rotate(-1)} type="button">‹</button>
          <button aria-label="Vis næste side af køretøjet" className="absolute right-2 top-1/2 z-30 grid size-12 -translate-y-1/2 place-items-center rounded-full border border-white/40 bg-black/65 text-3xl font-light text-white shadow-xl backdrop-blur hover:bg-black/80" onClick={() => rotate(1)} type="button">›</button>
          {roof ? <button aria-label="Vis taget" className="absolute left-1/2 top-2 z-30 flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/40 bg-black/65 px-4 py-2 text-xs font-black text-white shadow-xl backdrop-blur hover:bg-black/80" onClick={() => setActiveKey("roof")} type="button"><span className="text-xl leading-none">↑</span> Tag</button> : null}
        </>
      ) : (
        <button aria-label="Gå ned fra taget" className="absolute bottom-3 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/40 bg-black/65 px-4 py-2 text-xs font-black text-white shadow-xl backdrop-blur hover:bg-black/80" onClick={() => goGround(lastGroundKey)} type="button"><span className="text-xl leading-none">↓</span> Ned</button>
      )}

      <div className="absolute bottom-3 left-3 z-30 rounded-full border border-white/20 bg-black/65 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-white backdrop-blur">{activeView.label}</div>

      <div className="absolute bottom-3 right-3 z-30 hidden gap-1 sm:flex">
        {views.map((view) => (
          <button
            className={`rounded-full border px-2.5 py-1.5 text-[9px] font-black ${view.viewKey === activeView.viewKey ? "border-red-400 bg-red-600 text-white" : "border-white/20 bg-black/55 text-slate-200"}`}
            key={view.id}
            onClick={() => view.viewKey === "roof" ? setActiveKey("roof") : goGround(view.viewKey)}
            type="button"
          >{view.label}</button>
        ))}
      </div>
    </div>
  );
}
