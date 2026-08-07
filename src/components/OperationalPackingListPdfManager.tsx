"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type PreviewRow = {
  sourceLine: number;
  placeName: string;
  itemName: string;
  quantity: number;
  note: string;
  confidence: number;
  reason: string;
  placeId: string | null;
  existingPlaceName: string | null;
  itemId: string | null;
  existingItemName: string | null;
  action: "create-place-and-item" | "create-item" | "update-item" | "review";
  selected: boolean;
  edited: boolean;
};

type Preview = {
  vehicle: { id: string; name: string };
  fileName: string;
  rows: PreviewRow[];
  stats: {
    total: number;
    existingPlaces: number;
    newPlaces: number;
    newItems: number;
    updates: number;
    review: number;
  };
};

type ImportResult = {
  importedRows: number;
  createdPlaces: number;
  createdItems: number;
  updatedItems: number;
};

export function OperationalPackingListPdfManager({ vehicleId, vehicleName }: { vehicleId: string; vehicleName: string }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);

  async function analyze() {
    if (!file) {
      setError("Vælg først en PDF-pakkeliste.");
      return;
    }
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const data = new FormData();
      data.set("vehicleId", vehicleId);
      data.set("file", file);
      const response = await fetch("/api/admin/operativ-portal/pakkeliste/pdf-preview", { method: "POST", body: data });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "PDF'en kunne ikke analyseres.");
      setPreview({
        ...payload,
        rows: payload.rows.map((row: Omit<PreviewRow, "selected" | "edited">) => ({
          ...row,
          selected: row.action !== "review",
          edited: false
        }))
      });
    } catch (cause) {
      setPreview(null);
      setError(cause instanceof Error ? cause.message : "PDF'en kunne ikke analyseres.");
    } finally {
      setBusy(false);
    }
  }

  function updateRow(index: number, patch: Partial<PreviewRow>) {
    setPreview((current) => current ? {
      ...current,
      rows: current.rows.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch, edited: true } : row)
    } : current);
  }

  async function importRows() {
    if (!preview) return;
    const selected = preview.rows.filter((row) => row.selected);
    if (selected.length === 0) {
      setError("Vælg mindst én post til import.");
      return;
    }
    setImporting(true);
    setError("");
    setResult(null);
    try {
      const response = await fetch("/api/admin/operativ-portal/pakkeliste/pdf-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vehicleId,
          rows: selected.map((row) => ({
            placeName: row.placeName,
            itemName: row.itemName,
            quantity: row.quantity,
            note: row.note,
            confidence: row.confidence,
            confirmed: row.edited || row.action === "review"
          }))
        })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Pakkelisten kunne ikke importeres.");
      setResult(payload);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Pakkelisten kunne ikke importeres.");
    } finally {
      setImporting(false);
    }
  }

  const selectedCount = preview?.rows.filter((row) => row.selected).length ?? 0;

  return (
    <section className="min-w-0 overflow-hidden rounded-xl border border-red-500/20 bg-[#0d1317]">
      <div className="border-b border-white/10 bg-[#151b1f] p-4">
        <p className="text-[10px] font-black uppercase tracking-[.18em] text-red-400">PDF pakkeliste</p>
        <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-black">Importér og placér udstyr automatisk</h2>
            <p className="mt-1 max-w-2xl text-xs font-semibold leading-5 text-slate-500">Upload en tekstbaseret PDF. Portalen finder rum, udstyr, antal og noter og viser resultatet, før noget gemmes.</p>
          </div>
          <a className="app-button-secondary" href={`/api/admin/operativ-portal/pakkeliste/${vehicleId}/pdf`}>Download {vehicleName} som PDF</a>
        </div>
      </div>

      <div className="grid min-w-0 gap-4 p-4">
        <div className="grid min-w-0 gap-3 rounded-lg border border-white/5 bg-[#10161a] p-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <label className="grid min-w-0 gap-1.5 text-xs font-bold text-slate-300">
            Vælg PDF-pakkeliste
            <input
              accept="application/pdf,.pdf"
              className="dark-input min-w-0 max-w-full overflow-hidden"
              onChange={(event) => {
                setFile(event.target.files?.[0] ?? null);
                setPreview(null);
                setResult(null);
                setError("");
              }}
              type="file"
            />
          </label>
          <button className="app-button-primary min-w-40" disabled={busy || !file} onClick={analyze} type="button">{busy ? "Analyserer…" : "Analysér PDF"}</button>
        </div>

        {error ? <p className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm font-bold text-red-300">{error}</p> : null}
        {result ? (
          <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm font-bold text-emerald-300">
            ✓ {result.importedRows} poster importeret · {result.createdPlaces} nye rum · {result.createdItems} nyt udstyr · {result.updatedItems} opdateret
          </p>
        ) : null}

        {preview ? (
          <>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
              <Stat label="Fundet" value={preview.stats.total} />
              <Stat label="Eksist. rum" value={preview.stats.existingPlaces} />
              <Stat label="Nye rum" value={preview.stats.newPlaces} />
              <Stat label="Nyt udstyr" value={preview.stats.newItems} />
              <Stat label="Opdateres" value={preview.stats.updates} />
              <Stat label="Kontrollér" value={preview.stats.review} warning={preview.stats.review > 0} />
            </div>

            <div className="overflow-hidden rounded-lg border border-white/10">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 bg-[#151b1f] px-3 py-2.5">
                <div><strong className="text-sm">Forhåndsvisning</strong><p className="text-[10px] text-slate-500">{preview.fileName} · ret felter eller fjern flueben før import</p></div>
                <span className="rounded-full bg-red-500/10 px-2.5 py-1 text-[10px] font-black text-red-300">{selectedCount} valgt</span>
              </div>

              <div className="max-h-[650px] overflow-auto">
                {preview.rows.map((row, index) => (
                  <article className={`grid min-w-[760px] grid-cols-[32px_150px_minmax(220px,1fr)_70px_minmax(180px,.7fr)_120px] items-center gap-2 border-t border-white/5 p-2.5 first:border-t-0 ${row.action === "review" ? "bg-amber-500/5" : "bg-[#0d1317]"}`} key={`${row.sourceLine}-${index}`}>
                    <input aria-label={`Importér ${row.itemName}`} checked={row.selected} onChange={(event) => updateRow(index, { selected: event.target.checked })} type="checkbox" />
                    <input className="dark-input min-w-0" onChange={(event) => updateRow(index, { placeName: event.target.value })} value={row.placeName} />
                    <input className="dark-input min-w-0" onChange={(event) => updateRow(index, { itemName: event.target.value })} value={row.itemName} />
                    <input className="dark-input min-w-0" min="1" onChange={(event) => updateRow(index, { quantity: Math.max(1, Number(event.target.value) || 1) })} type="number" value={row.quantity} />
                    <input className="dark-input min-w-0" onChange={(event) => updateRow(index, { note: event.target.value })} placeholder="Note" value={row.note} />
                    <div className="min-w-0">
                      <ActionBadge action={row.action} />
                      <p className="mt-1 truncate text-[9px] text-slate-600" title={row.reason}>{Math.round(row.confidence * 100)}% · linje {row.sourceLine}</p>
                    </div>
                  </article>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs font-semibold text-slate-500">Eksisterende udstyr bliver opdateret i stedet for duplikeret. Nye rum oprettes automatisk.</p>
              <button className="app-button-primary min-w-48" disabled={importing || selectedCount === 0} onClick={importRows} type="button">{importing ? "Importerer…" : `Importér ${selectedCount} poster`}</button>
            </div>
          </>
        ) : null}
      </div>
    </section>
  );
}

function Stat({ label, value, warning = false }: { label: string; value: number; warning?: boolean }) {
  return <div className={`rounded-lg border p-3 ${warning ? "border-amber-500/30 bg-amber-500/10" : "border-white/5 bg-[#151b1f]"}`}><p className="text-[9px] font-bold text-slate-500">{label}</p><strong className={`mt-1 block text-xl ${warning ? "text-amber-300" : "text-white"}`}>{value}</strong></div>;
}

function ActionBadge({ action }: { action: PreviewRow["action"] }) {
  const labels = {
    "create-place-and-item": "Nyt rum + udstyr",
    "create-item": "Nyt udstyr",
    "update-item": "Opdatér",
    review: "Kontrollér"
  } as const;
  const warning = action === "review";
  return <span className={`inline-flex max-w-full truncate rounded px-2 py-1 text-[9px] font-black ${warning ? "bg-amber-500/15 text-amber-300" : "bg-emerald-500/10 text-emerald-300"}`}>{labels[action]}</span>;
}
