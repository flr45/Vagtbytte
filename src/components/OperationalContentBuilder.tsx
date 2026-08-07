"use client";

import Link from "next/link";
import { type FormEvent, useMemo, useRef, useState } from "react";
import {
  cloneOperationalInteractiveNodeAction,
  createOperationalInteractiveLinkAction,
  createOperationalInteractiveNodeAction,
  deleteOperationalInteractiveLinkAction,
  moveOperationalInteractiveLinkAction,
  restoreOperationalInteractiveLinkAction,
  setOperationalInteractiveContextImageAction,
  updateOperationalInteractiveLinkAction,
  updateOperationalInteractiveNodeAction
} from "@/lib/operativ-content-builder-actions";
import type { OperationalInteractiveContext, OperationalInteractiveLink } from "@/lib/operativ-content-builder";
import { operationalImageUrl } from "@/lib/operativ-client";
import { OperationalQuickImageCapture } from "./OperationalQuickImageCapture";

function clampPercent(value: number) {
  return Number(Math.max(0, Math.min(100, value)).toFixed(2));
}

export function OperationalContentBuilder({ context }: { context: OperationalInteractiveContext }) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [links, setLinks] = useState(context.links);
  const [draft, setDraft] = useState<{ x: number; y: number } | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dragging, setDragging] = useState<{ id: string; oldX: number; oldY: number } | null>(null);
  const [undoMove, setUndoMove] = useState<{ id: string; x: number; y: number } | null>(null);
  const [undoDeleteId, setUndoDeleteId] = useState<string | null>(null);
  const [targetType, setTargetType] = useState<"item" | "node" | "new-node">(context.children.length ? "node" : "item");
  const [targetId, setTargetId] = useState(context.children[0]?.id ?? context.items[0]?.id ?? "");
  const [newNodeName, setNewNodeName] = useState("");
  const [sizePx, setSizePx] = useState(40);
  const [editTargetType, setEditTargetType] = useState<"item" | "node">("item");
  const [editTargetId, setEditTargetId] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const selected = useMemo(() => links.find((link) => link.id === selectedId) ?? null, [links, selectedId]);
  const currentName = context.nodeName || context.placeName;
  const builderBase = `/admin/operativ-portal/rum/${context.placeId}/byg`;
  const interactiveBase = `/admin/operativ-portal/rum/${context.placeId}/interaktiv`;

  function reloadSoon(delay = 180) {
    window.setTimeout(() => window.location.reload(), delay);
  }

  function pointFromEvent(event: React.PointerEvent) {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect?.width || !rect.height) return null;
    return {
      x: clampPercent(((event.clientX - rect.left) / rect.width) * 100),
      y: clampPercent(((event.clientY - rect.top) / rect.height) * 100)
    };
  }

  function chooseDraft(event: React.PointerEvent<HTMLDivElement>) {
    if (event.button !== 0 && event.pointerType === "mouse") return;
    const point = pointFromEvent(event);
    if (!point) return;
    setDraft(point);
    setSelectedId(null);
    setMessage("");
  }

  function selectLink(link: OperationalInteractiveLink) {
    setSelectedId(link.id);
    setDraft(null);
    setEditTargetType(link.targetType);
    setEditTargetId(link.targetNodeId ?? link.itemId ?? "");
  }

  function beginDrag(event: React.PointerEvent<HTMLButtonElement>, link: OperationalInteractiveLink) {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging({ id: link.id, oldX: link.xPercent, oldY: link.yPercent });
    selectLink(link);
    setUndoDeleteId(null);
  }

  function drag(event: React.PointerEvent<HTMLButtonElement>) {
    if (!dragging) return;
    event.preventDefault();
    const point = pointFromEvent(event);
    if (!point) return;
    setLinks((current) => current.map((link) => link.id === dragging.id ? { ...link, xPercent: point.x, yPercent: point.y } : link));
  }

  async function finishDrag(event: React.PointerEvent<HTMLButtonElement>) {
    if (!dragging) return;
    event.preventDefault();
    event.stopPropagation();
    const point = pointFromEvent(event);
    const previous = dragging;
    setDragging(null);
    if (!point) return;
    setLinks((current) => current.map((link) => link.id === previous.id ? { ...link, xPercent: point.x, yPercent: point.y } : link));
    const form = new FormData();
    form.set("linkId", previous.id);
    form.set("placeId", context.placeId);
    form.set("xPercent", String(point.x));
    form.set("yPercent", String(point.y));
    const result = await moveOperationalInteractiveLinkAction(form);
    if (result?.ok) {
      setUndoMove({ id: previous.id, x: previous.oldX, y: previous.oldY });
      setMessage("Plusset er flyttet. Du kan fortryde nedenfor.");
    } else {
      setLinks((current) => current.map((link) => link.id === previous.id ? { ...link, xPercent: previous.oldX, yPercent: previous.oldY } : link));
      setMessage(result?.error || "Placeringen kunne ikke gemmes.");
    }
  }

  async function undoLastMove() {
    if (!undoMove) return;
    const form = new FormData();
    form.set("linkId", undoMove.id);
    form.set("placeId", context.placeId);
    form.set("xPercent", String(undoMove.x));
    form.set("yPercent", String(undoMove.y));
    const result = await moveOperationalInteractiveLinkAction(form);
    if (result?.ok) {
      setLinks((current) => current.map((link) => link.id === undoMove.id ? { ...link, xPercent: undoMove.x, yPercent: undoMove.y } : link));
      setUndoMove(null);
      setMessage("Flytningen er fortrudt.");
    }
  }

  function targetChanged(type: "item" | "node" | "new-node") {
    setTargetType(type);
    if (type === "node") setTargetId(context.children[0]?.id ?? "");
    if (type === "item") setTargetId(context.items[0]?.id ?? "");
    if (type === "new-node") setTargetId("");
  }

  function editTargetChanged(type: "item" | "node") {
    setEditTargetType(type);
    setEditTargetId(type === "node" ? context.children[0]?.id ?? "" : context.items[0]?.id ?? "");
  }

  async function createLink() {
    if (!draft || busy) return;
    setBusy(true);
    setMessage("");
    const form = new FormData();
    form.set("placeId", context.placeId);
    form.set("sourceNodeId", context.nodeId ?? "");
    form.set("targetType", targetType);
    form.set("targetId", targetId);
    form.set("newNodeName", newNodeName);
    form.set("label", "");
    form.set("xPercent", String(draft.x));
    form.set("yPercent", String(draft.y));
    form.set("sizePx", String(sizePx));
    form.set("sortOrder", String(links.length));
    const result = await createOperationalInteractiveLinkAction(form);
    if (!result?.ok) {
      setMessage(result?.error || "Plusset kunne ikke oprettes.");
      setBusy(false);
      return;
    }
    setMessage("Plusset er oprettet.");
    reloadSoon(200);
  }

  async function saveLink(link: OperationalInteractiveLink, formElement: HTMLFormElement) {
    if (!editTargetId) {
      setMessage("Vælg hvad plusset skal åbne.");
      return;
    }
    setBusy(true);
    const form = new FormData(formElement);
    form.set("linkId", link.id);
    form.set("placeId", context.placeId);
    form.set("targetType", editTargetType);
    form.set("targetId", editTargetId);
    form.set("xPercent", String(link.xPercent));
    form.set("yPercent", String(link.yPercent));
    const result = await updateOperationalInteractiveLinkAction(form);
    setBusy(false);
    setMessage(result?.ok ? "Plusset er gemt." : result?.error || "Plusset kunne ikke gemmes.");
    if (result?.ok) reloadSoon();
  }

  async function deleteLink(linkId: string) {
    const form = new FormData();
    form.set("linkId", linkId);
    form.set("placeId", context.placeId);
    const result = await deleteOperationalInteractiveLinkAction(form);
    if (!result?.ok) return;
    setLinks((current) => current.filter((link) => link.id !== linkId));
    setSelectedId(null);
    setUndoDeleteId(linkId);
    setMessage("Plusset er fjernet. Tryk Fortryd for at gendanne det.");
  }

  async function restoreDeleted() {
    if (!undoDeleteId) return;
    const form = new FormData();
    form.set("linkId", undoDeleteId);
    form.set("placeId", context.placeId);
    const result = await restoreOperationalInteractiveLinkAction(form);
    if (result?.ok) window.location.reload();
  }

  async function saveExistingImage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    const result = await setOperationalInteractiveContextImageAction(new FormData(event.currentTarget));
    setBusy(false);
    setMessage(result?.ok ? "Billedet er valgt." : result?.error || "Billedet kunne ikke vælges.");
    if (result?.ok) reloadSoon();
  }

  async function saveNode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    const result = await updateOperationalInteractiveNodeAction(new FormData(event.currentTarget));
    setBusy(false);
    setMessage(result?.ok ? "Underområdet er gemt." : result?.error || "Underområdet kunne ikke gemmes.");
    if (result?.ok) reloadSoon();
  }

  async function cloneNode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    const result = await cloneOperationalInteractiveNodeAction(new FormData(event.currentTarget));
    setBusy(false);
    if (!result?.ok) {
      setMessage(result?.error || "Underområdet kunne ikke klones.");
      return;
    }
    window.location.href = `${builderBase}?node=${result.id}`;
  }

  async function createChildNode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    const result = await createOperationalInteractiveNodeAction(new FormData(event.currentTarget));
    setBusy(false);
    if (!result?.ok) {
      setMessage(result?.error || "Underområdet kunne ikke oprettes.");
      return;
    }
    window.location.href = `${builderBase}?node=${result.id}`;
  }

  return (
    <div className="grid gap-5">
      <section className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-red-400">Visuel indholdsbygger</p>
            <h1 className="mt-1 text-2xl font-black text-white">{currentName}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-1 text-xs font-bold text-slate-500">
              <Link className="text-red-400 hover:text-red-300" href={builderBase}>{context.placeName}</Link>
              {context.breadcrumbs.map((crumb) => <span className="contents" key={crumb.id}><span>›</span><Link className="text-red-400 hover:text-red-300" href={`${builderBase}?node=${crumb.id}`}>{crumb.name}</Link></span>)}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-black text-white" href={`${interactiveBase}${context.nodeId ? `?node=${context.nodeId}` : ""}`}>▶ Se som brandmand</Link>
            {context.nodeId ? <Link className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-black text-white" href={context.parentNodeId ? `${builderBase}?node=${context.parentNodeId}` : builderBase}>← Et niveau op</Link> : null}
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <OperationalQuickImageCapture label={`Interaktivt billede · ${currentName}`} mode="context" nodeId={context.nodeId} placeId={context.placeId} vehicleId={context.vehicleId} />

        <div className="grid content-start gap-3 rounded-xl border border-white/10 bg-[#0d1317] p-4">
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Eksisterende billede</p>
          <form className="grid gap-3" onSubmit={(event) => void saveExistingImage(event)}>
            <input name="placeId" type="hidden" value={context.placeId} />
            <input name="nodeId" type="hidden" value={context.nodeId ?? ""} />
            <select className="dark-input" defaultValue={context.imageId ?? ""} name="imageId">
              <option value="">Intet interaktivt billede</option>
              {context.images.map((image) => <option key={image.id} value={image.id}>{image.title || image.originalName}</option>)}
            </select>
            <button className="app-button-primary" disabled={busy} type="submit">Brug valgt billede</button>
          </form>
          <p className="text-xs font-semibold leading-5 text-slate-500">Alle billeder, der er uploadet til {context.placeName}, kan genbruges i underområder.</p>
        </div>
      </section>

      {context.nodeId ? (
        <section className="grid gap-4 rounded-xl border border-white/10 bg-[#0d1317] p-4 lg:grid-cols-[minmax(0,1fr)_auto]">
          <form className="grid gap-3 sm:grid-cols-2" onSubmit={(event) => void saveNode(event)}>
            <input name="placeId" type="hidden" value={context.placeId} />
            <input name="nodeId" type="hidden" value={context.nodeId} />
            <label className="grid gap-1.5 text-xs font-black text-slate-300">Navn<input className="dark-input" defaultValue={context.nodeName ?? ""} name="name" required /></label>
            <label className="grid gap-1.5 text-xs font-black text-slate-300">Rækkefølge<input className="dark-input" defaultValue="0" min="0" name="sortOrder" type="number" /></label>
            <label className="grid gap-1.5 text-xs font-black text-slate-300 sm:col-span-2">Beskrivelse<textarea className="dark-input min-h-20 p-3" defaultValue={context.nodeDescription} name="description" /></label>
            <button className="app-button-primary sm:col-span-2" disabled={busy} type="submit">Gem underområde</button>
          </form>
          <form className="self-end" onSubmit={(event) => void cloneNode(event)}>
            <input name="placeId" type="hidden" value={context.placeId} />
            <input name="nodeId" type="hidden" value={context.nodeId} />
            <button className="min-h-11 rounded-lg border border-white/10 bg-white/5 px-4 text-xs font-black text-white hover:bg-white/10 disabled:opacity-40" disabled={busy} type="submit">⧉ Klon hele dette niveau</button>
          </form>
        </section>
      ) : null}

      <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#080c0f] shadow-2xl">
        <div className="border-b border-white/10 bg-[#b70f18] px-4 py-3 text-center">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-red-100/70">Redigeringstilstand</p>
          <h2 className="mt-0.5 text-base font-black text-white">Tryk på tom plads for nyt + · træk eksisterende + for at flytte</h2>
        </div>

        {context.imageId ? (
          <div className="relative cursor-crosshair touch-none overflow-hidden bg-black" onPointerDown={chooseDraft} ref={canvasRef}>
            <img alt={currentName} className="pointer-events-none block w-full select-none" draggable={false} src={operationalImageUrl(context.imageId)} />
            {links.map((link) => (
              <button
                aria-label={`Redigér ${link.label || link.targetName}`}
                className={`absolute z-20 grid -translate-x-1/2 -translate-y-1/2 touch-none place-items-center rounded-full border-2 font-black leading-none text-white shadow-[0_5px_22px_rgba(0,0,0,.75)] ${selectedId === link.id ? "border-yellow-300 bg-red-500 ring-4 ring-yellow-300/30" : "border-white bg-red-600"}`}
                key={link.id}
                onClick={(event) => { event.preventDefault(); event.stopPropagation(); selectLink(link); }}
                onPointerDown={(event) => beginDrag(event, link)}
                onPointerMove={drag}
                onPointerUp={finishDrag}
                style={{ left: `${link.xPercent}%`, top: `${link.yPercent}%`, width: link.sizePx, height: link.sizePx, fontSize: Math.max(18, Math.round(link.sizePx * 0.55)) }}
                title={`${link.label || link.targetName} · træk for at flytte`}
                type="button"
              >+</button>
            ))}
            {draft ? <span className="pointer-events-none absolute z-10 grid -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-emerald-100 bg-emerald-600 font-black text-white shadow-xl" style={{ left: `${draft.x}%`, top: `${draft.y}%`, width: sizePx, height: sizePx, fontSize: Math.max(18, Math.round(sizePx * 0.55)) }}>+</span> : null}
          </div>
        ) : <div className="grid min-h-64 place-items-center p-6 text-center text-sm font-semibold text-slate-500">Tag eller vælg et billede ovenfor. Derefter kan du placere plusser direkte på billedet.</div>}

        <div className="border-t border-white/10 bg-[#0d1317] p-4">
          {message ? (
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/5 p-3 text-xs font-bold text-slate-300">
              <span>{message}</span>
              <span className="flex gap-2">
                {undoMove ? <button className="rounded-lg bg-white px-3 py-2 font-black text-black" onClick={undoLastMove} type="button">Fortryd flytning</button> : null}
                {undoDeleteId ? <button className="rounded-lg bg-white px-3 py-2 font-black text-black" onClick={restoreDeleted} type="button">Fortryd sletning</button> : null}
              </span>
            </div>
          ) : null}

          {draft ? (
            <div className="grid gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
              <div><p className="text-[10px] font-black uppercase tracking-[0.14em] text-emerald-400">Nyt plus</p><h3 className="text-sm font-black">Hvad skal plusset åbne?</h3></div>
              <div className="grid gap-3 sm:grid-cols-3">
                <button className={`rounded-lg border px-3 py-3 text-xs font-black ${targetType === "item" ? "border-red-400 bg-red-600 text-white" : "border-white/10 bg-white/5 text-slate-300"}`} disabled={!context.items.length} onClick={() => targetChanged("item")} type="button">Værktøj</button>
                <button className={`rounded-lg border px-3 py-3 text-xs font-black ${targetType === "node" ? "border-red-400 bg-red-600 text-white" : "border-white/10 bg-white/5 text-slate-300"}`} disabled={!context.children.length} onClick={() => targetChanged("node")} type="button">Eksisterende underområde</button>
                <button className={`rounded-lg border px-3 py-3 text-xs font-black ${targetType === "new-node" ? "border-red-400 bg-red-600 text-white" : "border-white/10 bg-white/5 text-slate-300"}`} onClick={() => targetChanged("new-node")} type="button">+ Nyt underområde</button>
              </div>
              {targetType === "item" ? <select className="dark-input" onChange={(event) => setTargetId(event.target.value)} value={targetId}>{context.items.map((item) => <option key={item.id} value={item.id}>{item.name}{item.quantity > 1 ? ` ×${item.quantity}` : ""}</option>)}</select> : null}
              {targetType === "node" ? <select className="dark-input" onChange={(event) => setTargetId(event.target.value)} value={targetId}>{context.children.map((node) => <option key={node.id} value={node.id}>{node.name}</option>)}</select> : null}
              {targetType === "new-node" ? <input className="dark-input" maxLength={120} onChange={(event) => setNewNodeName(event.target.value)} placeholder="Fx Øverste hylde eller Kasse 1" value={newNodeName} /> : null}
              <label className="grid gap-2 text-xs font-black text-slate-300">Plusstørrelse · {sizePx}px<input max="96" min="24" onChange={(event) => setSizePx(Number(event.target.value))} step="2" type="range" value={sizePx} /></label>
              <div className="flex flex-wrap gap-2"><button className="app-button-primary min-h-11 flex-1 disabled:opacity-40" disabled={busy || (targetType === "new-node" ? !newNodeName.trim() : !targetId)} onClick={createLink} type="button">{busy ? "Gemmer…" : "Opret plus"}</button><button className="rounded-lg border border-white/10 px-4 text-xs font-black text-slate-300" onClick={() => setDraft(null)} type="button">Annuller</button></div>
            </div>
          ) : selected ? (
            <form className="grid gap-3 rounded-xl border border-yellow-300/20 bg-yellow-300/5 p-4" onSubmit={(event) => { event.preventDefault(); void saveLink(selected, event.currentTarget); }}>
              <div className="flex items-start justify-between gap-3">
                <div><p className="text-[10px] font-black uppercase tracking-[0.14em] text-yellow-300">Valgt plus</p><h3 className="text-sm font-black">{selected.targetName}</h3><p className="text-xs text-slate-500">Mål, label, størrelse og placering kan ændres.</p></div>
                <button className="rounded-lg border border-red-500/30 px-3 py-2 text-xs font-black text-red-400" onClick={() => void deleteLink(selected.id)} type="button">Slet</button>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1.5 text-xs font-black text-slate-300">Åbn type<select className="dark-input" onChange={(event) => editTargetChanged(event.target.value as "item" | "node")} value={editTargetType}><option value="item">Værktøj</option><option disabled={!context.children.length} value="node">Underområde</option></select></label>
                <label className="grid gap-1.5 text-xs font-black text-slate-300">Åbner{editTargetType === "node" ? <select className="dark-input" onChange={(event) => setEditTargetId(event.target.value)} value={editTargetId}>{context.children.map((node) => <option key={node.id} value={node.id}>{node.name}</option>)}</select> : <select className="dark-input" onChange={(event) => setEditTargetId(event.target.value)} value={editTargetId}>{context.items.map((item) => <option key={item.id} value={item.id}>{item.name}{item.quantity > 1 ? ` ×${item.quantity}` : ""}</option>)}</select>}</label>
              </div>

              <label className="grid gap-1.5 text-xs font-black text-slate-300">Label<input className="dark-input" defaultValue={selected.label} maxLength={100} name="label" placeholder={selected.targetName} /></label>
              <div className="grid gap-3 sm:grid-cols-2"><label className="grid gap-1.5 text-xs font-black text-slate-300">Størrelse<input className="dark-input" defaultValue={selected.sizePx} max="96" min="24" name="sizePx" step="2" type="number" /></label><label className="grid gap-1.5 text-xs font-black text-slate-300">Rækkefølge<input className="dark-input" defaultValue={selected.sortOrder} min="0" name="sortOrder" type="number" /></label></div>
              <p className="text-[10px] font-semibold text-slate-500">Placering: {selected.xPercent.toFixed(1)}% / {selected.yPercent.toFixed(1)}% · træk plusset direkte på billedet for at flytte det.</p>
              <button className="app-button-primary" disabled={busy || !editTargetId} type="submit">Gem pluspunkt</button>
            </form>
          ) : <p className="text-center text-xs font-semibold text-slate-500">Tryk på billedet for at oprette et nyt plus, eller tryk på et eksisterende plus for at redigere det.</p>}
        </div>
      </section>

      <section className="grid gap-3 rounded-xl border border-white/10 bg-[#0d1317] p-4">
        <div className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[0.14em] text-red-400">Næste niveau</p><h2 className="text-lg font-black">Underområder i {currentName}</h2></div><span className="rounded-full bg-white/5 px-2.5 py-1 text-xs font-black text-slate-400">{context.children.length}</span></div>
        <div className="grid gap-2 sm:grid-cols-2">
          {context.children.map((node) => <Link className="grid min-h-16 grid-cols-[minmax(0,1fr)_24px] items-center gap-2 rounded-lg border border-white/10 bg-[#11191e] p-3 hover:border-red-500/30" href={`${builderBase}?node=${node.id}`} key={node.id}><span><strong className="block text-sm text-white">{node.name}</strong><small className="mt-1 block text-xs text-slate-500">{node.imageId ? "Billede valgt" : "Mangler billede"}</small></span><span className="text-xl text-red-500">›</span></Link>)}
        </div>
        <form className="mt-2 grid gap-2 rounded-lg border border-dashed border-white/15 p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_110px_auto]" onSubmit={(event) => void createChildNode(event)}>
          <input name="placeId" type="hidden" value={context.placeId} />
          <input name="parentNodeId" type="hidden" value={context.nodeId ?? ""} />
          <input className="dark-input" maxLength={120} name="name" placeholder="Nyt underområde" required />
          <input className="dark-input" maxLength={500} name="description" placeholder="Kort beskrivelse" />
          <input className="dark-input" defaultValue={context.children.length} min="0" name="sortOrder" type="number" />
          <button className="rounded-lg bg-white px-4 py-2 text-xs font-black text-black disabled:opacity-40" disabled={busy} type="submit">Opret</button>
        </form>
      </section>
    </div>
  );
}
