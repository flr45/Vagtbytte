"use client";

import { useActionState } from "react";
import {
  acceptReturnRequestAction,
  createReturnRequestAction,
  rejectReturnRequestAction
} from "@/lib/actions";
import { ActionMessage } from "./ActionMessage";
import { SubmitButton } from "./SubmitButton";

export function ReturnRequestCreateForm({
  transferId,
  originalName
}: {
  transferId: string;
  originalName: string;
}) {
  const [state, action] = useActionState(createReturnRequestAction, {});

  return (
    <form action={action} className="grid gap-4 rounded-md border border-brand-line p-4">
      <input name="transferId" type="hidden" value={transferId} />
      <h2 className="text-xl font-bold">Opret tilbagelevering</h2>
      <p className="rounded-md bg-amber-50 p-3 text-sm font-semibold text-amber-950">
        Vagten tilbageleveres ikke, før {originalName} har accepteret, og vagtcentralen har godkendt.
      </p>
      <label className="grid gap-2 text-sm font-semibold text-zinc-800">
        Ønsket tidspunkt for tilbagelevering
        <input
          className="focus-ring min-h-12 rounded-md border border-zinc-300 bg-white px-3 text-base"
          name="requestedReturnAt"
          required
          type="datetime-local"
        />
      </label>
      <label className="grid gap-2 text-sm font-semibold text-zinc-800">
        Kommentar
        <textarea
          className="focus-ring min-h-24 rounded-md border border-zinc-300 bg-white px-3 py-2 text-base"
          maxLength={500}
          name="comment"
        />
      </label>
      <ActionMessage message={state.message} ok={state.ok} />
      <SubmitButton pendingText="Opretter...">Opret tilbagelevering</SubmitButton>
    </form>
  );
}

export function ReturnRequestResponseForms({ returnRequestId }: { returnRequestId: string }) {
  const [acceptState, acceptAction] = useActionState(acceptReturnRequestAction, {});
  const [rejectState, rejectAction] = useActionState(rejectReturnRequestAction, {});

  return (
    <div className="grid gap-4">
      <form action={acceptAction} className="grid gap-3">
        <input name="returnRequestId" type="hidden" value={returnRequestId} />
        <ActionMessage message={acceptState.message} ok={acceptState.ok} />
        <SubmitButton pendingText="Accepterer...">Accepter tilbagelevering</SubmitButton>
      </form>
      <form action={rejectAction} className="grid gap-3 rounded-md border border-brand-line p-4">
        <input name="returnRequestId" type="hidden" value={returnRequestId} />
        <label className="grid gap-2 text-sm font-semibold text-zinc-800">
          Kommentar ved afvisning
          <textarea
            className="focus-ring min-h-24 rounded-md border border-zinc-300 bg-white px-3 py-2 text-base"
            maxLength={500}
            name="responseComment"
          />
        </label>
        <ActionMessage message={rejectState.message} ok={rejectState.ok} />
        <button
          className="focus-ring inline-flex min-h-12 w-full items-center justify-center rounded-md border border-brand-red px-5 text-base font-semibold text-brand-red sm:w-auto"
          type="submit"
        >
          Afvis tilbagelevering
        </button>
      </form>
    </div>
  );
}
