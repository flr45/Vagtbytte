"use client";

import { useActionState } from "react";
import { loginAction } from "@/lib/actions";
import { ActionMessage } from "./ActionMessage";
import { SubmitButton } from "./SubmitButton";

export function LoginForm() {
  const [state, action] = useActionState(loginAction, {});

  return (
    <form action={action} className="grid gap-5">
      <label className="grid gap-2 text-sm font-semibold text-zinc-800">
        Medarbejdernummer eller brugernavn
        <input
          autoComplete="username"
          className="focus-ring min-h-12 rounded-md border border-zinc-300 bg-white px-3 text-base"
          name="identifier"
          required
          type="text"
        />
      </label>
      <label className="grid gap-2 text-sm font-semibold text-zinc-800">
        Adgangskode
        <input
          autoComplete="current-password"
          className="focus-ring min-h-12 rounded-md border border-zinc-300 bg-white px-3 text-base"
          name="password"
          required
          type="password"
        />
      </label>
      <ActionMessage message={state.message} ok={state.ok} />
      <SubmitButton pendingText="Logger ind...">Log ind</SubmitButton>
    </form>
  );
}
