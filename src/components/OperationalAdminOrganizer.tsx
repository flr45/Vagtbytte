"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  cloneOperationalItemAction,
  cloneOperationalRoomAction,
  moveOperationalItemsAction,
  saveOperationalItemOrderAction,
  saveOperationalRoomOrderAction
} from "@/lib/operativ-admin-actions";
import type { OperationalAdminRoom } from "@/lib/operativ-admin";

type Props = {
  vehicleId: string;
  vehicleName: string;
  initialRooms: OperationalAdminRoom[];
};

export function OperationalAdminOrganizer({ vehicleId, vehicleName, initialRooms }: Props) {
  const router = useRouter();
  const [rooms, setRooms] = useState(initialRooms);
  const [roomOrderDirty, setRoomOrderDirty] = useState(false);
  const [status, setStatus] = useState("");
  const [pending, startTransition] = useTransition();

  function reorderRoom(fromId: string, toId: string) {
    setRooms((current) => moveBefore(current, fromId, toId));
    setRoomOrderDirty(true);
  }

  function nudgeRoom(id: string, delta: number) {
    setRooms((current) => nudge(current, id, delta));
    setRoomOrderDirty(true);
  }

  function saveRooms() {
    startTransition(async () => {
      setStatus("Gemmer rumrækkefølge…");
      const result = await saveOperationalRoomOrderAction(vehicleId, rooms.map((room) => room.id));
      if (!result.ok) {
        setStatus(result.error ?? "Rækkefølgen kunne ikke gemmes.");
        return;
      }
      setRoomOrderDirty(false);
      setStatus("Rumrækkefølge gemt ✓");
      router.refresh();
    });
  }

  function cloneRoom(roomId: string) {
    const room = rooms.find((entry) => entry.id === roomId);
    if (!room) return;
    if (!window.confirm(`Kopiér ${room.name} og alle ${room.items.length} udstyrsposter? Billeder og hotspots kopieres ikke.`)) return;
    startTransition(async () => {
      setStatus(`Kopierer ${room.name}…`);
      const result = await cloneOperationalRoomAction(roomId, true);
      if (!result.ok) {
        setStatus(result.error ?? "Rummet kunne ikke kopieres.");
        return;
      }
      setStatus("Rummet blev kopieret ✓");
      router.refresh();
    });
  }

  return (
    <div className="grid gap-5">
      <section className="rounded-xl border border-white/10 bg-[#0d1317] p-4 shadow-lg">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-red-500">v0.11 · Organisér</p>
            <h2 className="mt-1 text-xl font-black">Rum på {vehicleName}</h2>
            <p className="mt-1 max-w-2xl text-xs font-semibold leading-5 text-slate-500">Træk med håndtaget på computer, eller brug pilene på mobil. Ændringer træder først i kraft, når du trykker Gem rækkefølge.</p>
          </div>
          <button className="app-button-primary disabled:opacity-40" disabled={!roomOrderDirty || pending} onClick={saveRooms} type="button">Gem rumrækkefølge</button>
        </div>

        <div className="mt-4 grid gap-2">
          {rooms.map((room, index) => (
            <div
              className="grid grid-cols-[36px_minmax(0,1fr)_auto] items-center gap-2 rounded-lg border border-white/10 bg-[#11191e] p-2"
              draggable
              key={room.id}
              onDragOver={(event) => event.preventDefault()}
              onDragStart={(event) => event.dataTransfer.setData("text/plain", room.id)}
              onDrop={(event) => {
                event.preventDefault();
                const fromId = event.dataTransfer.getData("text/plain");
                if (fromId && fromId !== room.id) reorderRoom(fromId, room.id);
              }}
            >
              <span aria-label="Træk for at sortere" className="grid size-9 cursor-grab place-items-center rounded bg-white/5 text-lg text-slate-500" title="Træk for at sortere">≡</span>
              <div className="min-w-0">
                <strong className="block truncate text-sm">{room.name}</strong>
                <small className="text-[10px] font-bold text-slate-500">{room.items.length} udstyrsposter · placering {index + 1}</small>
              </div>
              <div className="flex items-center gap-1">
                <button aria-label="Flyt rum op" className="grid size-9 place-items-center rounded border border-white/10 text-sm disabled:opacity-25" disabled={index === 0 || pending} onClick={() => nudgeRoom(room.id, -1)} type="button">↑</button>
                <button aria-label="Flyt rum ned" className="grid size-9 place-items-center rounded border border-white/10 text-sm disabled:opacity-25" disabled={index === rooms.length - 1 || pending} onClick={() => nudgeRoom(room.id, 1)} type="button">↓</button>
                <button className="rounded border border-white/10 px-2 py-2 text-[10px] font-black text-slate-300 disabled:opacity-40" disabled={pending} onClick={() => cloneRoom(room.id)} type="button">Kopiér</button>
                <Link className="rounded border border-red-500/30 px-2 py-2 text-[10px] font-black text-red-400" href={`/admin/operativ-portal/rum/${room.id}`}>Åbn</Link>
              </div>
            </div>
          ))}
          {rooms.length === 0 ? <p className="rounded-lg border border-dashed border-white/15 p-5 text-center text-sm text-slate-500">Køretøjet har ingen rum endnu.</p> : null}
        </div>
      </section>

      {rooms.map((room) => (
        <RoomItemsManager
          key={`${room.id}-${room.items.map((item) => item.id).join("-")}`}
          onStatus={setStatus}
          pending={pending}
          room={room}
          rooms={rooms}
          startTransition={startTransition}
        />
      ))}

      {status ? <div className="sticky bottom-20 z-30 rounded-xl border border-white/10 bg-[#151b1f]/95 px-4 py-3 text-center text-xs font-black text-slate-200 shadow-2xl backdrop-blur md:bottom-4">{status}</div> : null}
    </div>
  );
}

function RoomItemsManager({
  room,
  rooms,
  pending,
  startTransition,
  onStatus
}: {
  room: OperationalAdminRoom;
  rooms: OperationalAdminRoom[];
  pending: boolean;
  startTransition: (callback: () => void | Promise<void>) => void;
  onStatus: (status: string) => void;
}) {
  const router = useRouter();
  const [items, setItems] = useState(room.items);
  const [dirty, setDirty] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [targetRoomId, setTargetRoomId] = useState(rooms.find((entry) => entry.id !== room.id)?.id ?? "");
  const selected = useMemo(() => new Set(selectedIds), [selectedIds]);

  function reorder(fromId: string, toId: string) {
    setItems((current) => moveBefore(current, fromId, toId));
    setDirty(true);
  }

  function nudgeItem(id: string, delta: number) {
    setItems((current) => nudge(current, id, delta));
    setDirty(true);
  }

  function saveOrder() {
    startTransition(async () => {
      onStatus(`Gemmer rækkefølge i ${room.name}…`);
      const result = await saveOperationalItemOrderAction(room.id, items.map((item) => item.id));
      if (!result.ok) {
        onStatus(result.error ?? "Rækkefølgen kunne ikke gemmes.");
        return;
      }
      setDirty(false);
      onStatus(`${room.name}: rækkefølge gemt ✓`);
      router.refresh();
    });
  }

  function moveSelected() {
    if (!selectedIds.length || !targetRoomId) return;
    const targetName = rooms.find((entry) => entry.id === targetRoomId)?.name ?? "det valgte rum";
    if (!window.confirm(`Flyt ${selectedIds.length} valgte udstyrsposter til ${targetName}? Eventuelle interaktive plusser på de flyttede poster fjernes fra det gamle rum.`)) return;
    startTransition(async () => {
      onStatus(`Flytter ${selectedIds.length} udstyrsposter…`);
      const result = await moveOperationalItemsAction(selectedIds, targetRoomId);
      if (!result.ok) {
        onStatus(result.error ?? "Udstyret kunne ikke flyttes.");
        return;
      }
      setSelectedIds([]);
      onStatus(`${selectedIds.length} udstyrsposter flyttet ✓`);
      router.refresh();
    });
  }

  function cloneItem(itemId: string, itemName: string) {
    startTransition(async () => {
      onStatus(`Kopierer ${itemName}…`);
      const result = await cloneOperationalItemAction(itemId);
      if (!result.ok) {
        onStatus(result.error ?? "Udstyret kunne ikke kopieres.");
        return;
      }
      onStatus(`${itemName} blev kopieret ✓`);
      router.refresh();
    });
  }

  return (
    <details className="overflow-hidden rounded-xl border border-white/10 bg-[#0d1317]" open={rooms.length <= 4}>
      <summary className="cursor-pointer list-none border-b border-white/10 bg-[#151b1f] px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <span><strong className="block text-sm">{room.name}</strong><small className="text-[10px] font-bold text-slate-500">{items.length} poster</small></span>
          <span className="text-xl text-slate-500">⌄</span>
        </div>
      </summary>

      <div className="p-3">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold text-slate-500">Sortér med træk eller ↑/↓. Markér flere poster for at flytte dem samlet.</p>
          <button className="rounded-lg bg-red-600 px-3 py-2 text-xs font-black text-white disabled:opacity-35" disabled={!dirty || pending} onClick={saveOrder} type="button">Gem rækkefølge</button>
        </div>

        <div className="grid gap-1.5">
          {items.map((item, index) => (
            <div
              className="grid grid-cols-[28px_32px_minmax(0,1fr)_auto] items-center gap-2 rounded-lg border border-white/5 bg-[#11191e] p-2"
              draggable
              key={item.id}
              onDragOver={(event) => event.preventDefault()}
              onDragStart={(event) => event.dataTransfer.setData("text/plain", item.id)}
              onDrop={(event) => {
                event.preventDefault();
                const fromId = event.dataTransfer.getData("text/plain");
                if (fromId && fromId !== item.id) reorder(fromId, item.id);
              }}
            >
              <input
                aria-label={`Vælg ${item.name}`}
                checked={selected.has(item.id)}
                className="size-5 accent-red-600"
                onChange={(event) => setSelectedIds((current) => event.target.checked ? [...current, item.id] : current.filter((id) => id !== item.id))}
                type="checkbox"
              />
              <span className="grid size-8 cursor-grab place-items-center rounded bg-white/5 text-slate-500">≡</span>
              <div className="min-w-0">
                <strong className="block truncate text-xs">{item.name}</strong>
                <small className="block truncate text-[10px] text-slate-500">×{item.quantity}{item.note ? ` · ${item.note}` : ""}</small>
              </div>
              <div className="flex items-center gap-1">
                <button aria-label="Flyt udstyr op" className="grid size-8 place-items-center rounded border border-white/10 text-xs disabled:opacity-25" disabled={index === 0 || pending} onClick={() => nudgeItem(item.id, -1)} type="button">↑</button>
                <button aria-label="Flyt udstyr ned" className="grid size-8 place-items-center rounded border border-white/10 text-xs disabled:opacity-25" disabled={index === items.length - 1 || pending} onClick={() => nudgeItem(item.id, 1)} type="button">↓</button>
                <button className="rounded border border-white/10 px-2 py-1.5 text-[9px] font-black text-slate-300 disabled:opacity-40" disabled={pending} onClick={() => cloneItem(item.id, item.name)} type="button">Kopi</button>
                <Link className="rounded border border-red-500/30 px-2 py-1.5 text-[9px] font-black text-red-400" href={`/admin/operativ-portal/udstyr/${item.id}`}>Åbn</Link>
              </div>
            </div>
          ))}
          {items.length === 0 ? <p className="rounded-lg border border-dashed border-white/10 p-4 text-center text-xs text-slate-500">Ingen udstyrsposter.</p> : null}
        </div>

        {selectedIds.length > 0 ? (
          <div className="mt-3 grid gap-2 rounded-lg border border-red-500/20 bg-red-500/5 p-3 sm:grid-cols-[1fr_auto] sm:items-end">
            <label className="grid gap-1 text-[10px] font-black text-slate-400">Flyt {selectedIds.length} valgte til
              <select className="dark-input" onChange={(event) => setTargetRoomId(event.target.value)} value={targetRoomId}>
                <option value="">Vælg rum</option>
                {rooms.filter((entry) => entry.id !== room.id).map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
              </select>
            </label>
            <button className="app-button-primary disabled:opacity-40" disabled={!targetRoomId || pending} onClick={moveSelected} type="button">Flyt valgte</button>
          </div>
        ) : null}
      </div>
    </details>
  );
}

function moveBefore<T extends { id: string }>(values: T[], fromId: string, toId: string) {
  const fromIndex = values.findIndex((value) => value.id === fromId);
  const toIndex = values.findIndex((value) => value.id === toId);
  if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return values;
  const next = [...values];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

function nudge<T extends { id: string }>(values: T[], id: string, delta: number) {
  const index = values.findIndex((value) => value.id === id);
  const target = index + delta;
  if (index < 0 || target < 0 || target >= values.length) return values;
  const next = [...values];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}
