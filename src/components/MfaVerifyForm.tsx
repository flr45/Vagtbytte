"use client";

import Link from "next/link";
import { useActionState } from "react";
import { verifyMfaAction } from "@/lib/mfa-actions";
import { ActionMessage } from "./ActionMessage";
import { SubmitButton } from "./SubmitButton";

export function MfaVerifyForm() {
  const [state, action] = useActionState(verifyMfaAction, {});

  return (
    <form action={action} className="grid gap-5">
      <label className="grid gap-2 text-sm font-semibold text-zinc-800">
        Authenticator-kode eller recovery-kode
        <input
          autoCapitalize="characters"
          autoComplete="one-time-code"
          autoFocus
          className="focus-ring min-h-12 rounded-xl border border-zinc-200 bg-white px-4 text-center font-mono text-lg tracking-[0.15em] shadow-sm"
          inputMode="text"
          maxLength={64}
          name="code"
          required
          type="text"
        />
      </label>
      <p className="text-sm leading-6 text-zinc-600">
        Brug den sekscifrede kode fra din authenticator-app. Hvis telefonen ikke er tilgængelig, kan du bruge én af dine recovery-koder én gang.
      </p>
      <ActionMessage message={state.message} ok={state.ok} />
      <SubmitButton pendingText="Kontrollerer...">Godkend og log ind</SubmitButton>
      <Link className="focus-ring rounded-lg px-3 py-2 text-center text-sm font-bold text-zinc-600 hover:text-brand-red" href="/login">
        Tilbage til login
      </Link>
    </form>
  );
}
