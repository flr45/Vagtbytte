"use client";

import { useActionState } from "react";
import {
  approveReturnByVcAction,
  approveTransferByVcAction,
  confirmExpectedReturnExecutionAction,
  confirmReturnExecutionAction,
  confirmTransferActivationAction,
  rejectReturnByVcAction,
  rejectTransferByVcAction
} from "@/lib/actions";
import { ActionMessage } from "./ActionMessage";
import { SubmitButton } from "./SubmitButton";

export function VcTransferDecisionForms({
  transferId,
  direct = false,
  confirmationText = "Vil du godkende denne vagtoverdragelse?"
}: {
  transferId: string;
  direct?: boolean;
  confirmationText?: string;
}) {
  const [approveState, approveAction] = useActionState(approveTransferByVcAction, {});
  const [rejectState, rejectAction] = useActionState(rejectTransferByVcAction, {});

  return (
    <div className={direct ? "grid gap-3 lg:grid-cols-2" : "grid gap-4"}>
      <form
        action={approveAction}
        className="grid gap-3 rounded-md border border-emerald-200 bg-emerald-50 p-4"
        onSubmit={(event) => {
          if (!window.confirm(confirmationText)) {
            event.preventDefault();
          }
        }}
      >
        <input name="transferId" type="hidden" value={transferId} />
        <CommentField label="Kommentar ved godkendelse" />
        <ActionMessage message={approveState.message} ok={approveState.ok} />
        <SubmitButton pendingText="Godkender...">Godkend vagtoverdragelse</SubmitButton>
      </form>
      <form
        action={rejectAction}
        className="grid gap-3 rounded-md border border-zinc-300 bg-white p-4"
        onSubmit={(event) => {
          if (!window.confirm("Vil du afvise denne vagtoverdragelse?")) {
            event.preventDefault();
          }
        }}
      >
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

export function VcReturnDecisionForms({
  returnRequestId,
  direct = false,
  confirmationText = "Vil du godkende denne tilbagelevering?"
}: {
  returnRequestId: string;
  direct?: boolean;
  confirmationText?: string;
}) {
  const [approveState, approveAction] = useActionState(approveReturnByVcAction, {});
  const [rejectState, rejectAction] = useActionState(rejectReturnByVcAction, {});

  return (
    <div className={direct ? "grid gap-3 lg:grid-cols-2" : "grid gap-4"}>
      <form
        action={approveAction}
        className="grid gap-3 rounded-md border border-emerald-200 bg-emerald-50 p-4"
        onSubmit={(event) => {
          if (!window.confirm(confirmationText)) {
            event.preventDefault();
          }
        }}
      >
        <input name="returnRequestId" type="hidden" value={returnRequestId} />
        <CommentField label="Kommentar ved godkendelse" />
        <ActionMessage message={approveState.message} ok={approveState.ok} />
        <SubmitButton pendingText="Godkender...">Godkend tilbagelevering</SubmitButton>
      </form>
      <form
        action={rejectAction}
        className="grid gap-3 rounded-md border border-zinc-300 bg-white p-4"
        onSubmit={(event) => {
          if (!window.confirm("Vil du afvise denne tilbagelevering?")) {
            event.preventDefault();
          }
        }}
      >
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

export function VcTransferActivationForm({
  transferId,
  confirmationText
}: {
  transferId: string;
  confirmationText: string;
}) {
  const [state, action] = useActionState(confirmTransferActivationAction, {});

  return (
    <form
      action={action}
      className="grid gap-3 rounded-md border border-emerald-200 bg-emerald-50 p-4"
      onSubmit={(event) => {
        if (!window.confirm(confirmationText)) {
          event.preventDefault();
        }
      }}
    >
      <input name="transferId" type="hidden" value={transferId} />
      <ActionMessage message={state.message} ok={state.ok} />
      <SubmitButton pendingText="Bekræfter...">Bekræft vagtskifte udført</SubmitButton>
    </form>
  );
}

export function VcReturnExecutionForm({
  returnRequestId,
  confirmationText
}: {
  returnRequestId: string;
  confirmationText: string;
}) {
  const [state, action] = useActionState(confirmReturnExecutionAction, {});

  return (
    <form
      action={action}
      className="grid gap-3 rounded-md border border-emerald-200 bg-emerald-50 p-4"
      onSubmit={(event) => {
        if (!window.confirm(confirmationText)) {
          event.preventDefault();
        }
      }}
    >
      <input name="returnRequestId" type="hidden" value={returnRequestId} />
      <ActionMessage message={state.message} ok={state.ok} />
      <SubmitButton pendingText="Bekræfter...">Bekræft tilbagelevering udført</SubmitButton>
    </form>
  );
}

export function VcExpectedReturnExecutionForm({
  transferId,
  confirmationText
}: {
  transferId: string;
  confirmationText: string;
}) {
  const [state, action] = useActionState(confirmExpectedReturnExecutionAction, {});

  return (
    <form
      action={action}
      className="grid gap-3 rounded-md border border-emerald-200 bg-emerald-50 p-4"
      onSubmit={(event) => {
        if (!window.confirm(confirmationText)) {
          event.preventDefault();
        }
      }}
    >
      <input name="transferId" type="hidden" value={transferId} />
      <ActionMessage message={state.message} ok={state.ok} />
      <SubmitButton pendingText="Bekræfter...">Bekræft tilbagelevering udført</SubmitButton>
    </form>
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
