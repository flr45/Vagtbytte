"use client";

import { useState } from "react";
import { setOperationalInteractiveImageAction } from "@/lib/operativ-portal-hotspot-actions";

export function OperationalVehicleImageUseButton({ vehicleId, imageId }: { vehicleId: string; imageId: string }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function selectImage() {
    if (busy) return;
    setBusy(true);
    setMessage("");
    const form = new FormData();
    form.set("vehicleId", vehicleId);
    form.set("imageId", imageId);
    try {
      await setOperationalInteractiveImageAction(form);
      setMessage("Valgt · opdaterer visningen…");
      window.setTimeout(() => window.location.reload(), 150);
    } catch {
      setBusy(false);
      setMessage("Billedet kunne ikke vælges.");
    }
  }

  return (
    <div className="grid gap-1">
      <button className="min-h-10 w-full rounded-lg border border-red-500/30 bg-red-500/10 px-3 text-xs font-black text-red-200 hover:bg-red-500/20 disabled:opacity-50" disabled={busy} onClick={selectImage} type="button">
        {busy ? "Vælger…" : "Brug som interaktivt billede"}
      </button>
      {message ? <small className="text-center text-[10px] font-bold text-slate-400" role="status">{message}</small> : null}
    </div>
  );
}
