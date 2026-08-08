"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { operationalImageUrl } from "@/lib/operativ-client";
import {
  OPERATIONAL_VIEW_CONFIG,
  OPERATIONAL_VIEW_KEYS,
  type OperationalVehicleView,
  type OperationalVehicleViewHotspot,
  type OperationalVehicleViewKey
} from "@/lib/operativ-vehicle-view-model";
import { AppIcon } from "./AppIcon";

export function OperationalVehicleViewer({
  vehicleName,
  views,
  hotspots
}: {
  vehicleName: string;
  views: OperationalVehicleView[];
  hotspots: OperationalVehicleViewHotspot[];
}) {
  const configuredViews = useMemo(
    () => OPERATIONAL_VIEW_KEYS.flatMap((viewKey) => {
      const view = views.find((entry) => entry.viewKey === viewKey);
      return view ? [view] : [];
    }),
    [views]
  );
  const initialKey = configuredViews.find((view) => view.viewKey === "front")?.viewKey ?? configuredViews[0]?.viewKey ?? "front";
  const [activeKey, setActiveKey] = useState<OperationalVehicleViewKey>(initialKey);
  const activeIndex = configuredViews.findIndex((view) => view.viewKey === activeKey);
  const activeView = configuredViews[activeIndex] ?? configuredViews[0] ?? null;
  const activeHotspots = useMemo(
    () => hotspots.filter((hotspot) => hotspot.viewKey === activeView?.viewKey),
    [activeView?.viewKey, hotspots]
  );

  if (!activeView) {
    return (
      <div className="grid min-h-40 place-items-center bg-[#11171b] px-6 text-center text-sm font-semibold text-slate-500">
        Der er endnu ikke valgt billeder til Front, Højre, Bagende, Venstre eller Tag.
      </div>
    );
  }

  function move(direction: -1 | 1) {
    if (configuredViews.length < 2) return;
    const nextIndex = (activeIndex + direction + configuredViews.length) % configuredViews.length;
    setActiveKey(configuredViews[nextIndex].viewKey);
  }

  return (
    <div className="bg-black">
      <div className="flex gap-1.5 overflow-x-auto border-b border-white/10 bg-[#11171b] p-2" aria-label="Køretøjsvisning" role="tablist">
        {configuredViews.map((view) => {
          const active = view.viewKey === activeView.viewKey;
          return (
            <button
              aria-selected={active}
              className={`min-h-10 shrink-0 rounded-lg border px-3 text-xs font-black transition ${active ? "border-red-400 bg-red-600 text-white" : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"}`}
              key={view.id}
              onClick={() => setActiveKey(view.viewKey)}
              role="tab"
              type="button"
            >
              {OPERATIONAL_VIEW_CONFIG[view.viewKey].label}
            </button>
          );
        })}
      </div>

      <div className="relative overflow-hidden">
        <img
          alt={`${OPERATIONAL_VIEW_CONFIG[activeView.viewKey].label} af ${vehicleName}`}
          className="block w-full select-none"
          draggable={false}
          src={operationalImageUrl(activeView.imageId)}
        />

        {configuredViews.length > 1 ? (
          <>
            <button
              aria-label="Forrige side af køretøjet"
              className="absolute left-2 top-1/2 z-30 grid size-11 -translate-y-1/2 place-items-center rounded-full border border-white/20 bg-black/65 text-white shadow-lg backdrop-blur hover:bg-black/80"
              onClick={() => move(-1)}
              type="button"
            >
              <AppIcon className="size-5" name="back" />
            </button>
            <button
              aria-label="Næste side af køretøjet"
              className="absolute right-2 top-1/2 z-30 grid size-11 -translate-y-1/2 place-items-center rounded-full border border-white/20 bg-black/65 text-white shadow-lg backdrop-blur hover:bg-black/80"
              onClick={() => move(1)}
              type="button"
            >
              <AppIcon className="size-5" name="chevronRight" />
            </button>
          </>
        ) : null}

        {activeHotspots.map((hotspot) => (
          <Link
            aria-label={`Åbn ${hotspot.label || hotspot.placeName}`}
            className="absolute z-20 grid -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-white bg-[#d71920] font-black leading-none text-white shadow-[0_4px_18px_rgba(0,0,0,.65)] transition hover:scale-110 focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-white"
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
          >
            +
          </Link>
        ))}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-white/10 bg-[#11171b] px-3 py-2">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-wide text-red-400">Aktuel visning</p>
          <p className="truncate text-sm font-black text-white">{OPERATIONAL_VIEW_CONFIG[activeView.viewKey].label}</p>
        </div>
        <p className="shrink-0 text-xs font-semibold text-slate-500">{activeHotspots.length} pluspunkt{activeHotspots.length === 1 ? "" : "er"}</p>
      </div>
    </div>
  );
}
