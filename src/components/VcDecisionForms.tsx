"use client";

import { useActionState } from "react";
import {
  approveReturnByVcAction,
  approveTransferByVcAction,
  rejectReturnByVcAction,
  rejectTransferByVcAction
} from "@/lib/actions";
import { ActionMessage } from "./ActionMessage";
import { SubmitButton } from "./SubmitButton";

export function VcTransferDecisionForms({ transferId }: { transferId: string }) {
  const [approveState, approveAction] = useActionState(approveTransferByVcAction, {});
  const [rejectState, rejectAction] = useActionState(rejectTransferByVcAction, {});

  return (
    <div className="grid gap-4">
      <form action={approveAction} className="grid gap-3 rounded-md border border-brand-line p-4">
        <input name="transferId" type="hidden" value={transferId} />
        <CommentField label="Kommentar ved godkendelse" />
        <ActionMessage message={approveState.message} ok={approveState.ok} />
        <SubmitButton pendingText="Godkender...">Godkend vagtoverdragelse</SubmitButton>
      </form>
      <form action={rejectAction} className="grid gap-3 rounded-md border border-brand-line p-4">
        <input name="transferId" type="hidden" value={transferId} />
        <CommentField label="Begrundelse ved afvisning" required />
        <ActionMessage message={rejectState.message} ok={rejectState.ok} />
        <button
          className="focus-ring inline-flex min-h-12 w-full items-center justify-center rounded-md border border-brand-red px-5 text-base font-semibold text-brand-red sm:w-auto"
          type="submit"
        >
          Afvis vagtoverdragelse
        </button>
      </form>
    </div>
  );
}

export function VcReturnDecisionForms({ returnRequestId }: { returnRequestId: string }) {
  const [approveState, approveAction] = useActionState(approveReturnByVcAction, {});
  const [rejectState, rejectAction] = useActionState(rejectReturnByVcAction, {});

  return (
    <div className="grid gap-4">
      <form action={approveAction} className="grid gap-3 rounded-md border border-brand-line p-4">
        <input name="returnRequestId" type="hidden" value={returnRequestId} />
        <CommentField label="Kommentar ved godkendelse" />
        <ActionMessage message={approveState.message} ok={approveState.ok} />
        <SubmitButton pendingText="Godkender...">Godkend tilbagelevering</SubmitButton>
      </form>
      <form action={rejectAction} className="grid gap-3 rounded-md border border-brand-line p-4">
        <input name="returnRequestId" type="hidden" value={returnRequestId} />
        <CommentField label="Begrundelse ved afvisning" required />
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

function CommentField({ label, required = false }: { label: string; required?: boolean }) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-zinc-800">
      {label}
      <textarea
        className="focus-ring min-h-24 rounded-md border border-zinc-300 bg-white px-3 py-2 text-base"
        maxLength={500}
        name="comment"
        required={required}
      />
    </label>
  );
}
