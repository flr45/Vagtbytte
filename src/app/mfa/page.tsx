import { redirect } from "next/navigation";
import { MfaVerifyForm } from "@/components/MfaVerifyForm";
import { getMfaChallengeState } from "@/lib/mfa-auth";

export default async function MfaPage() {
  const state = await getMfaChallengeState();
  if (!state) redirect("/login");
  if (state === "setup") redirect("/mfa/opsaetning");

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <section className="app-card w-full max-w-md">
        <p className="text-sm font-bold uppercase tracking-wide text-brand-red">SBR Portal</p>
        <h1 className="mt-2 text-3xl font-bold">Bekræft login</h1>
        <p className="mt-3 text-base leading-7 text-zinc-700">
          Denne konto er beskyttet med multifaktorautentifikation.
        </p>
        <div className="mt-6">
          <MfaVerifyForm />
        </div>
      </section>
    </main>
  );
}
