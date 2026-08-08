"use client";

import { useState, type PointerEvent } from "react";
import type { OperationalInteractiveContext } from "@/lib/operativ-content-builder";
import { OperationalContentBuilder } from "./OperationalContentBuilder";
import { AppIcon } from "./AppIcon";

export function OperationalContentBuilderGuard({ context }: { context: OperationalInteractiveContext }) {
  const [placing, setPlacing] = useState(false);

  function guardBlankCanvas(event: PointerEvent<HTMLDivElement>) {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (!target.classList.contains("cursor-crosshair")) return;

    if (!placing) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    // One deliberate blank-canvas click is enough to start the existing
    // "Nyt plus" flow. The builder reloads after a successful create.
    setPlacing(false);
  }

  return (
    <div className="grid gap-4" onPointerDownCapture={guardBlankCanvas}>
      <section className="rounded-xl border border-white/10 bg-[#0d1317] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-red-400">Redigering</p>
            <h2 className="mt-1 text-base font-black text-white">Redigér eksisterende plus eller placér et nyt</h2>
            <p className="mt-1 max-w-2xl text-xs font-semibold leading-5 text-slate-400">
              Tryk direkte på et eksisterende plus for at redigere det. Klik på tom plads gør ingenting, medmindre du først aktiverer placering af et nyt plus.
            </p>
          </div>
          <button
            aria-pressed={placing}
            className={`inline-flex min-h-11 items-center gap-2 rounded-lg px-4 text-xs font-black transition ${placing ? "bg-emerald-600 text-white ring-2 ring-emerald-300/40" : "bg-red-600 text-white hover:bg-red-700"}`}
            onClick={() => setPlacing((current) => !current)}
            type="button"
          >
            <AppIcon className="size-4" name={placing ? "checkCircle" : "edit"} />
            {placing ? "Klik nu på billedet" : "Placér nyt +"}
          </button>
        </div>
        {placing ? (
          <p className="mt-3 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs font-bold text-emerald-200">
            Placering er aktiv. Klik én gang på den tomme plads på billedet, hvor det nye plus skal ligge.
          </p>
        ) : null}
      </section>

      <OperationalContentBuilder context={context} />
    </div>
  );
}
