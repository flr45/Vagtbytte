"use client";

import { useMemo, useRef, useState } from "react";
import type {
  OperationalItemOption,
  OperationalPlaceOption,
  OperationalVehicleOption
} from "@/lib/operativ-portal-content";

export function OperationalDocumentUploadForm({
  vehicles,
  places = [],
  items = [],
  defaultVehicleId = "",
  defaultPlaceId = "",
  defaultItemId = ""
}: {
  vehicles: OperationalVehicleOption[];
  places?: OperationalPlaceOption[];
  items?: OperationalItemOption[];
  defaultVehicleId?: string;
  defaultPlaceId?: string;
  defaultItemId?: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [vehicleId, setVehicleId] = useState(defaultVehicleId);
  const [placeId, setPlaceId] = useState(defaultPlaceId);
  const [itemId, setItemId] = useState(defaultItemId);

  const visiblePlaces = useMemo(
    () => places.filter((place) => !vehicleId || place.vehicleId === vehicleId),
    [places, vehicleId]
  );
  const visibleItems = useMemo(
    () =>
      items.filter((item) => {
        if (placeId) return item.placeId === placeId;
        if (vehicleId) return item.vehicleId === vehicleId;
        return true;
      }),
    [items, placeId, vehicleId]
  );

  function selectVehicle(nextVehicleId: string) {
    setVehicleId(nextVehicleId);
    if (placeId && places.find((place) => place.id === placeId)?.vehicleId !== nextVehicleId) {
      setPlaceId("");
      setItemId("");
    }
    if (itemId && items.find((item) => item.id === itemId)?.vehicleId !== nextVehicleId) {
      setItemId("");
    }
  }

  function selectPlace(nextPlaceId: string) {
    setPlaceId(nextPlaceId);
    setItemId("");
    const place = places.find((entry) => entry.id === nextPlaceId);
    if (place) setVehicleId(place.vehicleId);
  }

  function selectItem(nextItemId: string) {
    setItemId(nextItemId);
    const item = items.find((entry) => entry.id === nextItemId);
    if (item) {
      setVehicleId(item.vehicleId);
      setPlaceId(item.placeId);
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");

    try {
      const response = await fetch("/api/admin/operativ-portal/dokumenter", {
        method: "POST",
        body: new FormData(event.currentTarget)
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        setMessage(result.error ?? "Dokumentet kunne ikke uploades.");
        return;
      }
      setMessage("Dokumentet er uploadet.");
      formRef.current?.reset();
      setVehicleId(defaultVehicleId);
      setPlaceId(defaultPlaceId);
      setItemId(defaultItemId);
      window.setTimeout(() => window.location.reload(), 450);
    } catch {
      setMessage("Dokumentet kunne ikke uploades.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form ref={formRef} className="grid gap-4" onSubmit={submit}>
      <label className="grid gap-2 text-sm font-bold text-zinc-700">
        Titel
        <input
          className="focus-ring min-h-12 rounded-xl border border-zinc-200 px-4 text-base"
          maxLength={180}
          name="title"
          placeholder="Fx Betjeningsvejledning til M2"
          required
        />
      </label>
      <label className="grid gap-2 text-sm font-bold text-zinc-700">
        Kategori
        <select className="focus-ring min-h-12 rounded-xl border border-zinc-200 bg-white px-4" defaultValue="Instruks" name="category">
          <option>Instruks</option>
          <option>Manual</option>
          <option>SOP</option>
          <option>Kontrolskema</option>
          <option>Pakkeliste</option>
          <option>Billede</option>
          <option>Andet</option>
        </select>
      </label>
      <label className="grid gap-2 text-sm font-bold text-zinc-700">
        Beskrivelse
        <textarea
          className="focus-ring min-h-24 rounded-xl border border-zinc-200 p-4 text-base"
          maxLength={3000}
          name="description"
          placeholder="Kort forklaring af dokumentets indhold"
        />
      </label>
      <div className="grid gap-3 md:grid-cols-3">
        <label className="grid gap-2 text-sm font-bold text-zinc-700">
          Køretøj
          <select
            className="focus-ring min-h-12 rounded-xl border border-zinc-200 bg-white px-4"
            name="vehicleId"
            onChange={(event) => selectVehicle(event.target.value)}
            value={vehicleId}
          >
            <option value="">Generelt</option>
            {vehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.name}</option>)}
          </select>
        </label>
        <label className="grid gap-2 text-sm font-bold text-zinc-700">
          Rum
          <select
            className="focus-ring min-h-12 rounded-xl border border-zinc-200 bg-white px-4"
            name="placeId"
            onChange={(event) => selectPlace(event.target.value)}
            value={placeId}
          >
            <option value="">Ikke tilknyttet</option>
            {visiblePlaces.map((place) => <option key={place.id} value={place.id}>{place.vehicleName} · {place.name}</option>)}
          </select>
        </label>
        <label className="grid gap-2 text-sm font-bold text-zinc-700">
          Udstyr
          <select
            className="focus-ring min-h-12 rounded-xl border border-zinc-200 bg-white px-4"
            name="itemId"
            onChange={(event) => selectItem(event.target.value)}
            value={itemId}
          >
            <option value="">Ikke tilknyttet</option>
            {visibleItems.map((item) => <option key={item.id} value={item.id}>{item.vehicleName} · {item.placeName} · {item.name}</option>)}
          </select>
        </label>
      </div>
      <label className="grid gap-2 text-sm font-bold text-zinc-700">
        Fil
        <input
          accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp"
          className="focus-ring rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-4 text-sm"
          name="file"
          required
          type="file"
        />
      </label>
      <p className="text-xs font-semibold text-zinc-500">
        Maks. 25 MB. PDF, Word, Excel, JPG, PNG og WebP. Filer kan kun åbnes med administratoradgang.
      </p>
      {message ? (
        <p className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm font-semibold text-zinc-700" role="status">
          {message}
        </p>
      ) : null}
      <button className="app-button-primary" disabled={busy} type="submit">
        {busy ? "Uploader…" : "Upload dokument"}
      </button>
    </form>
  );
}
