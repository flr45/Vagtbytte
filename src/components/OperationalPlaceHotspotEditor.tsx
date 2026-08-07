"use client";

import { useMemo, useState } from "react";
import {
  createOperationalPlaceHotspotAction,
  deleteOperationalPlaceHotspotAction,
  updateOperationalPlaceHotspotAction
} from "@/lib/operativ-portal-hotspot-actions";

type Item = { id: string; name: string };
type Hotspot = {
  id: string;
  itemId: string;
  itemName: string;
  label: string;
  xPercent: number;
  yPercent: number;
  sizePx: number;
  sortOrder: number;
};

export function OperationalPlaceHotspotEditor({
  placeId,
  vehicleId,
  imageSrc,
  items,
  hotspots
}: {
  placeId: string;
  vehicleId: string;
  imageSrc: string;
  items: Item[];
  hotspots: Hotspot[];
}) {
  const [itemId, setItemId] = useState(items[0]?.id ?? "");
  const [xPercent, setXPercent] = useState<number | null>(null);
  const [yPercent, setYPercent] = useState<number | null>(null);
  const [sizePx, setSizePx] = useState(40);
  const selectedItem = useMemo(() => items.find((item) => item.id === itemId) ?? null, [itemId, items]);
  const hasPosition = xPercent !== null && yPercent !== null;

  function choosePosition(event: React.PointerEvent<HTMLDivElement>) {
    if (event.button !== 0 && event.pointerType === "mouse") return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    setXPercent(Number(Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100)).toFixed(2)));
    setYPercent(Number(Math.max(0, Math.min(100, ((event.clientY - rect.top) / rect.height) * 100)).toFixed(2)));
  }

  return (
    <section className="relative z-20 min-w-0 overflow-hidden rounded-xl border border-white/10 bg-[#0d1317] p-4 pointer-events-auto">
      <p className="text-[11px] font-black uppercase tracking-[0.16em] text-red-500">Punkter inde i rummet</p>
      <h3 className="mt-1 text-lg font-black text-white">Placér plus direkte på værktøjet</h3>
      <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">Når brandmanden trykker på plusset i det interaktive rum, åbnes værktøjets detaljeside direkte.</p>

      {items.length === 0 ? (
        <p className="mt-4 rounded-lg border border-dashed border-white/15 p-4 text-sm font-semibold text-slate-400">Opret mindst ét stykke udstyr i rummet først.</p>
      ) : (
        <>
          <label className="mt-4 grid gap-2 text-xs font-black text-slate-300">
            1. Vælg værktøj
            <select className="dark-input" onChange={(event) => { setItemId(event.target.value); setXPercent(null); setYPercent(null); }} value={itemId}>
              {items.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>

          <p className="mt-4 text-xs font-black text-slate-300">2. Klik på værktøjets placering på billedet</p>
          <div className="relative mt-2 cursor-crosshair touch-manipulation overflow-hidden rounded-xl border-2 border-red-500/40 bg-black select-none" onPointerDown={choosePosition} role="button" tabIndex={0}>
            <img alt="Interaktivt billede af rummet" className="pointer-events-none block w-full select-none" draggable={false} src={imageSrc} />
            {hotspots.map((hotspot) => (
              <span className="pointer-events-none absolute grid -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-white bg-red-600 font-black text-white shadow-[0_4px_16px_rgba(0,0,0,.55)]" key={hotspot.id} style={{ left: `${hotspot.xPercent}%`, top: `${hotspot.yPercent}%`, width: hotspot.sizePx, height: hotspot.sizePx, fontSize: Math.max(18, Math.round(hotspot.sizePx * 0.55)) }}>+</span>
            ))}
            {hasPosition ? (
              <span className="pointer-events-none absolute grid -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-white bg-red-500 font-black text-white shadow-[0_4px_20px_rgba(220,38,38,.65)]" style={{ left: `${xPercent}%`, top: `${yPercent}%`, width: sizePx, height: sizePx, fontSize: Math.max(18, Math.round(sizePx * 0.55)) }}>+</span>
            ) : null}
          </div>

          <form action={createOperationalPlaceHotspotAction} className="mt-4 grid gap-3">
            <input name="placeId" type="hidden" value={placeId} />
            <input name="vehicleId" type="hidden" value={vehicleId} />
            <input name="itemId" type="hidden" value={itemId} />
            <input name="xPercent" type="hidden" value={xPercent ?? ""} />
            <input name="yPercent" type="hidden" value={yPercent ?? ""} />
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_120px]">
              <label className="grid gap-2 text-xs font-black text-slate-300">Label<input className="dark-input" name="label" placeholder={selectedItem?.name ?? "Værktøj"} /></label>
              <label className="grid gap-2 text-xs font-black text-slate-300">Rækkefølge<input className="dark-input" defaultValue={hotspots.length} min="0" name="sortOrder" type="number" /></label>
            </div>
            <label className="grid gap-2 text-xs font-black text-slate-300">Plusstørrelse: <span className="text-red-400">{sizePx}px</span><input max="96" min="24" name="sizePx" onChange={(event) => setSizePx(Number(event.target.value))} step="2" type="range" value={sizePx} /></label>
            <button className="app-button-primary w-full disabled:cursor-not-allowed disabled:opacity-40" disabled={!itemId || !hasPosition} type="submit">3. Gem værktøjspunkt</button>
          </form>
        </>
      )}

      {hotspots.length > 0 ? (
        <div className="mt-5 grid gap-2">
          <h4 className="text-xs font-black uppercase tracking-wide text-slate-400">Oprettede værktøjspunkter</h4>
          {hotspots.map((hotspot) => (
            <div className="grid gap-2 rounded-lg border border-white/10 bg-[#11191e] p-3" key={hotspot.id}>
              <div className="flex items-center gap-3">
                <span className="grid shrink-0 place-items-center rounded-full bg-red-600 font-black text-white" style={{ width: hotspot.sizePx, height: hotspot.sizePx }}>+</span>
                <span className="min-w-0"><strong className="block truncate text-sm text-white">{hotspot.label || hotspot.itemName}</strong><small className="text-xs text-slate-500">{hotspot.xPercent.toFixed(1)}% · {hotspot.yPercent.toFixed(1)}%</small></span>
              </div>
              <form action={updateOperationalPlaceHotspotAction} className="grid grid-cols-[1fr_110px_auto] items-end gap-2">
                <input name="hotspotId" type="hidden" value={hotspot.id} />
                <input name="placeId" type="hidden" value={placeId} />
                <input name="vehicleId" type="hidden" value={vehicleId} />
                <input name="itemId" type="hidden" value={hotspot.itemId} />
                <input name="label" type="hidden" value={hotspot.label} />
                <input name="xPercent" type="hidden" value={hotspot.xPercent} />
                <input name="yPercent" type="hidden" value={hotspot.yPercent} />
                <input name="sortOrder" type="hidden" value={hotspot.sortOrder} />
                <label className="grid gap-1 text-[10px] font-black text-slate-400">Størrelse<input className="dark-input" defaultValue={hotspot.sizePx} max="96" min="24" name="sizePx" step="2" type="number" /></label>
                <span className="pb-2 text-xs text-slate-500">24–96 px</span>
                <button className="rounded-lg border border-white/10 px-3 py-2 text-xs font-black text-white" type="submit">Gem</button>
              </form>
              <form action={deleteOperationalPlaceHotspotAction} className="justify-self-end"><input name="hotspotId" type="hidden" value={hotspot.id} /><input name="placeId" type="hidden" value={placeId} /><input name="vehicleId" type="hidden" value={vehicleId} /><button className="rounded-lg border border-red-500/30 px-3 py-2 text-xs font-black text-red-400" type="submit">Slet punkt</button></form>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
