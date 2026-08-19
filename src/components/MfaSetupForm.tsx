"use client";

import { useActionState } from "react";
import { setupMfaAction } from "@/lib/mfa-actions";
import { ActionMessage } from "./ActionMessage";
import { SubmitButton } from "./SubmitButton";

type Props = {
  formattedSecret: string;
  recoveryCodes: string[];
};

export function MfaSetupForm({ formattedSecret, recoveryCodes }: Props) {
  const [state, action] = useActionState(setupMfaAction, {});

  return (
    <form action={action} className="grid gap-6">
      <section className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
        <p className="text-sm font-bold text-zinc-900">1. Tilføj SBR Portal i din authenticator-app</p>
        <p className="mt-2 text-sm leading-6 text-zinc-600">
          Vælg manuel opsætning/TOTP og indtast denne nøgle. Den må ikke deles med andre.
        </p>
        <code className="mt-3 block break-all rounded-lg bg-white p-3 text-center font-mono text-sm font-bold tracking-wider text-zinc-900 shadow-sm">
          {formattedSecret}
        </code>
      </section>

      <section className="rounded-xl border border-amber-200 bg-amber-50 p-4">
        <p className="text-sm font-bold text-amber-950">2. Gem recovery-koderne et sikkert sted</p>
        <p className="mt-2 text-sm leading-6 text-amber-900/80">
          Hver kode kan kun bruges én gang. Gem dem uden for telefonen, så du stadig kan logge ind, hvis telefonen bliver væk.
        </p>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {recoveryCodes.map((code) => (
            <code key={code} className="rounded-lg border border-amber-200 bg-white px-3 py-2 text-center font-mono text-sm font-bold text-zinc-900">
              {code}
            </code>
          ))}
        </div>
        <label className="mt-4 flex items-start gap-3 text-sm font-semibold text-amber-950">
          <input className="mt-1 size-4" name="recoverySaved" required type="checkbox" />
          Jeg har gemt recovery-koderne et sikkert sted.
        </label>
      </section>

      <label className="grid gap-2 text-sm font-semibold text-zinc-800">
        3. Bekræft med den sekscifrede kode
        <input
          autoComplete="one-time-code"
          className="focus-ring min-h-12 rounded-xl border border-zinc-200 bg-white px-4 text-center font-mono text-xl tracking-[0.25em] shadow-sm"
          inputMode="numeric"
          maxLength={6}
          minLength={6}
          name="code"
          pattern="[0-9]{6}"
          required
          type="text"
        />
      </label>

      <ActionMessage message={state.message} ok={state.ok} />
      <SubmitButton pendingText="Aktiverer MFA...">Aktivér MFA og fortsæt</SubmitButton>
    </form>
  );
}
