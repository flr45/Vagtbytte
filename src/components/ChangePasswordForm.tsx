"use client";

import { useActionState } from "react";
import { changeRequiredPasswordAction } from "@/lib/password-actions";
import { ActionMessage } from "./ActionMessage";
import { PasswordCreationFields } from "./PasswordCreationFields";
import { SubmitButton } from "./SubmitButton";

export function ChangePasswordForm() {
  const [state, action] = useActionState(changeRequiredPasswordAction, {});

  return (
    <form action={action} className="grid gap-5">
      <label className="grid gap-2 text-sm font-semibold text-zinc-800">
        Nuværende adgangskode
        <input
          autoComplete="current-password"
          className="focus-ring min-h-12 rounded-xl border border-zinc-200 bg-white px-4 text-base shadow-sm"
          name="currentPassword"
          required
          type="password"
        />
      </label>
      <PasswordCreationFields passwordName="newPassword" />
      <ActionMessage message={state.message} ok={state.ok} />
      <SubmitButton pendingText="Gemmer…">Skift adgangskode</SubmitButton>
    </form>
  );
}
