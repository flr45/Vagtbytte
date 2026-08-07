"use client";

import { useMemo, useState } from "react";
import { operationalImageUrl } from "@/lib/operativ-portal";
import {
  createOperationalVehicleViewHotspotAction,
  deleteOperationalVehicleViewHotspotAction,
  setOperationalVehicleViewAction,
  updateOperationalVehicleViewHotspotAction
} from "@/lib/operativ-vehicle-view-actions";
import {
  OPERATIONAL_VIEW_CONFIG,
  OPERATIONAL_VIEW_KEYS,
  type OperationalVehicleView,
  type OperationalVehicleViewHotspot,
  type OperationalVehicleViewKey
} from "@/lib/operativ-vehicle-views";

type ImageOption = { id: string; title: string; originalName: string };
type PlaceOption = { id: string; name: string };

export function OperationalVehicleViewManager({
  vehicleId,
  images,
  places,
  views,
  hotspots
}: {
  vehicleId: string;
  images: ImageOption[];
  places: PlaceOption[];
  views: OperationalVehicleView[];
  hotspots: OperationalVehicleViewHotspot[];
}) {
  const defaultKey = views.find((view) => view.viewKey === "front")?.viewKey ?? views[0]?.viewKey ?? "front";
  const [activeKey, setActiveKey] = useState<OperationalVehicleViewKey>(defaultKey);
  const [placeId, setPlaceId] = useState(places[0]?.id ?? "");
  const [xPercent, setXPercent] = useState<number | null>(null);
  const [yPercent, setYPercent] = useState<number | null>(null);
  const [sizePx, setSizePx] = useState(40);

  const activeView = useMemo(() => views.find((view) => view.viewKey === activeKey) ?? null, [activeKey, views]);
  const activeHotspots = useMemo(() => hotspots.filter((hotspot) => hotspot.viewKey === activeKey), [activeKey, hotspots]);
  const selectedPlace = places.find((place) => place.id === placeId) ?? null;

  function choosePosition(event: React.PointerEvent<HTMLDivElement>) {
    if (event.button !== 0 && event.pointerType === "mouse") return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    setXPercent(Number(Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100)).toFixed(2)));
    setYPercent(Number(Math.max(0, Math.min(100, ((event.clientY - rect.top) / rect.height) * 100)).toFixed(2)));
  }

  return (
    <section className="rounded-xl border border-white/10 bg-[#0d1317] p-4 shadow-lg">
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-red-500">Interaktiv køretøjsnavigation</p>
      <h2 className="mt-1 text-xl font-black">Billeder rundt om køretøjet</h2>
      <p className="mt-2 max-w-3xl text-xs font-semibold leading-5 text-slate-500">Vælg et billede til hver side. Brandmanden får pile til venstre/højre rundt om bilen og en pil op på taget. Pluspunkter gemmes separat pr. billede.</p>

      <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        {OPERATIONAL_VIEW_KEYS.map((viewKey) => {
          const config = OPERATIONAL_VIEW_CONFIG[viewKey];
          const view = views.find((entry) => entry.viewKey === viewKey);
          return (
            <form action={setOperationalVehicleViewAction} className={`grid gap-2 rounded-lg border p-3 ${activeKey === viewKey ? "border-red-500/50 bg-red-500/10" : "border-white/10 bg-[#11191e]"}`} key={viewKey}>
              <input name="vehicleId" type="hidden" value={vehicleId} />
              <input name="viewKey" type="hidden" value={viewKey} />
              <button className="text-left text-xs font-black text-white" onClick={() => setActiveKey(viewKey)} type="button">{viewKey === "roof" ? "↑ " : ""}{config.label}</button>
              <select className="dark-input min-w-0" defaultValue={view?.imageId ?? ""} name="imageId" onFocus={() => setActiveKey(viewKey)}>
                <option value="">Intet billede</option>
                {images.map((image) => <option key={image.id} value={image.id}>{image.title || image.originalName}</option>)}
              </select>
              <button className="rounded-lg bg-white px-2 py-2 text-[10px] font-black text-black" type="submit">Gem {config.label.toLowerCase()}</button>
            </form>
          );
        })}
      </div>

      <div className="mt-5 flex flex-wrap gap-1.5">
        {OPERATIONAL_VIEW_KEYS.map((viewKey) => {
          const configured = views.some((view) => view.viewKey === viewKey);
          return <button className={`rounded-full border px-3 py-2 text-[10px] font-black ${activeKey === viewKey ? "border-red-400 bg-red-600 text-white" : configured ? "border-white/15 bg-white/5 text-slate-200" : "border-white/5 bg-black/20 text-slate-600"}`} key={viewKey} onClick={() => setActiveKey(viewKey)} type="button">{OPERATIONAL_VIEW_CONFIG[viewKey].label}</button>;
        })}
      </div>

      {!activeView ? (
        <div className="mt-4 rounded-lg border border-dashed border-white/15 p-6 text-center text-sm font-semibold text-slate-500">Vælg og gem først et billede til {OPERATIONAL_VIEW_CONFIG[activeKey].label.toLowerCase()}.</div>
      ) : (
        <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(280px,.55fr)]">
          <div>
            <p className="mb-2 text-xs font-black text-slate-300">Klik på billedet for at placere et nyt plus på {activeView.label.toLowerCase()}</p>
            <div className="relative cursor-crosshair touch-manipulation overflow-hidden rounded-xl border-2 border-red-500/35 bg-black" onPointerDown={choosePosition} role="button" tabIndex={0}>
              <img alt={activeView.label} className="pointer-events-none block w-full select-none" draggable={false} src={operationalImageUrl(activeView.imageId)} />
              {activeHotspots.map((hotspot) => <span className="pointer-events-none absolute grid -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-white bg-red-600 font-black text-white shadow-xl" key={hotspot.id} style={{ left: `${hotspot.xPercent}%`, top: `${hotspot.yPercent}%`, width: hotspot.sizePx, height: hotspot.sizePx, fontSize: Math.max(18, Math.round(hotspot.sizePx * 0.55)) }}>+</span>)}
              {xPercent !== null && yPercent !== null ? <span className="pointer-events-none absolute grid -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-emerald-100 bg-emerald-600 font-black text-white shadow-xl" style={{ left: `${xPercent}%`, top: `${yPercent}%`, width: sizePx, height: sizePx, fontSize: Math.max(18, Math.round(sizePx * 0.55)) }}>+</span> : null}
            </div>
          </div>

          <form action={createOperationalVehicleViewHotspotAction} className="grid content-start gap-3 rounded-lg bg-[#11191e] p-4">
            <input name="vehicleId" type="hidden" value={vehicleId} />
            <input name="viewKey" type="hidden" value={activeKey} />
            <input name="xPercent" type="hidden" value={xPercent ?? ""} />
            <input name="yPercent" type="hidden" value={yPercent ?? ""} />
            <h3 className="text-sm font-black">Nyt plus · {activeView.label}</h3>
            <label className="grid gap-1.5 text-xs font-black text-slate-300">Åbner rum<select className="dark-input" name="placeId" onChange={(event) => setPlaceId(event.target.value)} value={placeId}>{places.map((place) => <option key={place.id} value={place.id}>{place.name}</option>)}</select></label>
            <label className="grid gap-1.5 text-xs font-black text-slate-300">Label<input className="dark-input" name="label" placeholder={selectedPlace?.name ?? "Rum"} /></label>
            <label className="grid gap-1.5 text-xs font-black text-slate-300">Plusstørrelse · {sizePx}px<input max="96" min="24" name="sizePx" onChange={(event) => setSizePx(Number(event.target.value))} step="2" type="range" value={sizePx} /></label>
            <label className="grid gap-1.5 text-xs font-black text-slate-300">Rækkefølge<input className="dark-input" defaultValue={activeHotspots.length} min="0" name="sortOrder" type="number" /></label>
            <button className="app-button-primary disabled:opacity-35" disabled={!placeId || xPercent === null || yPercent === null} type="submit">Gem pluspunkt</button>
          </form>
        </div>
      )}

      {activeHotspots.length > 0 ? (
        <div className="mt-5 grid gap-2">
          <h3 className="text-xs font-black uppercase tracking-wide text-slate-400">Plusser på {OPERATIONAL_VIEW_CONFIG[activeKey].label}</h3>
          {activeHotspots.map((hotspot) => (
            <div className="grid gap-2 rounded-lg border border-white/10 bg-[#11191e] p-3" key={hotspot.id}>
              <form action={updateOperationalVehicleViewHotspotAction} className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
                <input name="hotspotId" type="hidden" value={hotspot.id} />
                <input name="vehicleId" type="hidden" value={vehicleId} />
                <input name="viewKey" type="hidden" value={activeKey} />
                <label className="grid gap-1 text-[10px] font-black text-slate-400 lg:col-span-2">Rum<select className="dark-input" defaultValue={hotspot.placeId} name="placeId">{places.map((place) => <option key={place.id} value={place.id}>{place.name}</option>)}</select></label>
                <label className="grid gap-1 text-[10px] font-black text-slate-400 lg:col-span-2">Label<input className="dark-input" defaultValue={hotspot.label} name="label" /></label>
                <label className="grid gap-1 text-[10px] font-black text-slate-400">X %<input className="dark-input" defaultValue={hotspot.xPercent} max="100" min="0" name="xPercent" step="0.1" type="number" /></label>
                <label className="grid gap-1 text-[10px] font-black text-slate-400">Y %<input className="dark-input" defaultValue={hotspot.yPercent} max="100" min="0" name="yPercent" step="0.1" type="number" /></label>
                <label className="grid gap-1 text-[10px] font-black text-slate-400">Størrelse<input className="dark-input" defaultValue={hotspot.sizePx} max="96" min="24" name="sizePx" step="2" type="number" /></label>
                <label className="grid gap-1 text-[10px] font-black text-slate-400">Rækkefølge<input className="dark-input" defaultValue={hotspot.sortOrder} min="0" name="sortOrder" type="number" /></label>
                <button className="rounded-lg bg-white px-3 py-2 text-xs font-black text-black lg:col-span-4" type="submit">Gem ændringer</button>
              </form>
              <form action={deleteOperationalVehicleViewHotspotAction} className="justify-self-end"><input name="hotspotId" type="hidden" value={hotspot.id} /><input name="vehicleId" type="hidden" value={vehicleId} /><button className="rounded-lg border border-red-500/30 px-3 py-2 text-xs font-black text-red-400" type="submit">Slet plus</button></form>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
