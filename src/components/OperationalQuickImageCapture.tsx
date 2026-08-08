"use client";

import { useEffect, useMemo, useState } from "react";
import { AppIcon } from "./AppIcon";
import { setOperationalInteractiveContextImageAction } from "@/lib/operativ-content-builder-actions";
import { setOperationalVehicleViewAction } from "@/lib/operativ-vehicle-view-actions";
import type { OperationalVehicleViewKey } from "@/lib/operativ-vehicle-view-model";

type SharedTarget = {
  label: string;
  successHref?: string;
};

type ContextTarget = SharedTarget & {
  mode: "context";
  vehicleId: string;
  placeId: string;
  nodeId?: string | null;
};

type VehicleViewTarget = SharedTarget & {
  mode: "vehicle-view";
  vehicleId: string;
  viewKey: OperationalVehicleViewKey;
};

type Props = ContextTarget | VehicleViewTarget;
type CropMode = "original" | "4:3" | "1:1";

function cropRect(width: number, height: number, mode: CropMode) {
  if (mode === "original") return { sx: 0, sy: 0, sw: width, sh: height };
  const ratio = mode === "4:3" ? 4 / 3 : 1;
  const current = width / height;
  if (current > ratio) {
    const sw = height * ratio;
    return { sx: (width - sw) / 2, sy: 0, sw, sh: height };
  }
  const sh = width / ratio;
  return { sx: 0, sy: (height - sh) / 2, sw: width, sh };
}

async function preparedFile(file: File, rotation: number, cropMode: CropMode): Promise<File> {
  const normalized = ((rotation % 360) + 360) % 360;
  if (!normalized && cropMode === "original") return file;

  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const { sx, sy, sw, sh } = cropRect(image.naturalWidth, image.naturalHeight, cropMode);
    const swap = normalized === 90 || normalized === 270;
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(swap ? sh : sw));
    canvas.height = Math.max(1, Math.round(swap ? sw : sh));
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((normalized * Math.PI) / 180);
    ctx.drawImage(image, sx, sy, sw, sh, -sw / 2, -sh / 2, sw, sh);
    const mime = file.type === "image/png" || file.type === "image/webp" ? file.type : "image/jpeg";
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, mime, 0.94));
    return blob ? new File([blob], file.name, { type: mime, lastModified: Date.now() }) : file;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function OperationalQuickImageCapture(props: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [rotation, setRotation] = useState(0);
  const [cropMode, setCropMode] = useState<CropMode>("original");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const previewUrl = useMemo(() => file ? URL.createObjectURL(file) : "", [file]);

  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  function select(next: File | undefined) {
    setFile(next ?? null);
    setRotation(0);
    setCropMode("original");
    setMessage("");
  }

  async function upload() {
    if (!file || busy) return;
    setBusy(true);
    setMessage("");
    try {
      const prepared = await preparedFile(file, rotation, cropMode);
      const form = new FormData();
      form.set("file", prepared);
      form.set("vehicleId", props.vehicleId);
      form.set("title", props.label);
      form.set("altText", props.label);
      if (props.mode === "context") form.set("placeId", props.placeId);

      const response = await fetch("/api/admin/operativ-portal/billeder", { method: "POST", body: form });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.imageId) throw new Error(data.error || "Billedet kunne ikke uploades.");

      const assign = new FormData();
      assign.set("imageId", data.imageId);
      if (props.mode === "context") {
        assign.set("placeId", props.placeId);
        assign.set("nodeId", props.nodeId ?? "");
        const result = await setOperationalInteractiveContextImageAction(assign);
        if (!result?.ok) throw new Error(result?.error || "Billedet kunne ikke vælges.");
      } else {
        assign.set("vehicleId", props.vehicleId);
        assign.set("viewKey", props.viewKey);
        await setOperationalVehicleViewAction(assign);
      }

      setMessage(props.successHref ? "Billedet er gemt · åbner næste…" : "Billedet er gemt.");
      window.setTimeout(() => {
        if (props.successHref) window.location.assign(props.successHref);
        else window.location.reload();
      }, 250);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Billedet kunne ikke gemmes.");
      setBusy(false);
    }
  }

  const previewAspect = cropMode === "4:3" ? "4 / 3" : cropMode === "1:1" ? "1 / 1" : undefined;

  return (
    <div className="grid gap-3 rounded-xl border border-white/10 bg-[#11191e] p-3">
      <div className="flex items-center justify-between gap-2">
        <div><p className="text-[10px] font-black uppercase tracking-[0.14em] text-red-400">Hurtigt billede</p><strong className="text-sm text-white">{props.label}</strong></div>
        {file ? (
          <button className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs font-black text-white" onClick={() => setRotation((value) => (value + 90) % 360)} type="button">
            <AppIcon className="size-4" name="rotate" /> Rotér
          </button>
        ) : null}
      </div>

      {file && previewUrl ? (
        <div className="grid min-h-44 place-items-center overflow-hidden rounded-lg bg-black" style={{ aspectRatio: previewAspect }}>
          <img alt="Forhåndsvisning" className={`max-h-72 max-w-full transition-transform ${cropMode === "original" ? "object-contain" : "h-full w-full object-cover"}`} src={previewUrl} style={{ transform: `rotate(${rotation}deg)` }} />
        </div>
      ) : null}

      {file ? (
        <div className="grid gap-2 sm:grid-cols-[auto_1fr] sm:items-center">
          <span className="text-[10px] font-black uppercase tracking-wide text-slate-500">Beskær</span>
          <div className="grid grid-cols-3 gap-1.5">
            {(["original", "4:3", "1:1"] as CropMode[]).map((mode) => <button className={`rounded-lg border px-2 py-2 text-[10px] font-black ${cropMode === mode ? "border-red-400 bg-red-600 text-white" : "border-white/10 bg-white/5 text-slate-300"}`} key={mode} onClick={() => setCropMode(mode)} type="button">{mode === "original" ? "Original" : mode}</button>)}
          </div>
        </div>
      ) : null}

      <div className="grid gap-2 sm:grid-cols-2">
        <label className="flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-lg bg-red-600 px-3 text-center text-xs font-black text-white hover:bg-red-700">
          <AppIcon className="size-4" name="camera" /> Tag foto
          <input accept="image/jpeg,image/png,image/webp" capture="environment" className="sr-only" onChange={(event) => select(event.target.files?.[0])} type="file" />
        </label>
        <label className="flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 text-center text-xs font-black text-white hover:bg-white/10">
          <AppIcon className="size-4" name="image" /> Vælg billede
          <input accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => select(event.target.files?.[0])} type="file" />
        </label>
      </div>
      {file ? <button className="app-button-primary min-h-11" disabled={busy} onClick={upload} type="button">{busy ? "Gemmer…" : props.successHref ? "Gem og fortsæt" : "Brug billedet her"}</button> : null}
      {message ? <p className="text-xs font-bold text-slate-300" role="status">{message}</p> : null}
      <p className="text-[10px] font-semibold leading-4 text-slate-500">JPEG, PNG eller WebP · maks. 12 MB. Rotation og beskæring sker lokalt på enheden før upload.</p>
    </div>
  );
}
