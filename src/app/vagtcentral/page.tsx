import { UserRole } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { TopBar } from "@/components/TopBar";

export default async function VagtcentralPage() {
  await requireRole(UserRole.VC);

  return (
    <>
      <TopBar title="Vagtcentral" />
      <main className="mx-auto w-full max-w-4xl px-4 py-6">
        <section className="rounded-lg border border-brand-line bg-white p-5 shadow-sm">
          <h1 className="text-3xl font-bold">Vagtcentral</h1>
          <p className="mt-3 text-base text-zinc-700">Ingen anmodninger er implementeret endnu</p>
          <div className="mt-6 rounded-md border border-dashed border-zinc-300 bg-brand-mist p-5">
            <p className="font-semibold text-zinc-800">Kommende anmodninger</p>
            <p className="mt-2 text-sm text-zinc-600">
              Her vises konkrete vagtoverdragelser i en senere del.
            </p>
          </div>
        </section>
      </main>
    </>
  );
}
