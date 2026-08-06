"use client";

import { useEffect, useRef, useState } from "react";

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

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!formRef.current) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/operativ-portal/billeder", {
        method: "POST",
        body: new FormData(formRef.current)
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Billedet kunne ikke uploades.");
      setMessage("Billedet er uploadet.");
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
    <form className="grid gap-4" onSubmit={submit} ref={formRef}>
      <input name="vehicleId" type="hidden" value={vehicleId} />
      <input name="placeId" type="hidden" value={placeId} />
      <input name="itemId" type="hidden" value={itemId} />
      {preview ? <img alt="Forhåndsvisning" className="aspect-video w-full rounded-xl bg-zinc-100 object-contain" src={preview} /> : null}
      <label className="grid gap-2 text-sm font-bold text-zinc-700">
        Billede
        <input className="focus-ring rounded-xl border border-zinc-200 bg-white p-3" accept="image/jpeg,image/png,image/webp" name="file" onChange={selectFile} required type="file" />
      </label>
      <label className="grid gap-2 text-sm font-bold text-zinc-700">
        Titel
        <input className="focus-ring min-h-12 rounded-xl border border-zinc-200 px-4" maxLength={180} name="title" placeholder="Fx M2 set fra venstre side" />
      </label>
      <label className="grid gap-2 text-sm font-bold text-zinc-700">
        Alternativ tekst
        <input className="focus-ring min-h-12 rounded-xl border border-zinc-200 px-4" maxLength={300} name="altText" placeholder="Beskriv kort hvad billedet viser" />
      </label>
      <label className="flex items-center gap-3 rounded-xl bg-zinc-50 p-3 text-sm font-bold text-zinc-700">
        <input className="size-5" name="isCover" type="checkbox" value="true" />
        Brug som forsidebillede
      </label>
      <p className="text-xs font-semibold text-zinc-500">JPEG, PNG eller WebP. Maks. 12 MB. Billedet kan kun åbnes med administratoradgang.</p>
      {message ? <p className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm font-bold text-zinc-700" role="status">{message}</p> : null}
      <button className="app-button-primary min-h-12" disabled={busy} type="submit">{busy ? "Uploader…" : "Upload billede"}</button>
    </form>
  );
}
