import { redirect } from "next/navigation";
import { MfaSetupForm } from "@/components/MfaSetupForm";
import { getMfaChallengeState, getMfaSetupDetails } from "@/lib/mfa-auth";

export default async function MfaSetupPage() {
  const state = await getMfaChallengeState();
  if (!state) redirect("/login");
  if (state === "verify") redirect("/mfa");

  const details = await getMfaSetupDetails();
  if (!details) redirect("/login");

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <section className="app-card w-full max-w-2xl">
        <p className="text-sm font-bold uppercase tracking-wide text-brand-red">SBR Portal</p>
        <h1 className="mt-2 text-3xl font-bold">Beskyt din konto med MFA</h1>
        <p className="mt-3 max-w-xl text-base leading-7 text-zinc-700">
          Din konto har adgang til beskyttet indhold. Derfor skal du bruge en authenticator-app som ekstra loginfaktor.
        </p>
        <div className="mt-6">
          <MfaSetupForm
            formattedSecret={details.formattedSecret}
            recoveryCodes={details.recoveryCodes}
          />
        </div>
      </section>
    </main>
  );
}
