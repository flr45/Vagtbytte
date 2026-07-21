import { requirePasswordChangeUser } from "@/lib/auth";
import { ChangePasswordForm } from "@/components/ChangePasswordForm";

export default async function ChangePasswordPage() {
  const user = await requirePasswordChangeUser();

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <section className="w-full max-w-md rounded-lg border border-brand-line bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-wide text-brand-red">
          Første login
        </p>
        <h1 className="mt-2 text-2xl font-bold">Skift adgangskode</h1>
        <p className="mt-3 text-base text-zinc-700">
          Hej {user.name}. Du skal vælge en ny adgangskode, før du kan bruge systemet.
        </p>
        <div className="mt-6">
          <ChangePasswordForm />
        </div>
      </section>
    </main>
  );
}
