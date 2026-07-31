"use client";

import { useState } from "react";

const STATIONS = [
  { code: "A", label: "Slagelse" },
  { code: "S", label: "Sorø" },
  { code: "K", label: "Korsør" },
  { code: "L", label: "Skælskør" },
  { code: "R", label: "Ruds Vedby" }
] as const;

export function AlarmStationSelector({
  userId,
  initialStations
}: {
  userId: string;
  initialStations: string[];
}) {
  const [stations, setStations] = useState(initialStations);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  function toggle(code: string) {
    setStations((current) =>
      current.includes(code) ? current.filter((value) => value !== code) : [...current, code]
    );
  }

  async function save() {
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/firefighters/${userId}/stations`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stations })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Kunne ikke gemme stationer");
      setMessage("Stationer gemt.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Kunne ikke gemme stationer");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-3 rounded-md border border-brand-line bg-zinc-50 p-3">
      <div>
        <p className="font-bold">Alarmstationer</p>
        <p className="text-sm text-zinc-600">Vælg hvilke stationers alarmmeldinger brandmanden skal modtage.</p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {STATIONS.map((station) => (
          <label className="flex min-h-11 items-center gap-3 rounded-md border border-zinc-200 bg-white px-3" key={station.code}>
            <input
              checked={stations.includes(station.code)}
              onChange={() => toggle(station.code)}
              type="checkbox"
            />
            <span className="font-semibold">({station.code}) {station.label}</span>
          </label>
        ))}
      </div>
      <button
        className="app-button-secondary min-h-11 w-fit px-4"
        disabled={saving}
        onClick={save}
        type="button"
      >
        {saving ? "Gemmer…" : "Gem alarmstationer"}
      </button>
      {message ? <p className="text-sm font-semibold">{message}</p> : null}
    </div>
  );
}
