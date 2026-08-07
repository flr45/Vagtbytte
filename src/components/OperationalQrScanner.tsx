"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type DetectorResult = { rawValue?: string };
type Detector = { detect(source: CanvasImageSource): Promise<DetectorResult[]> };
type DetectorConstructor = new (options?: { formats?: string[] }) => Detector;

export function OperationalQrScanner() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const navigatingRef = useRef(false);
  const [active, setActive] = useState(false);
  const [status, setStatus] = useState("Starter kamera…");
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);

  const openQrValue = useCallback((rawValue: string) => {
    const path = normalizeOperationalQrValue(rawValue);
    if (!path || navigatingRef.current) return false;
    navigatingRef.current = true;
    setStatus("QR-kode fundet – åbner…");
    router.push(path);
    return true;
  }, [router]);

  const stopCamera = useCallback(() => {
    if (timerRef.current !== null) window.clearInterval(timerRef.current);
    timerRef.current = null;
    for (const track of streamRef.current?.getTracks() ?? []) track.stop();
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setActive(false);
  }, []);

  const startCamera = useCallback(async () => {
    stopCamera();
    navigatingRef.current = false;
    setError("");
    setStatus("Starter kamera…");

    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("Denne browser giver ikke adgang til kameraet.");
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) throw new Error("Kameraet kunne ikke initialiseres.");
      video.srcObject = stream;
      await video.play();
      setActive(true);

      const DetectorApi = (window as typeof window & { BarcodeDetector?: DetectorConstructor }).BarcodeDetector;
      if (!DetectorApi) {
        setStatus("Kameraet er åbent. Denne browser kan ikke scanne live – brug 'Tag/Upload billede' nedenunder.");
        return;
      }

      const detector = new DetectorApi({ formats: ["qr_code"] });
      setStatus("Ret kameraet mod en SBR QR-kode");
      timerRef.current = window.setInterval(async () => {
        const source = videoRef.current;
        if (!source || source.readyState < 2 || navigatingRef.current) return;
        try {
          const codes = await detector.detect(source);
          const rawValue = codes.find((code) => code.rawValue)?.rawValue;
          if (rawValue) openQrValue(rawValue);
        } catch {
          // Enkelte frames kan fejle under autofokus; næste frame prøver igen.
        }
      }, 450);
    } catch (cause) {
      stopCamera();
      setStatus("Kameraet blev ikke startet.");
      setError(cause instanceof Error ? cause.message : "Kameraet kunne ikke åbnes.");
    }
  }, [openQrValue, stopCamera]);

  useEffect(() => {
    void startCamera();
    return stopCamera;
  }, [startCamera, stopCamera]);

  async function decodeImage(file: File | undefined) {
    if (!file || uploading) return;
    setUploading(true);
    setError("");
    setStatus("Aflæser QR-koden fra billedet…");
    try {
      const data = new FormData();
      data.set("file", file);
      const response = await fetch("/api/admin/operativ-portal/qr/decode", { method: "POST", body: data });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || "QR-koden kunne ikke aflæses.");
      if (!openQrValue(String(payload?.path ?? ""))) throw new Error("QR-koden peger ikke på Operativ Portal.");
    } catch (cause) {
      setStatus(active ? "Ret kameraet mod en SBR QR-kode" : "Prøv igen eller start kameraet.");
      setError(cause instanceof Error ? cause.message : "QR-koden kunne ikke aflæses.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <section className="overflow-hidden rounded-xl border border-white/10 bg-[#090e11]">
      <div className="relative aspect-[3/4] max-h-[68vh] w-full overflow-hidden bg-black sm:aspect-video">
        <video ref={videoRef} autoPlay muted playsInline className="h-full w-full object-cover" />
        <div className="pointer-events-none absolute inset-[12%]">
          <span className="absolute left-0 top-0 size-14 border-l-4 border-t-4 border-red-600" />
          <span className="absolute right-0 top-0 size-14 border-r-4 border-t-4 border-red-600" />
          <span className="absolute bottom-0 left-0 size-14 border-b-4 border-l-4 border-red-600" />
          <span className="absolute bottom-0 right-0 size-14 border-b-4 border-r-4 border-red-600" />
        </div>
        {!active ? <div className="absolute inset-0 grid place-items-center bg-[#090e11] px-8 text-center text-sm font-bold text-slate-400">Kamera ikke aktivt</div> : null}
      </div>

      <div className="grid gap-3 p-4 text-center">
        <p className="text-sm font-bold text-slate-200">{status}</p>
        {error ? <p className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs font-bold leading-5 text-red-300">{error}</p> : null}
        <div className="grid gap-2 sm:grid-cols-2">
          <button className="app-button-primary w-full" onClick={() => void startCamera()} type="button">{active ? "Genstart kamera" : "Start kamera"}</button>
          <label className="grid min-h-12 cursor-pointer place-items-center rounded-lg border border-white/10 bg-[#151b1f] px-4 text-sm font-black text-white hover:bg-[#1b2227]">
            {uploading ? "Aflæser…" : "Tag / upload billede"}
            <input className="sr-only" accept="image/jpeg,image/png" capture="environment" disabled={uploading} onChange={(event) => void decodeImage(event.target.files?.[0])} type="file" />
          </label>
        </div>
        <p className="text-xs font-medium leading-5 text-slate-500">Live-scanning bruges på understøttede browsere. Billedknappen virker som fallback på telefoner, hvor live QR-aflæsning ikke er tilgængelig.</p>
      </div>
    </section>
  );
}

function normalizeOperationalQrValue(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  let path = trimmed;
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const parsed = new URL(trimmed);
      if (parsed.host !== window.location.host) return null;
      path = `${parsed.pathname}${parsed.search}${parsed.hash}`;
    } catch {
      return null;
    }
  }
  if (path.includes("..") || path.includes("\\")) return null;
  return /^\/admin\/operativ-portal\/(?:koeretoejer\/[0-9a-f-]{36}|rum\/[0-9a-f-]{36}|udstyr\/[0-9a-f-]{36})(?:[#?].*)?$/i.test(path) ? path : null;
}
