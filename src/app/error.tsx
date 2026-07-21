"use client";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <section className="app-card grid w-full max-w-md gap-4 text-center">
        <h1 className="text-2xl font-bold">Noget gik galt</h1>
        <p className="text-sm text-zinc-600">Prøv igen.</p>
        <button className="app-button-primary mx-auto" onClick={reset} type="button">
          Prøv igen
        </button>
      </section>
    </main>
  );
}
