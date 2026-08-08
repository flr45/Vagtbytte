"use client";

import { useMemo, useState } from "react";
import {
  createOperationalHotspotAction,
  deleteOperationalHotspotAction,
  updateOperationalHotspotAction
} from "@/lib/operativ-portal-hotspot-actions";

type Place = { id: string; name: string };
type Hotspot = {
  id: string;
  placeId: string;
  placeName: string;
  label: string;
  xPercent: number;
  yPercent: number;
  sizePx?: number;
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
  const [sizePx, setSizePx] = useState(40);
  const [selectedHotspotId, setSelectedHotspotId] = useState<string | null>(null);
  const selectedPlace = useMemo(() => places.find((place) => place.id === placeId) ?? null, [placeId, places]);
  const selectedHotspot = useMemo(() => hotspots.find((hotspot) => hotspot.id === selectedHotspotId) ?? null, [hotspots, selectedHotspotId]);
  const hasPosition = xPercent !== null && yPercent !== null;

  function choosePosition(event: React.PointerEvent<HTMLDivElement>) {
    if (event.button !== 0 && event.pointerType === "mouse") return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    setSelectedHotspotId(null);
    setXPercent(Number(Math.max(0, Math.min(100, x)).toFixed(2)));
    setYPercent(Number(Math.max(0, Math.min(100, y)).toFixed(2)));
  }

  return (
    <section className="relative z-20 min-w-0 overflow-hidden rounded-xl border border-white/10 bg-[#0d1317] p-4 pointer-events-auto">
      <p className="text-[11px] font-black uppercase tracking-[0.16em] text-red-500">Interaktive punkter</p>
      <h3 className="mt-1 text-lg font-black text-white">Placér et plus på køretøjet</h3>
      <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">Plusset åbner det valgte rum. Inde i rummet kan du bagefter placere nye plusser direkte på værktøjet. Tryk på et eksisterende plus for at vælge eller slette det.</p>

      {places.length === 0 ? (
        <p className="mt-4 rounded-lg border border-dashed border-white/15 p-4 text-sm font-semibold text-slate-400">Opret mindst ét rum, før du kan placere interaktive punkter.</p>
      ) : (
        <>
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <Step number="1" text="Vælg rum" active />
            <Step number="2" text="Klik på billedet" active={Boolean(placeId)} />
            <Step number="3" text="Vælg størrelse og gem" active={hasPosition} />
          </div>

          <label className="mt-4 grid min-w-0 gap-2 text-xs font-black text-slate-300">
            1. Vælg rum
            <select className="dark-input min-w-0" onChange={(event) => { setPlaceId(event.target.value); setXPercent(null); setYPercent(null); setSelectedHotspotId(null); }} value={placeId}>
              {places.map((place) => <option key={place.id} value={place.id}>{place.name}</option>)}
            </select>
          </label>

          <p className="mt-4 text-xs font-black text-slate-300">2. Klik direkte på det sted på billedet, hvor plusset skal ligge</p>
          <div
            className="relative mt-2 min-w-0 cursor-crosshair touch-manipulation overflow-hidden rounded-xl border-2 border-red-500/40 bg-black select-none"
            onPointerDown={choosePosition}
            role="button"
            tabIndex={0}
            aria-label="Klik på køretøjsbilledet for at placere hotspot"
          >
            <img alt="Interaktivt køretøjsbillede" className="pointer-events-none block w-full select-none" draggable={false} src={imageSrc} />
            {hotspots.map((hotspot) => {
              const pointSize = hotspot.sizePx ?? 36;
              const selected = selectedHotspotId === hotspot.id;
              return (
                <button
                  aria-label={`Vælg ${hotspot.label || hotspot.placeName}`}
                  className={`absolute z-20 grid -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 bg-red-600 font-black text-white shadow-[0_4px_16px_rgba(0,0,0,.55)] ${selected ? "border-yellow-300 ring-4 ring-yellow-300/30" : "border-white"}`}
                  key={hotspot.id}
                  onClick={(event) => { event.preventDefault(); event.stopPropagation(); setSelectedHotspotId(hotspot.id); setXPercent(null); setYPercent(null); }}
                  onPointerDown={(event) => event.stopPropagation()}
                  style={{ left: `${hotspot.xPercent}%`, top: `${hotspot.yPercent}%`, width: pointSize, height: pointSize, fontSize: Math.max(18, Math.round(pointSize * 0.55)) }}
                  title={`${hotspot.label || hotspot.placeName} · tryk for at vælge`}
                  type="button"
                >+</button>
              );
            })}
            {hasPosition ? (
              <span
                className="pointer-events-none absolute z-10 grid -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-white bg-red-500 font-black text-white shadow-[0_4px_20px_rgba(220,38,38,.65)]"
                style={{ left: `${xPercent}%`, top: `${yPercent}%`, width: sizePx, height: sizePx, fontSize: Math.max(18, Math.round(sizePx * 0.55)) }}
              >+</span>
            ) : null}
          </div>

          {selectedHotspot ? (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-yellow-300/20 bg-yellow-300/5 p-3">
              <div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-wide text-yellow-300">Valgt plus</p><strong className="block truncate text-sm text-white">{selectedHotspot.label || selectedHotspot.placeName}</strong><small className="text-xs text-slate-500">Tryk Slet plus for at fjerne punktet fra billedet.</small></div>
              <form action={deleteOperationalHotspotAction}>
                <input name="hotspotId" type="hidden" value={selectedHotspot.id} />
                <input name="vehicleId" type="hidden" value={vehicleId} />
                <button className="min-h-10 rounded-lg border border-red-500/30 bg-red-500/10 px-4 text-xs font-black text-red-300 hover:bg-red-500/20" type="submit">Slet plus</button>
              </form>
            </div>
          ) : (
            <div className={`mt-3 rounded-lg border p-3 text-sm font-bold ${hasPosition ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-white/10 bg-white/5 text-slate-400"}`}>
              {hasPosition ? `Punkt valgt til ${selectedPlace?.name ?? "rummet"} ved ${xPercent?.toFixed(1)}% / ${yPercent?.toFixed(1)}%.` : "Der er endnu ikke valgt en position på billedet. Du kan også trykke på et eksisterende plus for at slette det."}
            </div>
          )}

          <form action={createOperationalHotspotAction} className="mt-4 grid min-w-0 gap-3">
            <input name="vehicleId" type="hidden" value={vehicleId} />
            <input name="placeId" type="hidden" value={placeId} />
            <input name="xPercent" type="hidden" value={xPercent ?? ""} />
            <input name="yPercent" type="hidden" value={yPercent ?? ""} />
            <div className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_120px]">
              <label className="grid min-w-0 gap-2 text-xs font-black text-slate-300">Label<input className="dark-input min-w-0" name="label" placeholder={selectedPlace?.name ?? "Rum"} /></label>
              <label className="grid min-w-0 gap-2 text-xs font-black text-slate-300">Rækkefølge<input className="dark-input min-w-0" defaultValue={hotspots.length} min="0" name="sortOrder" type="number" /></label>
            </div>
            <label className="grid gap-2 text-xs font-black text-slate-300">
              Plusstørrelse: <span className="text-red-400">{sizePx}px</span>
              <input max="96" min="24" name="sizePx" onChange={(event) => setSizePx(Number(event.target.value))} step="2" type="range" value={sizePx} />
            </label>
            <button className="app-button-primary w-full disabled:cursor-not-allowed disabled:opacity-40" disabled={!placeId || !hasPosition} type="submit">3. Gem pluspunkt</button>
          </form>
        </>
      )}

      {hotspots.length > 0 ? (
        <div className="mt-5 grid min-w-0 gap-2">
          <h4 className="text-xs font-black uppercase tracking-wide text-slate-400">Oprettede punkter</h4>
          {hotspots.map((hotspot) => (
            <div className="grid min-w-0 gap-2 rounded-lg border border-white/10 bg-[#11191e] p-3" key={hotspot.id}>
              <div className="flex items-center gap-3">
                <span className="grid shrink-0 place-items-center rounded-full bg-red-600 font-black text-white" style={{ width: hotspot.sizePx ?? 36, height: hotspot.sizePx ?? 36 }}>+</span>
                <span className="min-w-0"><strong className="block truncate text-sm text-white">{hotspot.label || hotspot.placeName}</strong><small className="text-xs text-slate-500">{hotspot.xPercent.toFixed(1)}% · {hotspot.yPercent.toFixed(1)}%</small></span>
              </div>
              <form action={updateOperationalHotspotAction} className="grid grid-cols-[1fr_110px_auto] items-end gap-2">
                <input name="hotspotId" type="hidden" value={hotspot.id} />
                <input name="vehicleId" type="hidden" value={vehicleId} />
                <input name="placeId" type="hidden" value={hotspot.placeId} />
                <input name="label" type="hidden" value={hotspot.label} />
                <input name="xPercent" type="hidden" value={hotspot.xPercent} />
                <input name="yPercent" type="hidden" value={hotspot.yPercent} />
                <input name="sortOrder" type="hidden" value={hotspot.sortOrder} />
                <label className="grid gap-1 text-[10px] font-black text-slate-400">Størrelse<input className="dark-input" defaultValue={hotspot.sizePx ?? 36} max="96" min="24" name="sizePx" step="2" type="number" /></label>
                <span className="pb-2 text-xs text-slate-500">24–96 px</span>
                <button className="rounded-lg border border-white/10 px-3 py-2 text-xs font-black text-white" type="submit">Gem</button>
              </form>
              <form action={deleteOperationalHotspotAction} className="justify-self-end"><input name="hotspotId" type="hidden" value={hotspot.id} /><input name="vehicleId" type="hidden" value={vehicleId} /><button className="rounded-lg border border-red-500/30 px-3 py-2 text-xs font-black text-red-400" type="submit">Slet punkt</button></form>
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
