"use client";

import Link from "next/link";
import { type FormEvent, useMemo, useRef, useState } from "react";
import { AppIcon } from "./AppIcon";
import { OperationalQuickImageCapture } from "./OperationalQuickImageCapture";
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

function clampPercent(value: number) {
  return Number(Math.max(0, Math.min(100, value)).toFixed(2));
}

type Point = { x: number; y: number };
type Interaction =
  | { kind: "idle" }
  | { kind: "placing" }
  | { kind: "creating"; point: Point }
  | { kind: "editing"; id: string }
  | { kind: "dragging"; id: string; oldX: number; oldY: number };

type UndoAction =
  | { kind: "move"; id: string; x: number; y: number }
  | { kind: "delete"; id: string }
  | null;

export function OperationalContentBuilder({ context }: { context: OperationalInteractiveContext }) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [links, setLinks] = useState(context.links);
  const [interaction, setInteraction] = useState<Interaction>({ kind: "idle" });
  const [undo, setUndo] = useState<UndoAction>(null);
  const [targetType, setTargetType] = useState<"item" | "node" | "new-node">(
    context.children.length ? "node" : "item"
  );
  const [targetId, setTargetId] = useState(context.children[0]?.id ?? context.items[0]?.id ?? "");
  const [newNodeName, setNewNodeName] = useState("");
  const [sizePx, setSizePx] = useState(40);
  const [editTarget, setEditTarget] = useState<{ type: "item" | "node"; id: string }>({ type: "item", id: "" });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const selectedId = interaction.kind === "editing" || interaction.kind === "dragging" ? interaction.id : null;
  const selected = useMemo(() => links.find((link) => link.id === selectedId) ?? null, [links, selectedId]);
  const draft = interaction.kind === "creating" ? interaction.point : null;
  const currentName = context.nodeName || context.placeName;
  const builderBase = `/admin/operativ-portal/rum/${context.placeId}/byg`;
  const interactiveBase = `/admin/operativ-portal/rum/${context.placeId}/interaktiv`;

  function reload() {
    window.location.reload();
  }

  function pointFromEvent(event: React.PointerEvent) {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect?.width || !rect.height) return null;
    return {
      x: clampPercent(((event.clientX - rect.left) / rect.width) * 100),
      y: clampPercent(((event.clientY - rect.top) / rect.height) * 100)
    };
  }

  function startPlacement() {
    setInteraction({ kind: "placing" });
    setUndo(null);
    setMessage("Placering er aktiv. Klik på billedet dér, hvor det nye plus skal ligge.");
  }

  function cancelInteraction() {
    if (interaction.kind === "dragging") {
      setLinks((current) => current.map((link) => link.id === interaction.id
        ? { ...link, xPercent: interaction.oldX, yPercent: interaction.oldY }
        : link));
    }
    setInteraction({ kind: "idle" });
    setMessage("");
  }

  function chooseCanvasPosition(event: React.PointerEvent<HTMLDivElement>) {
    if (interaction.kind !== "placing") return;
    if (event.button !== 0 && event.pointerType === "mouse") return;
    const point = pointFromEvent(event);
    if (!point) return;
    setInteraction({ kind: "creating", point });
    setUndo(null);
    setMessage("");
  }

  function selectLink(link: OperationalInteractiveLink) {
    setEditTarget({ type: link.targetType, id: link.targetNodeId ?? link.itemId ?? "" });
    setInteraction({ kind: "editing", id: link.id });
    setMessage("");
  }

  function beginDrag(event: React.PointerEvent<HTMLButtonElement>, link: OperationalInteractiveLink) {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    setEditTarget({ type: link.targetType, id: link.targetNodeId ?? link.itemId ?? "" });
    setUndo(null);
    setInteraction({ kind: "dragging", id: link.id, oldX: link.xPercent, oldY: link.yPercent });
  }

  function drag(event: React.PointerEvent<HTMLButtonElement>) {
    if (interaction.kind !== "dragging") return;
    event.preventDefault();
    event.stopPropagation();
    const point = pointFromEvent(event);
    if (!point) return;
    setLinks((current) => current.map((link) => link.id === interaction.id
      ? { ...link, xPercent: point.x, yPercent: point.y }
      : link));
  }

  async function finishDrag(event: React.PointerEvent<HTMLButtonElement>) {
    if (interaction.kind !== "dragging") return;
    event.preventDefault();
    event.stopPropagation();
    const dragging = interaction;
    const point = pointFromEvent(event);
    setInteraction({ kind: "editing", id: dragging.id });

    if (!point) {
      setLinks((current) => current.map((link) => link.id === dragging.id
        ? { ...link, xPercent: dragging.oldX, yPercent: dragging.oldY }
        : link));
      return;
    }

    const moved = Math.abs(point.x - dragging.oldX) >= 0.15 || Math.abs(point.y - dragging.oldY) >= 0.15;
    if (!moved) {
      setLinks((current) => current.map((link) => link.id === dragging.id
        ? { ...link, xPercent: dragging.oldX, yPercent: dragging.oldY }
        : link));
      return;
    }

    setLinks((current) => current.map((link) => link.id === dragging.id
      ? { ...link, xPercent: point.x, yPercent: point.y }
      : link));

    const form = new FormData();
    form.set("linkId", dragging.id);
    form.set("placeId", context.placeId);
    form.set("xPercent", String(point.x));
    form.set("yPercent", String(point.y));
    const result = await moveOperationalInteractiveLinkAction(form);
    if (result?.ok) {
      setUndo({ kind: "move", id: dragging.id, x: dragging.oldX, y: dragging.oldY });
      setMessage("Plusset er flyttet.");
      return;
    }

    setLinks((current) => current.map((link) => link.id === dragging.id
      ? { ...link, xPercent: dragging.oldX, yPercent: dragging.oldY }
      : link));
    setMessage(result?.error || "Placeringen kunne ikke gemmes.");
  }

  function cancelDrag(event: React.PointerEvent<HTMLButtonElement>) {
    if (interaction.kind !== "dragging") return;
    event.preventDefault();
    event.stopPropagation();
    const dragging = interaction;
    setLinks((current) => current.map((link) => link.id === dragging.id
      ? { ...link, xPercent: dragging.oldX, yPercent: dragging.oldY }
      : link));
    setInteraction({ kind: "editing", id: dragging.id });
  }

  async function undoLastAction() {
    if (!undo) return;
    if (undo.kind === "delete") {
      const form = new FormData();
      form.set("linkId", undo.id);
      form.set("placeId", context.placeId);
      const result = await restoreOperationalInteractiveLinkAction(form);
      if (!result?.ok) {
        setMessage(result?.error || "Sletningen kunne ikke fortrydes.");
        return;
      }
      reload();
      return;
    }

    const form = new FormData();
    form.set("linkId", undo.id);
    form.set("placeId", context.placeId);
    form.set("xPercent", String(undo.x));
    form.set("yPercent", String(undo.y));
    const result = await moveOperationalInteractiveLinkAction(form);
    if (!result?.ok) {
      setMessage(result?.error || "Flytningen kunne ikke fortrydes.");
      return;
    }
    setLinks((current) => current.map((link) => link.id === undo.id
      ? { ...link, xPercent: undo.x, yPercent: undo.y }
      : link));
    setUndo(null);
    setMessage("Flytningen er fortrudt.");
  }

  function targetChanged(type: "item" | "node" | "new-node") {
    setTargetType(type);
    if (type === "node") setTargetId(context.children[0]?.id ?? "");
    if (type === "item") setTargetId(context.items[0]?.id ?? "");
    if (type === "new-node") setTargetId("");
  }

  function editTargetChanged(type: "item" | "node") {
    setEditTarget({
      type,
      id: type === "node" ? context.children[0]?.id ?? "" : context.items[0]?.id ?? ""
    });
  }

  async function createLink() {
    if (interaction.kind !== "creating" || busy) return;
    const point = interaction.point;
    setBusy(true);
    setMessage("");
    const form = new FormData();
    form.set("placeId", context.placeId);
    form.set("sourceNodeId", context.nodeId ?? "");
    form.set("targetType", targetType);
    form.set("targetId", targetId);
    form.set("newNodeName", newNodeName);
    form.set("label", "");
    form.set("xPercent", String(point.x));
    form.set("yPercent", String(point.y));
    form.set("sizePx", String(sizePx));
    form.set("sortOrder", String(links.length));
    const result = await createOperationalInteractiveLinkAction(form);
    if (!result?.ok) {
      setBusy(false);
      setMessage(result?.error || "Plusset kunne ikke oprettes.");
      return;
    }
    setMessage("Plusset er oprettet.");
    reload();
  }

  async function saveLink(link: OperationalInteractiveLink, formElement: HTMLFormElement) {
    if (!editTarget.id || busy) {
      setMessage("Vælg hvad plusset skal åbne.");
      return;
    }
    setBusy(true);
    const form = new FormData(formElement);
    form.set("linkId", link.id);
    form.set("placeId", context.placeId);
    form.set("targetType", editTarget.type);
    form.set("targetId", editTarget.id);
    form.set("xPercent", String(link.xPercent));
    form.set("yPercent", String(link.yPercent));
    const result = await updateOperationalInteractiveLinkAction(form);
    setBusy(false);
    if (!result?.ok) {
      setMessage(result?.error || "Plusset kunne ikke gemmes.");
      return;
    }
    setMessage("Plusset er gemt.");
    reload();
  }

  async function deleteLink(linkId: string) {
    if (busy) return;
    setBusy(true);
    const form = new FormData();
    form.set("linkId", linkId);
    form.set("placeId", context.placeId);
    const result = await deleteOperationalInteractiveLinkAction(form);
    setBusy(false);
    if (!result?.ok) {
      setMessage(result?.error || "Plusset kunne ikke slettes.");
      return;
    }
    setLinks((current) => current.filter((link) => link.id !== linkId));
    setInteraction({ kind: "idle" });
    setUndo({ kind: "delete", id: linkId });
    setMessage("Plusset er fjernet.");
  }

  async function saveExistingImage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    const result = await setOperationalInteractiveContextImageAction(new FormData(event.currentTarget));
    setBusy(false);
    if (!result?.ok) {
      setMessage(result?.error || "Billedet kunne ikke vælges.");
      return;
    }
    reload();
  }

  async function saveNode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    const result = await updateOperationalInteractiveNodeAction(new FormData(event.currentTarget));
    setBusy(false);
    if (!result?.ok) {
      setMessage(result?.error || "Underområdet kunne ikke gemmes.");
      return;
    }
    reload();
  }

  async function cloneNode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    const result = await cloneOperationalInteractiveNodeAction(new FormData(event.currentTarget));
    setBusy(false);
    if (!result?.ok) {
      setMessage(result?.error || "Underområdet kunne ikke klones.");
      return;
    }
    window.location.assign(`${builderBase}?node=${result.id}`);
  }

  async function createChildNode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    const result = await createOperationalInteractiveNodeAction(new FormData(event.currentTarget));
    setBusy(false);
    if (!result?.ok) {
      setMessage(result?.error || "Underområdet kunne ikke oprettes.");
      return;
    }
    window.location.assign(`${builderBase}?node=${result.id}`);
  }

  return (
    <div className="grid gap-5">
      <section className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-red-400">Interaktiv editor</p>
            <h1 className="mt-1 text-2xl font-black text-white">{currentName}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-1 text-xs font-bold text-slate-500">
              <Link className="text-red-400 hover:text-red-300" href={builderBase}>{context.placeName}</Link>
              {context.breadcrumbs.map((crumb) => (
                <span className="contents" key={crumb.id}>
                  <AppIcon className="size-3 text-slate-600" name="chevronRight" />
                  <Link className="text-red-400 hover:text-red-300" href={`${builderBase}?node=${crumb.id}`}>{crumb.name}</Link>
                </span>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-black text-white" href={`${interactiveBase}${context.nodeId ? `?node=${context.nodeId}` : ""}`}>
              <AppIcon className="size-4" name="activity" /> Se som brandmand
            </Link>
            {context.nodeId ? (
              <Link className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-black text-white" href={context.parentNodeId ? `${builderBase}?node=${context.parentNodeId}` : builderBase}>
                <AppIcon className="size-4" name="back" /> Et niveau op
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      {message ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/5 p-3 text-xs font-bold text-slate-300" role="status">
          <span>{message}</span>
          {undo ? <button className="rounded-lg bg-white px-3 py-2 font-black text-black" onClick={() => void undoLastAction()} type="button">Fortryd</button> : null}
        </div>
      ) : null}

      {context.nodeId ? (
        <section className="rounded-xl border border-white/10 bg-[#0d1317] p-4">
          <div className="mb-3">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-red-400">Dette underområde</p>
            <h2 className="mt-1 text-lg font-black text-white">Navn og beskrivelse</h2>
          </div>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto]">
            <form className="grid gap-3 sm:grid-cols-2" onSubmit={(event) => void saveNode(event)}>
              <input name="placeId" type="hidden" value={context.placeId} />
              <input name="nodeId" type="hidden" value={context.nodeId} />
              <label className="grid gap-1.5 text-xs font-black text-slate-300">Navn<input className="dark-input" defaultValue={context.nodeName ?? ""} name="name" required /></label>
              <label className="grid gap-1.5 text-xs font-black text-slate-300">Rækkefølge<input className="dark-input" defaultValue={context.nodeSortOrder} min="0" name="sortOrder" type="number" /></label>
              <label className="grid gap-1.5 text-xs font-black text-slate-300 sm:col-span-2">Beskrivelse<textarea className="dark-input min-h-20 p-3" defaultValue={context.nodeDescription} name="description" /></label>
              <button className="app-button-primary sm:col-span-2" disabled={busy} type="submit">Gem underområde</button>
            </form>
            <form className="self-end" onSubmit={(event) => void cloneNode(event)}>
              <input name="placeId" type="hidden" value={context.placeId} />
              <input name="nodeId" type="hidden" value={context.nodeId} />
              <button className="min-h-11 rounded-lg border border-white/10 bg-white/5 px-4 text-xs font-black text-white hover:bg-white/10 disabled:opacity-40" disabled={busy} type="submit">Klon dette niveau</button>
            </form>
          </div>
        </section>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-2">
        <OperationalQuickImageCapture label={`Interaktivt billede · ${currentName}`} mode="context" nodeId={context.nodeId} placeId={context.placeId} vehicleId={context.vehicleId} />
        <div className="grid content-start gap-3 rounded-xl border border-white/10 bg-[#0d1317] p-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Eksisterende billede</p>
            <h2 className="mt-1 text-sm font-black text-white">Vælg billede til dette niveau</h2>
          </div>
          <form className="grid gap-3" onSubmit={(event) => void saveExistingImage(event)}>
            <input name="placeId" type="hidden" value={context.placeId} />
            <input name="nodeId" type="hidden" value={context.nodeId ?? ""} />
            <select className="dark-input" defaultValue={context.imageId ?? ""} name="imageId">
              <option value="">Intet interaktivt billede</option>
              {context.images.map((image) => <option key={image.id} value={image.id}>{image.title || image.originalName}</option>)}
            </select>
            <button className="app-button-primary" disabled={busy} type="submit">Brug valgt billede</button>
          </form>
          <p className="text-xs font-semibold leading-5 text-slate-500">
            {context.nodeId
              ? "Et underområde bruger kun det billede, du vælger her. Det arver ikke længere automatisk rummets billede."
              : `Billeder uploadet til ${context.placeName} kan genbruges på alle underområder.`}
          </p>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#080c0f] shadow-2xl">
        <div className="border-b border-white/10 bg-[#11171b] p-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-red-400">Pluspunkter</p>
              <p className="mt-1 text-xs font-semibold text-slate-400">
                {interaction.kind === "placing"
                  ? "Klik nu på billedet for at vælge placeringen."
                  : "Klik et eksisterende plus for at redigere det. Træk for at flytte."}
              </p>
            </div>
            <div className="flex gap-2">
              {interaction.kind === "placing" || interaction.kind === "creating" ? (
                <button className="min-h-10 rounded-lg border border-white/10 bg-white/5 px-3 text-xs font-black text-white" onClick={cancelInteraction} type="button">Annuller placering</button>
              ) : null}
              <button
                aria-pressed={interaction.kind === "placing"}
                className={`inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-xs font-black ${interaction.kind === "placing" ? "bg-emerald-600 text-white" : "bg-red-600 text-white hover:bg-red-700"}`}
                disabled={!context.imageId || busy}
                onClick={startPlacement}
                type="button"
              >
                <AppIcon className="size-4" name="edit" /> Placér nyt +
              </button>
            </div>
          </div>
        </div>

        {context.imageId ? (
          <div
            className={`relative touch-none overflow-hidden bg-black ${interaction.kind === "placing" ? "cursor-crosshair ring-2 ring-inset ring-emerald-400/70" : "cursor-default"}`}
            onPointerDown={chooseCanvasPosition}
            ref={canvasRef}
          >
            <img alt={currentName} className="pointer-events-none block w-full select-none" draggable={false} src={operationalImageUrl(context.imageId)} />
            {links.map((link) => (
              <button
                aria-label={`Redigér ${link.label || link.targetName}`}
                className={`absolute z-20 grid -translate-x-1/2 -translate-y-1/2 touch-none place-items-center rounded-full border-2 font-black leading-none text-white shadow-[0_5px_22px_rgba(0,0,0,.75)] ${selectedId === link.id ? "border-yellow-300 bg-red-500 ring-4 ring-yellow-300/30" : "border-white bg-red-600"}`}
                key={link.id}
                onClick={(event) => { event.preventDefault(); event.stopPropagation(); selectLink(link); }}
                onPointerCancel={cancelDrag}
                onPointerDown={(event) => beginDrag(event, link)}
                onPointerMove={drag}
                onPointerUp={finishDrag}
                style={{ left: `${link.xPercent}%`, top: `${link.yPercent}%`, width: link.sizePx, height: link.sizePx, fontSize: Math.max(18, Math.round(link.sizePx * 0.55)) }}
                title={`${link.label || link.targetName} · træk for at flytte`}
                type="button"
              >+</button>
            ))}
            {draft ? (
              <span className="pointer-events-none absolute z-10 grid -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-emerald-100 bg-emerald-600 font-black text-white shadow-xl" style={{ left: `${draft.x}%`, top: `${draft.y}%`, width: sizePx, height: sizePx, fontSize: Math.max(18, Math.round(sizePx * 0.55)) }}>+</span>
            ) : null}
          </div>
        ) : (
          <div className="grid min-h-64 place-items-center p-6 text-center text-sm font-semibold text-slate-500">Vælg eller upload et billede til dette niveau, før du placerer pluspunkter.</div>
        )}

        <div className="border-t border-white/10 bg-[#0d1317] p-4">
          {interaction.kind === "creating" ? (
            <div className="grid gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
              <div><p className="text-[10px] font-black uppercase tracking-[0.14em] text-emerald-400">Nyt plus</p><h3 className="text-sm font-black">Hvad skal plusset åbne?</h3></div>
              <div className="grid gap-2 sm:grid-cols-3">
                <button className={`rounded-lg border px-3 py-3 text-xs font-black ${targetType === "item" ? "border-red-400 bg-red-600 text-white" : "border-white/10 bg-white/5 text-slate-300"}`} disabled={!context.items.length} onClick={() => targetChanged("item")} type="button">Værktøj</button>
                <button className={`rounded-lg border px-3 py-3 text-xs font-black ${targetType === "node" ? "border-red-400 bg-red-600 text-white" : "border-white/10 bg-white/5 text-slate-300"}`} disabled={!context.children.length} onClick={() => targetChanged("node")} type="button">Eksisterende underområde</button>
                <button className={`rounded-lg border px-3 py-3 text-xs font-black ${targetType === "new-node" ? "border-red-400 bg-red-600 text-white" : "border-white/10 bg-white/5 text-slate-300"}`} onClick={() => targetChanged("new-node")} type="button">Nyt underområde</button>
              </div>
              {targetType === "item" ? <select className="dark-input" onChange={(event) => setTargetId(event.target.value)} value={targetId}>{context.items.map((item) => <option key={item.id} value={item.id}>{item.name}{item.quantity > 1 ? ` ×${item.quantity}` : ""}</option>)}</select> : null}
              {targetType === "node" ? <select className="dark-input" onChange={(event) => setTargetId(event.target.value)} value={targetId}>{context.children.map((node) => <option key={node.id} value={node.id}>{node.name}</option>)}</select> : null}
              {targetType === "new-node" ? <input className="dark-input" maxLength={120} onChange={(event) => setNewNodeName(event.target.value)} placeholder="Fx Øverste hylde eller Kasse 1" value={newNodeName} /> : null}
              <label className="grid gap-2 text-xs font-black text-slate-300">Plusstørrelse · {sizePx}px<input max="96" min="24" onChange={(event) => setSizePx(Number(event.target.value))} step="2" type="range" value={sizePx} /></label>
              <div className="flex flex-wrap gap-2">
                <button className="app-button-primary min-h-11 flex-1 disabled:opacity-40" disabled={busy || (targetType === "new-node" ? !newNodeName.trim() : !targetId)} onClick={() => void createLink()} type="button">{busy ? "Gemmer…" : "Opret plus"}</button>
                <button className="rounded-lg border border-white/10 px-4 text-xs font-black text-slate-300" onClick={cancelInteraction} type="button">Annuller</button>
              </div>
              {targetType === "new-node" ? <p className="text-[10px] font-semibold text-slate-500">Underområdet og pluspunktet gemmes samlet, så der ikke kan opstå et tomt underområde hvis plusset fejler.</p> : null}
            </div>
          ) : selected ? (
            <form className="grid gap-3 rounded-xl border border-yellow-300/20 bg-yellow-300/5 p-4" onSubmit={(event) => { event.preventDefault(); void saveLink(selected, event.currentTarget); }}>
              <div className="flex items-start justify-between gap-3">
                <div><p className="text-[10px] font-black uppercase tracking-[0.14em] text-yellow-300">Valgt plus</p><h3 className="text-sm font-black">{selected.targetName}</h3><p className="text-xs text-slate-500">Mål, label, størrelse og rækkefølge kan ændres her. Træk plusset på billedet for at flytte det.</p></div>
                <button className="rounded-lg border border-red-500/30 px-3 py-2 text-xs font-black text-red-400" disabled={busy} onClick={() => void deleteLink(selected.id)} type="button">Slet plus</button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1.5 text-xs font-black text-slate-300">Åbn type<select className="dark-input" onChange={(event) => editTargetChanged(event.target.value as "item" | "node")} value={editTarget.type}><option value="item">Værktøj</option><option disabled={!context.children.length} value="node">Underområde</option></select></label>
                <label className="grid gap-1.5 text-xs font-black text-slate-300">Åbner{editTarget.type === "node" ? <select className="dark-input" onChange={(event) => setEditTarget({ type: "node", id: event.target.value })} value={editTarget.id}>{context.children.map((node) => <option key={node.id} value={node.id}>{node.name}</option>)}</select> : <select className="dark-input" onChange={(event) => setEditTarget({ type: "item", id: event.target.value })} value={editTarget.id}>{context.items.map((item) => <option key={item.id} value={item.id}>{item.name}{item.quantity > 1 ? ` ×${item.quantity}` : ""}</option>)}</select>}</label>
              </div>
              <label className="grid gap-1.5 text-xs font-black text-slate-300">Label<input className="dark-input" defaultValue={selected.label} maxLength={100} name="label" placeholder={selected.targetName} /></label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1.5 text-xs font-black text-slate-300">Størrelse<input className="dark-input" defaultValue={selected.sizePx} max="96" min="24" name="sizePx" step="2" type="number" /></label>
                <label className="grid gap-1.5 text-xs font-black text-slate-300">Rækkefølge<input className="dark-input" defaultValue={selected.sortOrder} min="0" name="sortOrder" type="number" /></label>
              </div>
              <button className="app-button-primary" disabled={busy || !editTarget.id} type="submit">Gem pluspunkt</button>
            </form>
          ) : (
            <p className="text-center text-xs font-semibold text-slate-500">Editoren er i valgtilstand. Klik på et eksisterende plus for at redigere det, eller vælg “Placér nyt +”.</p>
          )}
        </div>
      </section>

      <section className="grid gap-3 rounded-xl border border-white/10 bg-[#0d1317] p-4">
        <div className="flex items-center justify-between gap-3">
          <div><p className="text-[10px] font-black uppercase tracking-[0.14em] text-red-400">Næste niveau</p><h2 className="text-lg font-black">Underområder i {currentName}</h2></div>
          <span className="rounded-full bg-white/5 px-2.5 py-1 text-xs font-black text-slate-400">{context.children.length}</span>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {context.children.map((node) => (
            <Link className="grid min-h-16 grid-cols-[minmax(0,1fr)_24px] items-center gap-2 rounded-lg border border-white/10 bg-[#11191e] p-3 hover:border-red-500/30" href={`${builderBase}?node=${node.id}`} key={node.id}>
              <span><strong className="block text-sm text-white">{node.name}</strong><small className="mt-1 block text-xs text-slate-500">{node.imageId ? "Billede valgt" : "Mangler eget billede"} · rækkefølge {node.sortOrder}</small></span>
              <AppIcon className="size-5 text-red-500" name="chevronRight" />
            </Link>
          ))}
          {context.children.length === 0 ? <p className="rounded-lg border border-dashed border-white/10 p-4 text-center text-xs font-semibold text-slate-500 sm:col-span-2">Ingen underområder på dette niveau endnu.</p> : null}
        </div>
        <form className="mt-2 grid gap-2 rounded-lg border border-dashed border-white/15 p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_110px_auto]" onSubmit={(event) => void createChildNode(event)}>
          <input name="placeId" type="hidden" value={context.placeId} />
          <input name="parentNodeId" type="hidden" value={context.nodeId ?? ""} />
          <input className="dark-input" maxLength={120} name="name" placeholder="Nyt underområde" required />
          <input className="dark-input" maxLength={500} name="description" placeholder="Kort beskrivelse" />
          <input aria-label="Rækkefølge" className="dark-input" defaultValue={context.children.length} min="0" name="sortOrder" type="number" />
          <button className="rounded-lg bg-white px-4 py-2 text-xs font-black text-black disabled:opacity-40" disabled={busy} type="submit">Opret og redigér</button>
        </form>
        <p className="text-[10px] font-semibold leading-4 text-slate-500">Opretter du et underområde her, åbnes det bagefter til redigering. Pluspunktet på det foregående niveau placerer du separat, når du er klar.</p>
      </section>
    </div>
  );
}
