"use client";

import Link from "next/link";
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
          autoCapitalize="none"
          autoComplete="username"
          className="focus-ring min-h-12 rounded-xl border border-zinc-200 bg-white px-4 text-base shadow-sm"
          name="identifier"
          required
          type="text"
        />
      </label>
      <label className="grid gap-2 text-sm font-semibold text-zinc-800">
        Adgangskode
        <input
          autoComplete="current-password"
          className="focus-ring min-h-12 rounded-xl border border-zinc-200 bg-white px-4 text-base shadow-sm"
          name="password"
          required
          type="password"
        />
      </label>
      <div className="-mt-2 flex justify-end">
        <Link className="focus-ring rounded-md px-2 py-2 text-sm font-bold text-brand-red hover:underline" href="/glemt-adgangskode">
          Glemt adgangskode?
        </Link>
      </div>
      <ActionMessage message={state.message} ok={state.ok} />
      <SubmitButton pendingText="Logger ind...">Log ind</SubmitButton>
    </form>
  );
}
