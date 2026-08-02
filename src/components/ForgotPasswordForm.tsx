"use client";

import { useActionState } from "react";
import { requestPasswordResetAction } from "@/lib/password-actions";
import { ActionMessage } from "./ActionMessage";
import { SubmitButton } from "./SubmitButton";

export function ForgotPasswordForm() {
  const [state, action] = useActionState(requestPasswordResetAction, {});

  return (
    <form action={action} className="grid gap-5">
      <label className="grid gap-2 text-sm font-semibold text-zinc-800">
        Medarbejdernummer, brugernavn eller mailadresse
        <input
          autoCapitalize="none"
          autoComplete="username"
          className="focus-ring min-h-12 rounded-xl border border-zinc-200 bg-white px-4 text-base shadow-sm"
          name="identifier"
          required
          type="text"
        />
      </label>
      <ActionMessage message={state.message} ok={state.ok} />
      <SubmitButton pendingText="Sender link…">Send nulstillingslink</SubmitButton>
    </form>
  );
}
