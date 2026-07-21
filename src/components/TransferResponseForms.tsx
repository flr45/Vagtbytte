"use client";

import { useActionState } from "react";
import { acceptTransferAction, rejectTransferAction } from "@/lib/actions";
import { ActionMessage } from "./ActionMessage";
import { SubmitButton } from "./SubmitButton";

export function TransferResponseForms({ transferId }: { transferId: string }) {
  const [acceptState, acceptAction] = useActionState(acceptTransferAction, {});
  const [rejectState, rejectAction] = useActionState(rejectTransferAction, {});

  return (
    <div className="grid gap-4">
      <form action={acceptAction} className="grid gap-3">
        <input name="transferId" type="hidden" value={transferId} />
        <ActionMessage message={acceptState.message} ok={acceptState.ok} />
        <SubmitButton pendingText="Accepterer...">Accepter</SubmitButton>
      </form>
      <form action={rejectAction} className="grid gap-3 rounded-md border border-brand-line p-4">
        <input name="transferId" type="hidden" value={transferId} />
        <label className="grid gap-2 text-sm font-semibold text-zinc-800">
          Begrundelse ved afvisning
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
          Afvis
        </button>
      </form>
    </div>
  );
}
