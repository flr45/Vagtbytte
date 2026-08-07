"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { setOperationalFavoriteAction } from "@/lib/operativ-portal-personal-actions";
import type { OperationalTargetType } from "@/lib/operativ-portal-personal";

type CommonProps = {
  type: OperationalTargetType;
  id: string;
  title: string;
  initialFavorite: boolean;
};

type ContextTarget = { type: OperationalTargetType; id: string };

type FavoriteStatus = "idle" | "saving" | "saved" | "error";

export function OperationalFavoriteButton({ type, id, title, initialFavorite }: CommonProps) {
  const [favorite, setFavorite] = useState(initialFavorite);
  const [status, setStatus] = useState<FavoriteStatus>("idle");

  async function toggleFavorite() {
    if (status === "saving") return;
    setStatus("saving");
    const result = await setOperationalFavoriteAction({ type, id, favorite: !favorite });
    if (!result.ok) {
      setStatus("error");
      window.alert(result.error);
      return;
    }
    setFavorite(result.favorite);
    setStatus("saved");
    window.setTimeout(() => setStatus("idle"), 1400);
  }

  return (
    <button
      aria-label={favorite ? `Fjern ${title} fra favoritter` : `Tilføj ${title} til favoritter`}
      className="grid min-h-12 place-items-center rounded-lg bg-[#151b1f] px-3 text-xs font-black text-slate-200 hover:bg-[#1b2227] disabled:opacity-50"
      disabled={status === "saving"}
      onClick={() => void toggleFavorite()}
      title={favorite ? "Fjern fra favoritter" : "Tilføj til favoritter"}
      type="button"
    >
      <span className="text-xl" aria-hidden="true">{status === "saving" ? "…" : favorite ? "★" : "☆"}</span>
      <span>{status === "saved" ? "Gemt ✓" : status === "error" ? "Fejl" : favorite ? "Favorit" : "Gem favorit"}</span>
    </button>
  );
}

export function OperationalEntityTools({ type, id, title, initialFavorite }: CommonProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    recordRecent(type, id);
  }, [type, id]);

  async function share() {
    await shareCurrentPage(title, () => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    });
  }

  return (
    <div className="grid grid-cols-3 gap-2 rounded-xl border border-white/10 bg-[#0d1317] p-2">
      <OperationalFavoriteButton type={type} id={id} title={title} initialFavorite={initialFavorite} />
      <button className="grid min-h-12 place-items-center rounded-lg bg-[#151b1f] px-3 text-xs font-black text-slate-200 hover:bg-[#1b2227]" onClick={() => void share()} type="button">
        <span className="text-lg" aria-hidden="true">↗</span><span>{copied ? "Kopieret" : "Del"}</span>
      </button>
      <QrLink type={type} id={id} />
    </div>
  );
}

export function OperationalContextTools() {
  const pathname = usePathname();
  const target = useMemo(() => parseOperationalTarget(pathname), [pathname]);
  const [favorite, setFavorite] = useState(false);
  const [title, setTitle] = useState("Operativ Portal");
  const [status, setStatus] = useState<FavoriteStatus>("idle");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!target) return;
    let cancelled = false;
    setFavorite(false);
    setStatus("idle");
    fetch(`/api/admin/operativ-portal/preferences/favorite?type=${encodeURIComponent(target.type)}&id=${encodeURIComponent(target.id)}`, { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json().catch(() => null);
        if (!response.ok) throw new Error(payload?.error || "Favoritstatus kunne ikke hentes.");
        if (!cancelled) {
          setFavorite(Boolean(payload.favorite));
          setTitle(String(payload.title || document.title || "Operativ Portal"));
        }
      })
      .catch(() => undefined);
    recordRecent(target.type, target.id);
    return () => { cancelled = true; };
  }, [target]);

  if (!target) return null;
  const currentTarget = target;

  async function toggle() {
    if (status === "saving") return;
    setStatus("saving");
    const result = await setOperationalFavoriteAction({
      type: currentTarget.type,
      id: currentTarget.id,
      favorite: !favorite
    });
    if (!result.ok) {
      setStatus("error");
      window.alert(result.error);
      return;
    }
    setFavorite(result.favorite);
    setStatus("saved");
    window.setTimeout(() => setStatus("idle"), 1400);
  }

  async function share() {
    await shareCurrentPage(title, () => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    });
  }

  return (
    <aside aria-label="Hurtigværktøjer" className="fixed bottom-20 right-3 z-40 grid grid-cols-3 gap-1 rounded-xl border border-white/10 bg-[#0b1013]/95 p-1.5 shadow-2xl backdrop-blur md:bottom-4 md:right-4">
      <button aria-label={favorite ? "Fjern fra favoritter" : "Tilføj til favoritter"} className="grid size-12 place-items-center rounded-lg bg-[#151b1f] text-xl text-white hover:bg-[#1b2227] disabled:opacity-50" disabled={status === "saving"} onClick={() => void toggle()} title={status === "saved" ? "Favorit gemt" : favorite ? "Fjern fra favoritter" : "Tilføj til favoritter"} type="button">{status === "saving" ? "…" : status === "saved" ? "✓" : favorite ? "★" : "☆"}</button>
      <button aria-label="Del siden" className="grid size-12 place-items-center rounded-lg bg-[#151b1f] text-lg text-white hover:bg-[#1b2227]" onClick={() => void share()} title={copied ? "Link kopieret" : "Del"} type="button">{copied ? "✓" : "↗"}</button>
      <a aria-label="Åbn QR-label" className="grid size-12 place-items-center rounded-lg bg-[#151b1f] text-lg text-white hover:bg-[#1b2227]" href={`/admin/operativ-portal/qr-label?type=${encodeURIComponent(currentTarget.type)}&id=${encodeURIComponent(currentTarget.id)}`} title="QR-kode">⌗</a>
    </aside>
  );
}

function QrLink({ type, id }: { type: OperationalTargetType; id: string }) {
  return <a className="grid min-h-12 place-items-center rounded-lg bg-[#151b1f] px-3 text-xs font-black text-slate-200 hover:bg-[#1b2227]" href={`/admin/operativ-portal/qr-label?type=${encodeURIComponent(type)}&id=${encodeURIComponent(id)}`}><span className="text-lg" aria-hidden="true">⌗</span><span>QR-kode</span></a>;
}

function parseOperationalTarget(pathname: string): ContextTarget | null {
  const match = pathname.match(/^\/admin\/operativ-portal\/(koeretoejer|rum|udstyr)\/([0-9a-f-]{36})(?:\/|$)/i);
  if (!match) return null;
  const type: OperationalTargetType = match[1] === "koeretoejer" ? "vehicle" : match[1] === "rum" ? "place" : "item";
  return { type, id: match[2] };
}

function recordRecent(type: OperationalTargetType, id: string) {
  void fetch("/api/admin/operativ-portal/preferences/recent", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type, id }),
    keepalive: true
  }).catch(() => undefined);
}

async function shareCurrentPage(title: string, copied: () => void) {
  const url = window.location.href;
  try {
    if (navigator.share) {
      await navigator.share({ title, url });
      return;
    }
    await navigator.clipboard.writeText(url);
    copied();
  } catch {
    // Brugeren kan have lukket delingsarket.
  }
}
