"use client";

import { useRef, useState } from "react";

type VehicleOption = { id: string; name: string };

export function OperationalDocumentUploadForm({
  vehicles,
  defaultVehicleId = ""
}: {
  vehicles: VehicleOption[];
  defaultVehicleId?: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

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
        Tilknyt køretøj
        <select
          className="focus-ring min-h-12 rounded-xl border border-zinc-200 bg-white px-4 text-base"
          defaultValue={defaultVehicleId}
          name="vehicleId"
        >
          <option value="">Generelt dokument</option>
          {vehicles.map((vehicle) => (
            <option key={vehicle.id} value={vehicle.id}>
              {vehicle.name}
            </option>
          ))}
        </select>
      </label>
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
        Maks. 25 MB. Tilladte formater: PDF, Word, Excel, JPG, PNG og WebP. Filerne kan kun åbnes af en administrator.
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
