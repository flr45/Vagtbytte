"use client";

import { useEffect, useState } from "react";
import type { OperationalTargetType } from "@/lib/operativ-portal-personal";

type CommonProps = {
  type: OperationalTargetType;
  id: string;
  title: string;
  initialFavorite: boolean;
};

export function OperationalFavoriteButton({ type, id, title, initialFavorite }: CommonProps) {
  const [favorite, setFavorite] = useState(initialFavorite);
  const [busy, setBusy] = useState(false);

  async function toggleFavorite() {
    if (busy) return;
    setBusy(true);
    try {
      const response = await fetch("/api/admin/operativ-portal/preferences/favorite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, id, favorite: !favorite })
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || "Favoritten kunne ikke gemmes.");
      setFavorite(Boolean(payload.favorite));
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Favoritten kunne ikke gemmes.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      aria-label={favorite ? `Fjern ${title} fra favoritter` : `Tilføj ${title} til favoritter`}
      className="grid min-h-12 place-items-center rounded-lg bg-[#151b1f] px-3 text-xs font-black text-slate-200 hover:bg-[#1b2227] disabled:opacity-50"
      disabled={busy}
      onClick={toggleFavorite}
      title={favorite ? "Fjern fra favoritter" : "Tilføj til favoritter"}
      type="button"
    >
      <span className="text-xl" aria-hidden="true">{favorite ? "★" : "☆"}</span>
      <span>{favorite ? "Favorit" : "Gem favorit"}</span>
    </button>
  );
}

export function OperationalEntityTools({ type, id, title, initialFavorite }: CommonProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    void fetch("/api/admin/operativ-portal/preferences/recent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, id }),
      keepalive: true
    }).catch(() => undefined);
  }, [type, id]);

  async function share() {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Brugeren kan selv have lukket delingsarket.
    }
  }

  return (
    <div className="grid grid-cols-3 gap-2 rounded-xl border border-white/10 bg-[#0d1317] p-2">
      <OperationalFavoriteButton type={type} id={id} title={title} initialFavorite={initialFavorite} />
      <button className="grid min-h-12 place-items-center rounded-lg bg-[#151b1f] px-3 text-xs font-black text-slate-200 hover:bg-[#1b2227]" onClick={share} type="button">
        <span className="text-lg" aria-hidden="true">↗</span>
        <span>{copied ? "Kopieret" : "Del"}</span>
      </button>
      <a className="grid min-h-12 place-items-center rounded-lg bg-[#151b1f] px-3 text-xs font-black text-slate-200 hover:bg-[#1b2227]" href={`/admin/operativ-portal/qr-label?type=${encodeURIComponent(type)}&id=${encodeURIComponent(id)}`}>
        <span className="text-lg" aria-hidden="true">⌗</span>
        <span>QR-kode</span>
      </a>
    </div>
  );
}
