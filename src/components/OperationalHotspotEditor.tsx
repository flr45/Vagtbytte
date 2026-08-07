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
  const selectedPlace = useMemo(
    () => places.find((place) => place.id === placeId) ?? null,
    [placeId, places]
  );

  function choosePosition(event: React.MouseEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    setXPercent(Number(Math.max(0, Math.min(100, x)).toFixed(2)));
    setYPercent(Number(Math.max(0, Math.min(100, y)).toFixed(2)));
  }

  return (
    <section className="rounded-xl border border-white/10 bg-[#0d1317] p-4">
      <div>
        <p className="text-[11px] font-black uppercase tracking-[0.16em] text-red-500">Hotspot-editor</p>
        <h3 className="mt-1 text-lg font-black text-white">Placér rum direkte på køretøjet</h3>
        <p className="mt-2 text-xs font-semibold leading-5 text-slate-400">
          Vælg et rum og tryk derefter på det sted på billedet, hvor markøren skal ligge.
        </p>
      </div>

      {places.length === 0 ? (
        <p className="mt-4 rounded-lg border border-dashed border-white/15 p-4 text-sm font-semibold text-slate-400">
          Opret mindst ét rum, før du kan placere hotspots.
        </p>
      ) : (
        <>
          <label className="mt-4 grid gap-2 text-xs font-black text-slate-300">
            Rum
            <select
              className="dark-input"
              onChange={(event) => setPlaceId(event.target.value)}
              value={placeId}
            >
              {places.map((place) => (
                <option key={place.id} value={place.id}>{place.name}</option>
              ))}
            </select>
          </label>

          <div
            className="relative mt-4 cursor-crosshair overflow-hidden rounded-xl border border-white/10 bg-black"
            onClick={choosePosition}
            role="presentation"
          >
            <img alt="Interaktivt køretøjsbillede" className="block w-full select-none" draggable={false} src={imageSrc} />
            {hotspots.map((hotspot, index) => (
              <span
                className="absolute grid size-8 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-white bg-red-600 text-sm font-black text-white shadow-[0_4px_16px_rgba(0,0,0,.55)]"
                key={hotspot.id}
                style={{ left: `${hotspot.xPercent}%`, top: `${hotspot.yPercent}%` }}
                title={hotspot.label || hotspot.placeName}
              >
                {index + 1}
              </span>
            ))}
            {xPercent !== null && yPercent !== null ? (
              <span
                className="absolute grid size-9 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-white bg-red-500 text-xl font-black text-white shadow-[0_4px_20px_rgba(220,38,38,.65)]"
                style={{ left: `${xPercent}%`, top: `${yPercent}%` }}
              >
                +
              </span>
            ) : null}
          </div>

          <form action={createOperationalHotspotAction} className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_120px_auto] sm:items-end">
            <input name="vehicleId" type="hidden" value={vehicleId} />
            <input name="placeId" type="hidden" value={placeId} />
            <input name="xPercent" type="hidden" value={xPercent ?? ""} />
            <input name="yPercent" type="hidden" value={yPercent ?? ""} />
            <label className="grid gap-2 text-xs font-black text-slate-300">
              Label
              <input className="dark-input" name="label" placeholder={selectedPlace?.name ?? "Rum"} />
            </label>
            <label className="grid gap-2 text-xs font-black text-slate-300">
              Rækkefølge
              <input className="dark-input" defaultValue={hotspots.length} min="0" name="sortOrder" type="number" />
            </label>
            <button
              className="app-button-primary min-h-12 disabled:cursor-not-allowed disabled:opacity-40"
              disabled={!placeId || xPercent === null || yPercent === null}
              type="submit"
            >
              Gem hotspot
            </button>
          </form>
        </>
      )}

      {hotspots.length > 0 ? (
        <div className="mt-5 grid gap-2">
          {hotspots.map((hotspot, index) => (
            <div className="grid grid-cols-[32px_minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-white/10 bg-[#11191e] p-3" key={hotspot.id}>
              <span className="grid size-8 place-items-center rounded-full bg-red-600 text-xs font-black text-white">{index + 1}</span>
              <span className="min-w-0">
                <strong className="block truncate text-sm text-white">{hotspot.label || hotspot.placeName}</strong>
                <small className="text-xs text-slate-500">{hotspot.xPercent.toFixed(1)}% · {hotspot.yPercent.toFixed(1)}%</small>
              </span>
              <form action={deleteOperationalHotspotAction}>
                <input name="hotspotId" type="hidden" value={hotspot.id} />
                <input name="vehicleId" type="hidden" value={vehicleId} />
                <button className="rounded-lg border border-red-500/30 px-3 py-2 text-xs font-black text-red-400" type="submit">Slet</button>
              </form>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
