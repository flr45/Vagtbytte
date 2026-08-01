"use client";

import { useActionState } from "react";
import {
  cancelAvailabilityAction,
  createAvailabilityAction
} from "@/lib/actions";
import {
  assignAvailabilityDirectlyByVcAction,
  removeAvailabilityAssignmentByVcAction
} from "@/lib/availability-vc-actions";
import { ActionMessage } from "./ActionMessage";
import { SubmitButton } from "./SubmitButton";

export function AvailabilityCreateForm({
  defaultFrom
}: {
  defaultFrom: string;
}) {
  const [state, action] = useActionState(createAvailabilityAction, {});

  return (
    <form action={action} className="app-card grid gap-4">
      <div>
        <h2 className="text-2xl font-black">Stil dig til rådighed</h2>
        <p className="mt-1 text-sm font-semibold text-zinc-600">Du er til rådighed frem til næste vagtskifte.</p>
      </div>
      <label className="grid gap-2 text-sm font-bold text-zinc-700">
        Fra tidspunkt
        <input
          className="focus-ring min-h-12 rounded-xl border border-zinc-200 px-4 text-base font-semibold"
          defaultValue={defaultFrom}
          name="availableFrom"
          type="datetime-local"
        />
      </label>
      <ActionMessage message={state.message} ok={state.ok} />
      <SubmitButton pendingText="Gemmer...">Stil dig til rådighed</SubmitButton>
    </form>
  );
}

export function AvailabilityActiveForm({
  availabilityId,
  from,
  until
}: {
  availabilityId: string;
  from: string;
  until: string;
}) {
  const [state, action] = useActionState(cancelAvailabilityAction, {});

  return (
    <form
      action={action}
      className="app-card grid gap-4 border-emerald-100 bg-emerald-50"
      onSubmit={(event) => {
        if (!window.confirm("Vil du annullere din tilgængelighed?")) {
          event.preventDefault();
        }
      }}
    >
      <input name="availabilityId" type="hidden" value={availabilityId} />
      <div>
        <h2 className="text-2xl font-black text-emerald-950">Tilkendegivet som til rådighed</h2>
        <p className="mt-2 text-lg font-bold text-emerald-950">{from} → {until}</p>
      </div>
      <ActionMessage message={state.message} ok={state.ok} />
      <button className="app-button-danger w-full" type="submit">
        Annuller
      </button>
    </form>
  );
}

export function VcAssignAvailabilityForm({
  availabilityId
}: {
  availabilityId: string;
}) {
  const [state, action] = useActionState(assignAvailabilityDirectlyByVcAction, {});

  return (
    <form
      action={action}
      className="grid gap-2"
      onSubmit={(event) => {
        if (!window.confirm("Er du sikker på, at du vil tildele denne vagt?")) {
          event.preventDefault();
        }
      }}
    >
      <input name="availabilityId" type="hidden" value={availabilityId} />
      <ActionMessage message={state.message} ok={state.ok} />
      <SubmitButton pendingText="Tildeler...">Tildel vagt</SubmitButton>
    </form>
  );
}

export function VcUnassignAvailabilityForm({
  availabilityId
}: {
  availabilityId: string;
}) {
  const [state, action] = useActionState(removeAvailabilityAssignmentByVcAction, {});

  return (
    <form
      action={action}
      className="mt-4 grid gap-2"
      onSubmit={(event) => {
        if (!window.confirm("Vil du fjerne denne vagttildeling igen?")) {
          event.preventDefault();
        }
      }}
    >
      <input name="availabilityId" type="hidden" value={availabilityId} />
      <ActionMessage message={state.message} ok={state.ok} />
      <button className="app-button-danger w-full sm:w-fit" type="submit">
        Fjern tildeling
      </button>
    </form>
  );
}
