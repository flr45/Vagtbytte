import { redirect } from "next/navigation";
import { getCurrentUser, roleHome } from "@/lib/auth";
import { LoginForm } from "@/components/LoginForm";

export default async function LoginPage() {
  const user = await getCurrentUser();

  if (user?.mustChangePassword) {
    redirect("/skift-adgangskode");
  }

  if (user) {
    redirect(roleHome[user.role]);
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <section className="w-full max-w-md rounded-lg border border-brand-line bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-wide text-brand-red">
          Vagtoverdragelse
        </p>
        <h1 className="mt-2 text-3xl font-bold">Log ind</h1>
        <p className="mt-3 text-base text-zinc-700">
          Brug din personlige konto eller vagtcentralens fælles login.
        </p>
        <div className="mt-6">
          <LoginForm />
        </div>
      </section>
    </main>
  );
}
