import { logoutAction } from "@/lib/actions";
import { requirePasswordChangeUser } from "@/lib/auth";
import { ChangePasswordForm } from "@/components/ChangePasswordForm";

export default async function ChangePasswordPage() {
  const user = await requirePasswordChangeUser();

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <section className="app-card w-full max-w-md">
        <p className="text-sm font-semibold uppercase tracking-wide text-brand-red">
          Første login
        </p>
        <h1 className="mt-2 text-3xl font-bold">Skift adgangskode</h1>
        <p className="mt-3 text-base leading-relaxed text-zinc-700">
          Hej {user.name}. Du skal vælge en ny adgangskode, før du kan bruge systemet.
        </p>
        <div className="mt-6">
          <ChangePasswordForm />
        </div>
        <form action={logoutAction} className="mt-4 border-t border-zinc-200 pt-4">
          <button className="app-button-secondary w-full" type="submit">
            Log ud og gå tilbage til login
          </button>
        </form>
      </section>
    </main>
  );
}
