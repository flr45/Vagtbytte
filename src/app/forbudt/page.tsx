import Link from "next/link";

export default function ForbiddenPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <section className="w-full max-w-md rounded-lg border border-brand-line bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-wide text-brand-red">403</p>
        <h1 className="mt-2 text-2xl font-bold">Ingen adgang</h1>
        <p className="mt-3 text-base text-zinc-700">
          Din bruger har ikke adgang til denne del af systemet.
        </p>
        <Link
          className="focus-ring mt-6 inline-flex min-h-12 items-center justify-center rounded-md bg-brand-red px-5 text-base font-semibold text-white"
          href="/"
        >
          Gå til forsiden
        </Link>
      </section>
    </main>
  );
}
