"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { TransferStatus } from "@prisma/client";
import { cancelTransferAction } from "@/lib/actions";
import { ActionMessage } from "./ActionMessage";

export function CancelTransferForm({
  transferId,
  status
}: {
  transferId: string;
  status: TransferStatus;
}) {
  const [state, action] = useActionState(cancelTransferAction, {});
  const requiresReason = status !== "AWAITING_RECEIVER";

  if (state.ok) {
    return (
      <section className="grid gap-3 rounded-md border border-red-200 bg-red-50 p-4">
        <p className="font-bold text-red-950">Vagtoverdragelsen er annulleret</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Link
            className="focus-ring inline-flex min-h-12 items-center justify-center rounded-md bg-brand-red px-5 font-semibold text-white"
            href="/brandmand"
          >
            Til forsiden
          </Link>
          <Link
            className="focus-ring inline-flex min-h-12 items-center justify-center rounded-md border border-zinc-300 px-5 font-semibold"
            href="/brandmand/ny"
          >
            Opret nyt vagtbytte
          </Link>
        </div>
      </section>
    );
  }

  return (
    <form
      action={action}
      className="grid gap-3 rounded-md border border-red-300 p-4"
      onSubmit={(event) => {
        const message = requiresReason
          ? "Er du sikker på, at du vil annullere vagtoverdragelsen? Modtageren og eventuelt vagtcentralen får besked."
          : "Er du sikker på, at du vil annullere vagtoverdragelsen?";
        if (!window.confirm(message)) {
          event.preventDefault();
        }
      }}
    >
      <input name="transferId" type="hidden" value={transferId} />
      <h2 className="text-xl font-bold text-red-950">Annullér vagtoverdragelse</h2>
      {requiresReason ? (
        <p className="rounded-md bg-red-50 p-3 text-sm font-semibold text-red-950">
          Modtageren og eventuelt vagtcentralen får besked. Skriv en kort begrundelse.
        </p>
      ) : (
        <p className="rounded-md bg-amber-50 p-3 text-sm font-semibold text-amber-950">
          Bekræft, at du vil annullere vagtoverdragelsen. Begrundelse er valgfri.
        </p>
      )}
      <label className="grid gap-2 text-sm font-semibold text-zinc-800">
        Begrundelse {requiresReason ? "" : "(valgfri)"}
        <textarea
          className="focus-ring min-h-24 rounded-md border border-zinc-300 bg-white px-3 py-2 text-base"
          maxLength={500}
          name="cancellationReason"
          required={requiresReason}
        />
      </label>
      <ActionMessage message={state.message} ok={state.ok} />
      <CancelSubmitButton />
    </form>
  );
}

function CancelSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      className="focus-ring inline-flex min-h-12 w-full items-center justify-center rounded-md border border-red-700 px-5 text-base font-semibold text-red-800 disabled:cursor-wait disabled:opacity-70 sm:w-auto"
      disabled={pending}
      type="submit"
    >
      {pending ? "Annullerer..." : "Annullér vagtoverdragelse"}
    </button>
  );
}
