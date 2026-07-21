"use client";

import { useActionState } from "react";
import { changePasswordAction } from "@/lib/actions";
import { ActionMessage } from "./ActionMessage";
import { SubmitButton } from "./SubmitButton";

export function ChangePasswordForm() {
  const [state, action] = useActionState(changePasswordAction, {});

  return (
    <form action={action} className="grid gap-5">
      <label className="grid gap-2 text-sm font-semibold text-zinc-800">
        Nuværende adgangskode
        <input
          autoComplete="current-password"
          className="focus-ring min-h-12 rounded-md border border-zinc-300 bg-white px-3 text-base"
          name="currentPassword"
          required
          type="password"
        />
      </label>
      <label className="grid gap-2 text-sm font-semibold text-zinc-800">
        Ny adgangskode
        <input
          autoComplete="new-password"
          className="focus-ring min-h-12 rounded-md border border-zinc-300 bg-white px-3 text-base"
          name="newPassword"
          required
          type="password"
        />
      </label>
      <ActionMessage message={state.message} ok={state.ok} />
      <SubmitButton>Skift adgangskode</SubmitButton>
    </form>
  );
}
