import Link from "next/link";
import { ForgotPasswordForm } from "@/components/ForgotPasswordForm";

export const metadata = {
  title: "Glemt adgangskode – SBR Portal"
};

export default function ForgotPasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <section className="app-card w-full max-w-md">
        <p className="text-sm font-bold uppercase tracking-wide text-brand-red">SBR Portal</p>
        <h1 className="mt-2 text-3xl font-bold">Glemt adgangskode</h1>
        <p className="mt-3 text-base leading-relaxed text-zinc-700">
          Indtast dine oplysninger. Har din bruger en registreret mailadresse, modtager du et link, der virker i 30 minutter.
        </p>
        <div className="mt-6">
          <ForgotPasswordForm />
        </div>
        <Link className="focus-ring mt-5 inline-flex rounded-md px-2 py-2 text-sm font-bold text-brand-red" href="/login">
          Tilbage til login
        </Link>
      </section>
    </main>
  );
}
