"use client";

import { useActionState, useState } from "react";
import {
  acceptTransferAndRefreshAction,
  rejectTransferAndRefreshAction
} from "@/lib/transfer-response-actions";
import { ActionMessage } from "./ActionMessage";
import { SubmitButton } from "./SubmitButton";

export function TransferResponseForms({ transferId }: { transferId: string }) {
  const [showReject, setShowReject] = useState(false);
  const [acceptState, acceptAction] = useActionState(acceptTransferAndRefreshAction, {});
  const [rejectState, rejectAction] = useActionState(rejectTransferAndRefreshAction, {});

  return (
    <div className="grid gap-3">
      <form action={acceptAction} className="grid gap-3">
        <input name="transferId" type="hidden" value={transferId} />
        <ActionMessage message={acceptState.message} ok={acceptState.ok} />
        <SubmitButton pendingText="Accepterer...">Accepter vagtoverdragelse</SubmitButton>
      </form>

      {!showReject ? (
        <button
          className="app-button-danger w-full"
          onClick={() => setShowReject(true)}
          type="button"
        >
          Afvis
        </button>
      ) : (
        <form action={rejectAction} className="grid gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
          <input name="transferId" type="hidden" value={transferId} />
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-black text-red-950">Afvis vagtoverdragelse</h3>
            <button
              className="focus-ring rounded-lg px-3 py-2 text-sm font-bold text-zinc-700 hover:bg-white"
              onClick={() => setShowReject(false)}
              type="button"
            >
              Annuller
            </button>
          </div>
          <label className="grid gap-2 text-sm font-semibold text-zinc-800">
            Begrundelse <span className="font-normal text-zinc-600">(valgfri)</span>
            <textarea
              className="focus-ring min-h-24 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-base shadow-sm"
              maxLength={500}
              name="responseComment"
            />
          </label>
          <ActionMessage message={rejectState.message} ok={rejectState.ok} />
          <SubmitButton pendingText="Afviser...">Bekræft afvisning</SubmitButton>
        </form>
      )}
    </div>
  );
}
