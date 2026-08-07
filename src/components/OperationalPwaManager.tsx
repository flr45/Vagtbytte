"use client";

import { useEffect, useRef, useState } from "react";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type SyncStatus = {
  state: "idle" | "syncing" | "done" | "error";
  current?: number;
  total?: number;
  message?: string;
};

const OFFLINE_ENABLED_KEY = "sbr-operativ-offline-enabled";
const OFFLINE_SYNCED_AT_KEY = "sbr-operativ-offline-synced-at";

export function OperationalPwaManager() {
  const [online, setOnline] = useState(true);
  const [open, setOpen] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({ state: "idle" });
  const [syncedAt, setSyncedAt] = useState<string | null>(null);
  const reloadOnControllerChange = useRef(false);

  useEffect(() => {
    setOnline(navigator.onLine);
    setInstalled(isStandalone());
    setSyncedAt(localStorage.getItem(OFFLINE_SYNCED_AT_KEY));

    const onOnline = () => {
      setOnline(true);
      if (localStorage.getItem(OFFLINE_ENABLED_KEY) === "1") {
        window.setTimeout(() => void requestOfflineSync(), 700);
      }
    };
    const onOffline = () => setOnline(false);
    const onInstallPrompt = (event: Event) => {
      const promptEvent = event as InstallPromptEvent;
      promptEvent.preventDefault();
      setInstallPrompt(promptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setInstallPrompt(null);
    };
    const onControllerChange = () => {
      if (reloadOnControllerChange.current) window.location.reload();
    };
    const onMessage = (event: MessageEvent) => {
      const data = event.data;
      if (!data || typeof data !== "object") return;
      if (data.type === "OPERATIONAL_SYNC_PROGRESS") {
        setSyncStatus({ state: "syncing", current: Number(data.current || 0), total: Number(data.total || 0) });
      }
      if (data.type === "OPERATIONAL_SYNC_DONE") {
        const value = new Date().toISOString();
        localStorage.setItem(OFFLINE_ENABLED_KEY, "1");
        localStorage.setItem(OFFLINE_SYNCED_AT_KEY, value);
        setSyncedAt(value);
        setSyncStatus({ state: "done", current: Number(data.total || 0), total: Number(data.total || 0), message: "Offline-indhold er opdateret." });
      }
      if (data.type === "OPERATIONAL_SYNC_ERROR") {
        setSyncStatus({ state: "error", message: String(data.message || "Offline-synkronisering mislykkedes.") });
      }
      if (data.type === "OPERATIONAL_CACHE_CLEARED") {
        localStorage.removeItem(OFFLINE_ENABLED_KEY);
        localStorage.removeItem(OFFLINE_SYNCED_AT_KEY);
        setSyncedAt(null);
        setSyncStatus({ state: "idle" });
      }
    };

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    window.addEventListener("beforeinstallprompt", onInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);
    navigator.serviceWorker?.addEventListener("controllerchange", onControllerChange);
    navigator.serviceWorker?.addEventListener("message", onMessage);

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistration("/").then((reg) => {
        if (!reg) return;
        setRegistration(reg);
        if (reg.waiting) setUpdateAvailable(true);
        reg.addEventListener("updatefound", () => {
          const worker = reg.installing;
          if (!worker) return;
          worker.addEventListener("statechange", () => {
            if (worker.state === "installed" && navigator.serviceWorker.controller) {
              setUpdateAvailable(true);
            }
          });
        });
      }).catch(() => undefined);
    }

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("beforeinstallprompt", onInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      navigator.serviceWorker?.removeEventListener("controllerchange", onControllerChange);
      navigator.serviceWorker?.removeEventListener("message", onMessage);
    };
  }, []);

  async function requestOfflineSync() {
    if (!navigator.onLine || !("serviceWorker" in navigator)) return;
    setSyncStatus({ state: "syncing", current: 0, total: 0 });
    try {
      const reg = await navigator.serviceWorker.ready;
      const worker = reg.active || navigator.serviceWorker.controller;
      if (!worker) throw new Error("Service worker er ikke klar endnu.");
      worker.postMessage({ type: "SYNC_OPERATIONAL_OFFLINE" });
    } catch (error) {
      setSyncStatus({ state: "error", message: error instanceof Error ? error.message : "Offline-synkronisering mislykkedes." });
    }
  }

  async function installApp() {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === "accepted") setInstallPrompt(null);
  }

  function activateUpdate() {
    const waiting = registration?.waiting;
    if (!waiting) return;
    reloadOnControllerChange.current = true;
    waiting.postMessage({ type: "SKIP_WAITING" });
  }

  async function clearOfflineData() {
    if (!("serviceWorker" in navigator)) return;
    const reg = await navigator.serviceWorker.ready;
    (reg.active || navigator.serviceWorker.controller)?.postMessage({ type: "CLEAR_OPERATIONAL_CACHE" });
  }

  const progress = syncStatus.state === "syncing" && syncStatus.total
    ? `${syncStatus.current ?? 0}/${syncStatus.total}`
    : null;

  return (
    <aside className="fixed bottom-20 left-3 z-40 md:bottom-4 md:left-4" aria-label="App- og offlinestatus">
      {open ? (
        <div className="mb-2 w-[min(92vw,340px)] rounded-xl border border-white/10 bg-[#0b1013]/98 p-4 text-white shadow-2xl backdrop-blur">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[.14em] text-red-500">SBR Fire App</p>
              <h2 className="mt-1 text-base font-black">App & offline</h2>
            </div>
            <button className="grid size-9 place-items-center rounded-lg bg-white/5 text-slate-400" onClick={() => setOpen(false)} type="button" aria-label="Luk">×</button>
          </div>

          <div className="mt-4 grid gap-2 text-xs">
            <StatusRow label="Forbindelse" value={online ? "Online" : "Offline"} good={online} />
            <StatusRow label="Installeret" value={installed ? "Ja" : "Nej"} good={installed} />
            <StatusRow label="Offline-data" value={syncedAt ? formatSyncTime(syncedAt) : "Ikke synkroniseret"} good={Boolean(syncedAt)} />
          </div>

          {syncStatus.state === "syncing" ? (
            <div className="mt-3 rounded-lg bg-blue-500/10 p-3 text-xs font-bold text-blue-300">Synkroniserer offline-indhold{progress ? ` · ${progress}` : "…"}</div>
          ) : null}
          {syncStatus.state === "done" ? <div className="mt-3 rounded-lg bg-emerald-500/10 p-3 text-xs font-bold text-emerald-300">{syncStatus.message}</div> : null}
          {syncStatus.state === "error" ? <div className="mt-3 rounded-lg bg-red-500/10 p-3 text-xs font-bold text-red-300">{syncStatus.message}</div> : null}

          <div className="mt-4 grid gap-2">
            <button className="min-h-11 rounded-lg bg-[#b70f18] px-4 text-sm font-black text-white disabled:opacity-40" disabled={!online || syncStatus.state === "syncing"} onClick={() => void requestOfflineSync()} type="button">
              {syncedAt ? "Opdatér offline-indhold" : "Synkronisér til offline"}
            </button>
            {installPrompt && !installed ? (
              <button className="min-h-11 rounded-lg border border-white/10 bg-[#151b1f] px-4 text-sm font-black" onClick={() => void installApp()} type="button">Installér SBR Fire App</button>
            ) : null}
            {!installed && !installPrompt ? (
              <p className="rounded-lg bg-white/5 p-3 text-xs leading-5 text-slate-400">På iPhone/iPad: brug Del-menuen i Safari og vælg <strong className="text-slate-200">Føj til hjemmeskærm</strong>.</p>
            ) : null}
            {updateAvailable ? (
              <button className="min-h-11 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 text-sm font-black text-amber-300" onClick={activateUpdate} type="button">Ny version tilgængelig · Opdatér</button>
            ) : null}
            {syncedAt ? <button className="min-h-10 text-xs font-bold text-slate-500" onClick={() => void clearOfflineData()} type="button">Ryd offline-data på denne enhed</button> : null}
          </div>
        </div>
      ) : null}

      <button
        className={`flex min-h-11 items-center gap-2 rounded-full border px-3.5 text-xs font-black shadow-xl backdrop-blur ${online ? "border-emerald-500/25 bg-[#0b1013]/95 text-emerald-300" : "border-amber-500/30 bg-amber-950/95 text-amber-300"}`}
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        <span className={`size-2 rounded-full ${online ? "bg-emerald-400" : "bg-amber-400"}`} aria-hidden="true" />
        {online ? (syncStatus.state === "syncing" ? `Synkroniserer ${progress ?? ""}` : "Online") : "Offline"}
        {updateAvailable ? <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[9px] text-amber-300">UPDATE</span> : null}
      </button>
    </aside>
  );
}

function StatusRow({ label, value, good }: { label: string; value: string; good: boolean }) {
  return <div className="flex items-center justify-between gap-3 rounded-lg bg-[#151b1f] px-3 py-2.5"><span className="font-bold text-slate-500">{label}</span><span className={good ? "font-black text-slate-200" : "font-black text-slate-400"}>{value}</span></div>;
}

function isStandalone() {
  const iosStandalone = Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
  return window.matchMedia("(display-mode: standalone)").matches || iosStandalone;
}

function formatSyncTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Synkroniseret";
  return new Intl.DateTimeFormat("da-DK", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(date);
}
