"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import type { TransferStatus } from "@prisma/client";
import { cancelTransferAction } from "@/lib/actions";
import { ActionMessage } from "./ActionMessage";
import { XIcon } from "./Icons";

export function CancelTransferForm({
  transferId,
  status
}: {
  transferId: string;
  status: TransferStatus;
}) {
  const [state, action] = useActionState(cancelTransferAction, {});
  const [confirming, setConfirming] = useState(false);
  const requiresReason = status !== "AWAITING_RECEIVER";

  if (state.ok) {
    return (
      <section className="app-card grid gap-3 border-red-100 bg-red-50">
        <p className="font-bold text-red-950">Annulleret</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Link className="app-button-primary" href="/brandmand">
            Til forsiden
          </Link>
          <Link className="app-button-secondary" href="/brandmand/ny">
            Opret nyt vagtbytte
          </Link>
        </div>
      </section>
    );
  }

  return (
    <form
      action={action}
      className="app-card grid gap-3 border-red-100"
      onSubmit={(event) => {
        if (!confirming) {
          event.preventDefault();
          setConfirming(true);
        }
      }}
    >
      <input name="transferId" type="hidden" value={transferId} />
      <h2 className="flex items-center gap-2 text-xl font-bold text-red-950">
        <XIcon className="size-5" />
        Annuller
      </h2>
      {requiresReason ? (
        <p className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-950">
          Skriv kort hvorfor. B og VC får besked.
        </p>
      ) : (
        <p className="rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-950">
          Begrundelse er valgfri.
        </p>
      )}
      <label className="grid gap-2 text-sm font-semibold text-zinc-800">
        Begrundelse {requiresReason ? "" : "(valgfri)"}
        <textarea
          className="focus-ring min-h-24 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-base shadow-sm"
          maxLength={500}
          name="cancellationReason"
          required={requiresReason}
        />
      </label>
      <ActionMessage message={state.message} ok={state.ok} />
      {confirming ? (
        <div className="grid gap-3 rounded-xl border border-red-100 bg-red-50 p-3">
          <p className="font-bold text-red-950">Er du sikker?</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <CancelSubmitButton />
            <button className="app-button-secondary" onClick={() => setConfirming(false)} type="button">
              Nej
            </button>
          </div>
        </div>
      ) : (
        <button className="app-button-danger w-full sm:w-auto" type="submit">
          Annuller
        </button>
      )}
    </form>
  );
}

function CancelSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      className="app-button-danger w-full sm:w-auto"
      disabled={pending}
      type="submit"
    >
      {pending ? "Annullerer..." : "Ja"}
    </button>
  );
}
