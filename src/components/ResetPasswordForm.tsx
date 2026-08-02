"use client";

import { useActionState } from "react";
import { resetForgottenPasswordAction } from "@/lib/password-actions";
import { ActionMessage } from "./ActionMessage";
import { PasswordCreationFields } from "./PasswordCreationFields";
import { SubmitButton } from "./SubmitButton";

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action] = useActionState(resetForgottenPasswordAction, {});

  return (
    <form action={action} className="grid gap-5">
      <input name="token" type="hidden" value={token} />
      <PasswordCreationFields passwordName="newPassword" />
      <ActionMessage message={state.message} ok={state.ok} />
      <SubmitButton pendingText="Gemmer…">Gem ny adgangskode</SubmitButton>
    </form>
  );
}
