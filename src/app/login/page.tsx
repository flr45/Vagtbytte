import { redirect } from "next/navigation";
import { getCurrentUser, roleHome } from "@/lib/auth";
import { LoginForm } from "@/components/LoginForm";

type SearchParams = {
  reset?: string | string[];
};

export default async function LoginPage({
  searchParams
}: {
  searchParams: Promise<SearchParams>;
}) {
  const user = await getCurrentUser();
  const params = await searchParams;
  const passwordWasReset = (Array.isArray(params.reset) ? params.reset[0] : params.reset) === "1";

  if (user?.mustChangePassword) {
    redirect("/skift-adgangskode");
  }

  if (user) {
    redirect(roleHome[user.role]);
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <section className="app-card w-full max-w-md">
        <p className="text-sm font-bold uppercase tracking-wide text-brand-red">SBR Portal</p>
        <h1 className="mt-2 text-3xl font-bold">Log ind</h1>
        <p className="mt-3 text-base text-zinc-700">
          Alarmfeed, vagtoverdragelse og vagttildeling samlet ét sted.
        </p>
        {passwordWasReset ? (
          <p className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-900" role="status">
            Din adgangskode er ændret. Du kan nu logge ind.
          </p>
        ) : null}
        <div className="mt-6">
          <LoginForm />
        </div>
      </section>
    </main>
  );
}
