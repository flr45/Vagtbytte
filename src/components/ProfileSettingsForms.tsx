"use client";

import { useActionState } from "react";
import { changeOwnPasswordAction, updateOwnProfileAction } from "@/lib/profile-actions";

export function ProfileSettingsForms({ name, email }: { name: string; email: string | null }) {
  const [profileState, profileAction] = useActionState(updateOwnProfileAction, {});
  const [passwordState, passwordAction] = useActionState(changeOwnPasswordAction, {});

  return (
    <div className="grid gap-4">
      <form action={profileAction} className="rounded-2xl border border-white/10 bg-[#0d1317] p-4 shadow-xl">
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-red-400">Mine oplysninger</p>
        <div className="mt-4 grid gap-4">
          <Field label="Navn">
            <input
              className="min-h-12 rounded-xl border border-white/10 bg-[#080d10] px-4 text-base font-bold text-white outline-none placeholder:text-slate-600 focus:border-red-500"
              defaultValue={name}
              maxLength={120}
              name="name"
              required
            />
          </Field>
          <Field label="E-mail">
            <input
              autoComplete="email"
              className="min-h-12 rounded-xl border border-white/10 bg-[#080d10] px-4 text-base font-bold text-white outline-none placeholder:text-slate-600 focus:border-red-500"
              defaultValue={email ?? ""}
              inputMode="email"
              maxLength={200}
              name="email"
              placeholder="navn@eksempel.dk"
              type="email"
            />
          </Field>
          <ActionMessage ok={profileState.ok} message={profileState.message} />
          <button className="min-h-12 rounded-xl bg-[#b70f18] px-4 text-sm font-black text-white transition hover:bg-red-700" type="submit">
            Gem oplysninger
          </button>
        </div>
      </form>

      <form action={passwordAction} className="rounded-2xl border border-white/10 bg-[#0d1317] p-4 shadow-xl">
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-red-400">Sikkerhed</p>
        <h2 className="mt-1 text-lg font-black text-white">Skift adgangskode</h2>
        <div className="mt-4 grid gap-4">
          <Field label="Nuværende adgangskode">
            <input autoComplete="current-password" className="min-h-12 rounded-xl border border-white/10 bg-[#080d10] px-4 text-base font-bold text-white outline-none focus:border-red-500" name="currentPassword" required type="password" />
          </Field>
          <Field label="Ny adgangskode">
            <input autoComplete="new-password" className="min-h-12 rounded-xl border border-white/10 bg-[#080d10] px-4 text-base font-bold text-white outline-none focus:border-red-500" name="newPassword" required type="password" />
          </Field>
          <Field label="Gentag ny adgangskode">
            <input autoComplete="new-password" className="min-h-12 rounded-xl border border-white/10 bg-[#080d10] px-4 text-base font-bold text-white outline-none focus:border-red-500" name="confirmPassword" required type="password" />
          </Field>
          <p className="text-xs font-semibold leading-5 text-slate-500">Brug en adgangskode, du ikke anvender andre steder. De eksisterende krav til adgangskoder gælder stadig.</p>
          <ActionMessage ok={passwordState.ok} message={passwordState.message} />
          <button className="min-h-12 rounded-xl border border-red-500/30 bg-red-500/10 px-4 text-sm font-black text-red-300 transition hover:bg-red-500/20" type="submit">
            Skift adgangskode
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="grid gap-2 text-sm font-black text-slate-300"><span>{label}</span>{children}</label>;
}

function ActionMessage({ ok, message }: { ok?: boolean; message?: string }) {
  if (!message) return null;
  return <p className={`rounded-xl border px-3 py-2.5 text-sm font-bold ${ok ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300" : "border-red-500/20 bg-red-500/10 text-red-300"}`}>{message}</p>;
}
