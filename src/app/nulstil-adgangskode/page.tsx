import Link from "next/link";
import { ResetPasswordForm } from "@/components/ResetPasswordForm";
import {
  hashPasswordResetToken,
  passwordResetTokenIsUsable
} from "@/lib/password-reset-core";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Nulstil adgangskode – SBR Portal"
};

type SearchParams = {
  token?: string | string[];
};

export default async function ResetPasswordPage({
  searchParams
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const token = Array.isArray(params.token) ? params.token[0] : params.token;
  const storedToken = token
    ? await prisma.passwordResetToken.findUnique({
        where: { tokenHash: hashPasswordResetToken(token) },
        select: {
          expiresAt: true,
          usedAt: true,
          user: { select: { isActive: true } }
        }
      })
    : null;
  const tokenIsValid = Boolean(
    storedToken?.user.isActive && passwordResetTokenIsUsable(storedToken)
  );

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <section className="app-card w-full max-w-md">
        <p className="text-sm font-bold uppercase tracking-wide text-brand-red">SBR Portal</p>
        <h1 className="mt-2 text-3xl font-bold">Vælg ny adgangskode</h1>
        {!tokenIsValid || !token ? (
          <>
            <p className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-900">
              Nulstillingslinket er ugyldigt, udløbet eller allerede brugt.
            </p>
            <Link className="app-button-primary mt-5 w-full" href="/glemt-adgangskode">
              Bestil et nyt link
            </Link>
          </>
        ) : (
          <div className="mt-6">
            <ResetPasswordForm token={token} />
          </div>
        )}
        <Link className="focus-ring mt-5 inline-flex rounded-md px-2 py-2 text-sm font-bold text-brand-red" href="/login">
          Tilbage til login
        </Link>
      </section>
    </main>
  );
}
