"use client";

import { useMemo, useState } from "react";
import {
  createOperationalHotspotAction,
  deleteOperationalHotspotAction
} from "@/lib/operativ-portal-hotspot-actions";

type Place = { id: string; name: string };
type Hotspot = {
  id: string;
  placeId: string;
  placeName: string;
  label: string;
  xPercent: number;
  yPercent: number;
  sortOrder: number;
};

export function OperationalHotspotEditor({
  vehicleId,
  imageSrc,
  places,
  hotspots
}: {
  vehicleId: string;
  imageSrc: string;
  places: Place[];
  hotspots: Hotspot[];
}) {
  const [placeId, setPlaceId] = useState(places[0]?.id ?? "");
  const [xPercent, setXPercent] = useState<number | null>(null);
  const [yPercent, setYPercent] = useState<number | null>(null);
  const selectedPlace = useMemo(() => places.find((place) => place.id === placeId) ?? null, [placeId, places]);
  const hasPosition = xPercent !== null && yPercent !== null;

  function choosePosition(event: React.PointerEvent<HTMLDivElement>) {
    if (event.button !== 0 && event.pointerType === "mouse") return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    setXPercent(Number(Math.max(0, Math.min(100, x)).toFixed(2)));
    setYPercent(Number(Math.max(0, Math.min(100, y)).toFixed(2)));
  }

  return (
    <section className="relative z-20 min-w-0 overflow-hidden rounded-xl border border-white/10 bg-[#0d1317] p-4 pointer-events-auto">
      <p className="text-[11px] font-black uppercase tracking-[0.16em] text-red-500">Interaktive punkter</p>
      <h3 className="mt-1 text-lg font-black text-white">Placér et punkt på køretøjet</h3>

      {places.length === 0 ? (
        <p className="mt-4 rounded-lg border border-dashed border-white/15 p-4 text-sm font-semibold text-slate-400">Opret mindst ét rum, før du kan placere interaktive punkter.</p>
      ) : (
        <>
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <Step number="1" text="Vælg rum" active />
            <Step number="2" text="Klik på billedet" active={Boolean(placeId)} />
            <Step number="3" text="Gem punkt" active={hasPosition} />
          </div>

          <label className="mt-4 grid min-w-0 gap-2 text-xs font-black text-slate-300">
            1. Vælg rum
            <select className="dark-input min-w-0" onChange={(event) => { setPlaceId(event.target.value); setXPercent(null); setYPercent(null); }} value={placeId}>
              {places.map((place) => <option key={place.id} value={place.id}>{place.name}</option>)}
            </select>
          </label>

          <p className="mt-4 text-xs font-black text-slate-300">2. Klik direkte på det sted på billedet, hvor punktet skal ligge</p>
          <div
            className="relative mt-2 min-w-0 cursor-crosshair touch-manipulation overflow-hidden rounded-xl border-2 border-red-500/40 bg-black select-none"
            onPointerDown={choosePosition}
            role="button"
            tabIndex={0}
            aria-label="Klik på køretøjsbilledet for at placere hotspot"
          >
            <img alt="Interaktivt køretøjsbillede" className="pointer-events-none block w-full select-none" draggable={false} src={imageSrc} />
            {hotspots.map((hotspot, index) => (
              <span
                className="pointer-events-none absolute grid size-8 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-white bg-red-600 text-sm font-black text-white shadow-[0_4px_16px_rgba(0,0,0,.55)]"
                key={hotspot.id}
                style={{ left: `${hotspot.xPercent}%`, top: `${hotspot.yPercent}%` }}
                title={hotspot.label || hotspot.placeName}
              >{index + 1}</span>
            ))}
            {hasPosition ? (
              <span
                className="pointer-events-none absolute grid size-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-white bg-red-500 text-2xl font-black text-white shadow-[0_4px_20px_rgba(220,38,38,.65)]"
                style={{ left: `${xPercent}%`, top: `${yPercent}%` }}
              >+</span>
            ) : null}
          </div>

          <div className={`mt-3 rounded-lg border p-3 text-sm font-bold ${hasPosition ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-white/10 bg-white/5 text-slate-400"}`}>
            {hasPosition ? `✓ Punkt valgt til ${selectedPlace?.name ?? "rummet"} ved ${xPercent?.toFixed(1)}% / ${yPercent?.toFixed(1)}%.` : "Der er endnu ikke valgt en position på billedet."}
          </div>

          <form action={createOperationalHotspotAction} className="mt-4 grid min-w-0 gap-3">
            <input name="vehicleId" type="hidden" value={vehicleId} />
            <input name="placeId" type="hidden" value={placeId} />
            <input name="xPercent" type="hidden" value={xPercent ?? ""} />
            <input name="yPercent" type="hidden" value={yPercent ?? ""} />
            <div className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_140px]">
              <label className="grid min-w-0 gap-2 text-xs font-black text-slate-300">Label<input className="dark-input min-w-0" name="label" placeholder={selectedPlace?.name ?? "Rum"} /></label>
              <label className="grid min-w-0 gap-2 text-xs font-black text-slate-300">Rækkefølge<input className="dark-input min-w-0" defaultValue={hotspots.length} min="0" name="sortOrder" type="number" /></label>
            </div>
            <button className="app-button-primary w-full disabled:cursor-not-allowed disabled:opacity-40" disabled={!placeId || !hasPosition} type="submit">3. Gem interaktivt punkt</button>
          </form>
        </>
      )}

      {hotspots.length > 0 ? (
        <div className="mt-5 grid min-w-0 gap-2">
          <h4 className="text-xs font-black uppercase tracking-wide text-slate-400">Oprettede punkter</h4>
          {hotspots.map((hotspot, index) => (
            <div className="grid min-w-0 grid-cols-[32px_minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-white/10 bg-[#11191e] p-3" key={hotspot.id}>
              <span className="grid size-8 place-items-center rounded-full bg-red-600 text-xs font-black text-white">{index + 1}</span>
              <span className="min-w-0"><strong className="block truncate text-sm text-white">{hotspot.label || hotspot.placeName}</strong><small className="text-xs text-slate-500">{hotspot.xPercent.toFixed(1)}% · {hotspot.yPercent.toFixed(1)}%</small></span>
              <form action={deleteOperationalHotspotAction}><input name="hotspotId" type="hidden" value={hotspot.id} /><input name="vehicleId" type="hidden" value={vehicleId} /><button className="rounded-lg border border-red-500/30 px-3 py-2 text-xs font-black text-red-400" type="submit">Slet</button></form>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function Step({ number, text, active }: { number: string; text: string; active: boolean }) {
  return <div className={`flex items-center gap-2 rounded-lg border p-2.5 text-xs font-black ${active ? "border-red-500/30 bg-red-500/10 text-white" : "border-white/10 bg-white/5 text-slate-600"}`}><span className={`grid size-6 shrink-0 place-items-center rounded-full ${active ? "bg-red-600 text-white" : "bg-white/10"}`}>{number}</span><span>{text}</span></div>;
}
