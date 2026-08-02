"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
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
  confirmationText = "Vil du godkende denne vagtoverdragelse?"
}: {
  transferId: string;
  direct?: boolean;
  confirmationText?: string;
}) {
  const [showComment, setShowComment] = useState(false);
  const [showReject, setShowReject] = useState(false);
  const [approveState, approveAction] = useActionState(approveTransferByVcAction, {});
  const [rejectState, rejectAction] = useActionState(rejectTransferByVcAction, {});

  return (
    <div className="grid gap-3">
      <form
        action={approveAction}
        className="grid gap-3"
        onSubmit={(event) => {
          if (!window.confirm(confirmationText)) event.preventDefault();
        }}
      >
        <input name="transferId" type="hidden" value={transferId} />
        {showComment ? <CommentField label="Kommentar til godkendelse" /> : null}
        <ActionMessage message={approveState.message} ok={approveState.ok} />
        <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
          <SubmitButton pendingText="Godkender...">Godkend</SubmitButton>
          <button
            className="app-button-secondary w-full px-4 text-sm sm:w-auto"
            onClick={() => setShowComment((value) => !value)}
            type="button"
          >
            {showComment ? "Fjern kommentar" : "Tilføj kommentar"}
          </button>
        </div>
      </form>

      {!showReject ? (
        <button className="app-button-danger w-full" onClick={() => setShowReject(true)} type="button">
          Afvis
        </button>
      ) : (
        <form
          action={rejectAction}
          className="grid gap-3 rounded-xl border border-red-200 bg-red-50 p-4"
          onSubmit={(event) => {
            if (!window.confirm("Vil du afvise denne vagtoverdragelse?")) event.preventDefault();
          }}
        >
          <input name="transferId" type="hidden" value={transferId} />
          <div className="flex items-center justify-between gap-3">
            <h4 className="font-black text-red-950">Afvis vagtoverdragelse</h4>
            <button
              className="focus-ring rounded-lg px-3 py-2 text-sm font-bold text-zinc-700 hover:bg-white"
              onClick={() => setShowReject(false)}
              type="button"
            >
              Annuller
            </button>
          </div>
          <CommentField label="Begrundelse" required />
          <ActionMessage message={rejectState.message} ok={rejectState.ok} />
          <DangerSubmitButton pendingText="Afviser...">Bekræft afvisning</DangerSubmitButton>
        </form>
      )}
    </div>
  );
}

export function VcReturnDecisionForms({
  returnRequestId,
  confirmationText = "Vil du godkende denne tilbagelevering?"
}: {
  returnRequestId: string;
  direct?: boolean;
  confirmationText?: string;
}) {
  const [showComment, setShowComment] = useState(false);
  const [showReject, setShowReject] = useState(false);
  const [approveState, approveAction] = useActionState(approveReturnByVcAction, {});
  const [rejectState, rejectAction] = useActionState(rejectReturnByVcAction, {});

  return (
    <div className="grid gap-3">
      <form
        action={approveAction}
        className="grid gap-3"
        onSubmit={(event) => {
          if (!window.confirm(confirmationText)) event.preventDefault();
        }}
      >
        <input name="returnRequestId" type="hidden" value={returnRequestId} />
        {showComment ? <CommentField label="Kommentar til godkendelse" /> : null}
        <ActionMessage message={approveState.message} ok={approveState.ok} />
        <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
          <SubmitButton pendingText="Godkender...">Godkend</SubmitButton>
          <button
            className="app-button-secondary w-full px-4 text-sm sm:w-auto"
            onClick={() => setShowComment((value) => !value)}
            type="button"
          >
            {showComment ? "Fjern kommentar" : "Tilføj kommentar"}
          </button>
        </div>
      </form>

      {!showReject ? (
        <button className="app-button-danger w-full" onClick={() => setShowReject(true)} type="button">
          Afvis
        </button>
      ) : (
        <form
          action={rejectAction}
          className="grid gap-3 rounded-xl border border-red-200 bg-red-50 p-4"
          onSubmit={(event) => {
            if (!window.confirm("Vil du afvise denne tilbagelevering?")) event.preventDefault();
          }}
        >
          <input name="returnRequestId" type="hidden" value={returnRequestId} />
          <div className="flex items-center justify-between gap-3">
            <h4 className="font-black text-red-950">Afvis tilbagelevering</h4>
            <button
              className="focus-ring rounded-lg px-3 py-2 text-sm font-bold text-zinc-700 hover:bg-white"
              onClick={() => setShowReject(false)}
              type="button"
            >
              Annuller
            </button>
          </div>
          <CommentField label="Begrundelse" required />
          <ActionMessage message={rejectState.message} ok={rejectState.ok} />
          <DangerSubmitButton pendingText="Afviser...">Bekræft afvisning</DangerSubmitButton>
        </form>
      )}
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
      className="grid gap-3"
      onSubmit={(event) => {
        if (!window.confirm(confirmationText)) event.preventDefault();
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
      className="grid gap-3"
      onSubmit={(event) => {
        if (!window.confirm(confirmationText)) event.preventDefault();
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
      className="grid gap-3"
      onSubmit={(event) => {
        if (!window.confirm(confirmationText)) event.preventDefault();
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
        className="focus-ring min-h-20 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-base shadow-sm"
        maxLength={500}
        name="comment"
        required={required}
      />
    </label>
  );
}

function DangerSubmitButton({ children, pendingText }: { children: React.ReactNode; pendingText: string }) {
  const { pending } = useFormStatus();
  return (
    <button className="app-button-danger w-full" disabled={pending} type="submit">
      {pending ? pendingText : children}
    </button>
  );
}
