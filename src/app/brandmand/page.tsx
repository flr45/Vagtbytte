import { UserRole } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { TopBar } from "@/components/TopBar";

export default async function FirefighterPage() {
  const user = await requireRole(UserRole.BRANDFIGHTER);

  return (
    <>
      <TopBar title="Vagtoverdragelse" />
      <main className="mx-auto w-full max-w-3xl px-4 py-6">
        <section className="rounded-lg border border-brand-line bg-white p-5 shadow-sm">
          <h1 className="text-3xl font-bold">Vagtoverdragelse</h1>
          <dl className="mt-5 grid gap-3 rounded-md bg-brand-mist p-4">
            <div>
              <dt className="text-sm font-semibold text-zinc-600">Navn</dt>
              <dd className="mt-1 text-lg font-bold">{user.name}</dd>
            </div>
            <div>
              <dt className="text-sm font-semibold text-zinc-600">Medarbejdernummer</dt>
              <dd className="mt-1 text-lg font-bold">{user.employeeNumber}</dd>
            </div>
          </dl>
          <p className="mt-5 text-base text-zinc-700">
            Funktionen til at oprette vagtoverdragelse kommer i næste del.
          </p>
        </section>
      </main>
    </>
  );
}
