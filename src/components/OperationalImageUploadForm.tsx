"use client";

import { useEffect, useRef, useState } from "react";
import { setOperationalVehicleViewAction } from "@/lib/operativ-vehicle-view-actions";
import { OPERATIONAL_VIEW_CONFIG, OPERATIONAL_VIEW_KEYS, type OperationalVehicleViewKey } from "@/lib/operativ-vehicle-view-model";

export function OperationalImageUploadForm({
  vehicleId,
  placeId = "",
  itemId = ""
}: {
  vehicleId: string;
  placeId?: string;
  itemId?: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [preview, setPreview] = useState("");
  const vehicleOnly = !placeId && !itemId;

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!formRef.current) return;
    setBusy(true);
    setMessage("");
    try {
      const formData = new FormData(formRef.current);
      const selectedView = vehicleOnly ? String(formData.get("viewKey") ?? "") : "";
      const response = await fetch("/api/admin/operativ-portal/billeder", {
        method: "POST",
        body: formData
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.imageId) throw new Error(data.error || "Billedet kunne ikke uploades.");

      if (selectedView && OPERATIONAL_VIEW_KEYS.includes(selectedView as OperationalVehicleViewKey)) {
        const assign = new FormData();
        assign.set("vehicleId", vehicleId);
        assign.set("viewKey", selectedView);
        assign.set("imageId", data.imageId);
        await setOperationalVehicleViewAction(assign);
      }

      setMessage(selectedView ? `Billedet er uploadet og valgt som ${OPERATIONAL_VIEW_CONFIG[selectedView as OperationalVehicleViewKey].label.toLowerCase()}.` : "Billedet er uploadet.");
      window.setTimeout(() => window.location.reload(), 350);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Billedet kunne ikke uploades.");
      setBusy(false);
    }
  }

  function selectFile(event: React.ChangeEvent<HTMLInputElement>) {
    if (preview) URL.revokeObjectURL(preview);
    const file = event.target.files?.[0];
    setPreview(file ? URL.createObjectURL(file) : "");
  }

  return (
    <form className="grid min-w-0 gap-4 overflow-hidden" onSubmit={submit} ref={formRef}>
      <input name="vehicleId" type="hidden" value={vehicleId} />
      <input name="placeId" type="hidden" value={placeId} />
      <input name="itemId" type="hidden" value={itemId} />
      {preview ? <img alt="Forhåndsvisning" className="aspect-video w-full min-w-0 rounded-xl bg-[#20272c] object-contain" src={preview} /> : null}
      <label className="grid min-w-0 gap-2 text-sm font-bold text-slate-300">
        Billede
        <input className="focus-ring block w-full min-w-0 max-w-full overflow-hidden rounded-xl border border-white/10 bg-[#11171b] p-3 text-sm text-slate-300 file:mr-3 file:max-w-full file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-2 file:font-bold file:text-white" accept="image/jpeg,image/png,image/webp" name="file" onChange={selectFile} required type="file" />
      </label>
      {vehicleOnly ? (
        <label className="grid min-w-0 gap-2 text-sm font-bold text-slate-300">
          Placering / visning
          <select className="dark-input min-w-0" defaultValue="" name="viewKey">
            <option value="">Generelt køretøjsbillede</option>
            {OPERATIONAL_VIEW_KEYS.map((viewKey) => <option key={viewKey} value={viewKey}>{OPERATIONAL_VIEW_CONFIG[viewKey].label}</option>)}
          </select>
          <span className="text-xs font-semibold leading-5 text-slate-500">Vælger du Front, Højre side, Bagende, Venstre side eller Tag, bliver billedet automatisk knyttet til den visning.</span>
        </label>
      ) : null}
      <label className="grid min-w-0 gap-2 text-sm font-bold text-slate-300">
        Titel
        <input className="dark-input min-w-0" maxLength={180} name="title" placeholder="Fx M2 set fra venstre side" />
      </label>
      <label className="grid min-w-0 gap-2 text-sm font-bold text-slate-300">
        Alternativ tekst
        <input className="dark-input min-w-0" maxLength={300} name="altText" placeholder="Beskriv kort hvad billedet viser" />
      </label>
      <label className="flex min-w-0 items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3 text-sm font-bold text-slate-300">
        <input className="size-5 shrink-0" name="isCover" type="checkbox" value="true" />
        <span className="min-w-0">Brug som forsidebillede</span>
      </label>
      <p className="text-xs font-semibold leading-5 text-slate-500">JPEG, PNG eller WebP. Maks. 12 MB. Billedet kan kun åbnes af brugere med adgang til Operativ Portal.</p>
      {message ? <p className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm font-bold text-slate-300" role="status">{message}</p> : null}
      <button className="app-button-primary min-h-12 w-full" disabled={busy} type="submit">{busy ? "Uploader…" : "Upload billede"}</button>
    </form>
  );
}
