"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateOperationalVehicleAction } from "@/lib/operativ-portal-actions";

type VehicleDraft = {
  id: string;
  name: string;
  code: string;
  model: string;
  year: number | null;
  fuel: string;
  crew: string;
  sortOrder: number;
  description: string;
  functionText: string;
};

export function OperationalVehicleAdminEditor({ vehicle }: { vehicle: VehicleDraft }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<"" | "saved" | "error">("");
  const [draft, setDraft] = useState({
    name: vehicle.name,
    code: vehicle.code,
    model: vehicle.model,
    year: vehicle.year ? String(vehicle.year) : "",
    fuel: vehicle.fuel,
    crew: vehicle.crew,
    sortOrder: String(vehicle.sortOrder),
    description: vehicle.description,
    functionText: vehicle.functionText
  });

  function setField(field: keyof typeof draft, value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
    setStatus("");
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setStatus("");
    startTransition(async () => {
      try {
        await updateOperationalVehicleAction(formData);
        setStatus("saved");
        router.refresh();
      } catch {
        setStatus("error");
      }
    });
  }

  return (
    <form
      className="relative z-20 grid min-w-0 gap-3 overflow-hidden rounded-lg bg-[#0d1317] p-4 pointer-events-auto"
      onSubmit={submit}
    >
      <input name="vehicleId" type="hidden" value={vehicle.id} />
      <h2 className="text-sm font-black">Køretøjsoplysninger</h2>
      <p className="text-xs font-semibold text-slate-500">Klik i et felt og skriv. Ændringer gemmes først, når du trykker på Gem køretøj.</p>

      <div className="grid min-w-0 gap-3 sm:grid-cols-2">
        <Field label="Navn"><input autoComplete="off" className="dark-input min-w-0" name="name" onChange={(e) => setField("name", e.target.value)} required value={draft.name} /></Field>
        <Field label="Kaldesignal"><input autoComplete="off" className="dark-input min-w-0" name="code" onChange={(e) => setField("code", e.target.value)} placeholder="M2" value={draft.code} /></Field>
        <Field label="Model"><input autoComplete="off" className="dark-input min-w-0" name="model" onChange={(e) => setField("model", e.target.value)} placeholder="Scania P 360" value={draft.model} /></Field>
        <Field label="Årgang"><input className="dark-input min-w-0" max="2200" min="1900" name="year" onChange={(e) => setField("year", e.target.value)} type="number" value={draft.year} /></Field>
        <Field label="Drivmiddel"><input autoComplete="off" className="dark-input min-w-0" name="fuel" onChange={(e) => setField("fuel", e.target.value)} placeholder="Diesel" value={draft.fuel} /></Field>
        <Field label="Mandskab"><input autoComplete="off" className="dark-input min-w-0" name="crew" onChange={(e) => setField("crew", e.target.value)} placeholder="1+5" value={draft.crew} /></Field>
        <Field label="Rækkefølge"><input className="dark-input min-w-0" min="0" name="sortOrder" onChange={(e) => setField("sortOrder", e.target.value)} type="number" value={draft.sortOrder} /></Field>
      </div>

      <Field label="Beskrivelse"><textarea className="dark-input min-h-28 min-w-0 resize-y p-3" name="description" onChange={(e) => setField("description", e.target.value)} value={draft.description} /></Field>
      <Field label="Funktion"><textarea className="dark-input min-h-28 min-w-0 resize-y p-3" name="functionText" onChange={(e) => setField("functionText", e.target.value)} placeholder="Vandforsyning, røgdykning, redning..." value={draft.functionText} /></Field>

      <div aria-live="polite">
        {status === "saved" ? <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm font-bold text-emerald-300">✓ Køretøjet er gemt.</p> : null}
        {status === "error" ? <p className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm font-bold text-red-300">Køretøjet kunne ikke gemmes. Prøv igen.</p> : null}
      </div>

      <button className="app-button-primary w-full" disabled={pending} type="submit">{pending ? "Gemmer…" : "Gem køretøj"}</button>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="grid min-w-0 gap-1.5 text-xs font-bold text-slate-300">{label}{children}</label>;
}
