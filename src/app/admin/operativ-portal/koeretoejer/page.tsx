import Link from "next/link";
import { UserRole } from "@prisma/client";
import { OperationalPortalHeader, OperationalPortalNav } from "@/components/OperationalPortalNav";
import { TopBar } from "@/components/TopBar";
import { requireRole } from "@/lib/auth";
import { createOperationalVehicleAction } from "@/lib/operativ-portal-actions";
import { listOperationalVehicles, operationalImageUrl } from "@/lib/operativ-portal";

export const dynamic = "force-dynamic";
type PageProps = { searchParams: Promise<{ fejl?: string | string[] }> };

export default async function OperationalVehiclesPage({ searchParams }: PageProps) {
  await requireRole(UserRole.ADMIN);
  const [vehicles, params] = await Promise.all([listOperationalVehicles(), searchParams]);
  const error = Array.isArray(params.fejl) ? params.fejl[0] : params.fejl;

  return (
    <>
      <TopBar title="Operative køretøjer" />
      <main className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-6">
        <OperationalPortalHeader title="Køretøjer og pakkelister" description="Opret køretøjer og byg en visuel struktur med billeder af køretøj, rum og materiel." />
        <OperationalPortalNav />
        {error ? <p className="rounded-xl border border-red-200 bg-red-50 p-4 font-bold text-red-900">{error}</p> : null}

        <details className="rounded-2xl border border-red-200 bg-red-50 p-5">
          <summary className="cursor-pointer text-xl font-black text-red-950">Opret køretøj</summary>
          <form action={createOperationalVehicleAction} className="mt-4 grid gap-4 rounded-xl bg-white p-4 lg:grid-cols-[minmax(220px,.7fr)_minmax(0,1.3fr)_auto] lg:items-end">
            <label className="grid gap-2 text-sm font-bold text-zinc-700">Navn<input className="focus-ring min-h-12 rounded-xl border border-zinc-200 px-4" name="name" placeholder="Fx Sprøjte M2" required /></label>
            <label className="grid gap-2 text-sm font-bold text-zinc-700">Beskrivelse<input className="focus-ring min-h-12 rounded-xl border border-zinc-200 px-4" name="description" placeholder="Primært førsteudrykningskøretøj til brand, redning og miljøopgaver" /></label>
            <button className="app-button-primary min-h-12" type="submit">Opret køretøj</button>
          </form>
        </details>

        <section><div className="flex items-end justify-between gap-4"><div><h2 className="text-2xl font-black">Alle køretøjer</h2><p className="mt-1 text-sm font-semibold text-zinc-600">{vehicles.length} registreret</p></div></div>
          <div className="mt-4 grid gap-5 md:grid-cols-2">
            {vehicles.map((vehicle) => (
              <Link className="group overflow-hidden rounded-2xl border border-brand-line bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-red-300 hover:shadow-md" href={`/admin/operativ-portal/koeretoejer/${vehicle.id}`} key={vehicle.id}>
                {vehicle.coverImageId ? <img alt={vehicle.name} className="aspect-[16/8] w-full bg-zinc-100 object-cover" src={operationalImageUrl(vehicle.coverImageId)} /> : <div className="grid aspect-[16/8] place-items-center bg-zinc-950 text-3xl font-black text-white">{vehicle.name.slice(0, 3).toUpperCase()}</div>}
                <div className="p-5"><p className="text-xs font-black uppercase tracking-[0.13em] text-brand-red">Station Slagelse</p><h3 className="mt-1 text-2xl font-black">{vehicle.name}</h3><p className="mt-2 line-clamp-2 text-sm text-zinc-600">{vehicle.description || "Ingen beskrivelse endnu."}</p><div className="mt-4 flex flex-wrap gap-2 text-xs font-black text-zinc-600"><span className="rounded-full bg-zinc-100 px-3 py-2">{vehicle.placeCount} rum</span><span className="rounded-full bg-zinc-100 px-3 py-2">{vehicle.itemCount} udstyr</span><span className="rounded-full bg-zinc-100 px-3 py-2">{vehicle.imageCount} billeder</span><span className="rounded-full bg-zinc-100 px-3 py-2">{vehicle.videoCount} videoer</span></div></div>
              </Link>
            ))}
            {vehicles.length === 0 ? <p className="rounded-2xl border border-dashed border-zinc-300 bg-white p-8 font-semibold text-zinc-600 md:col-span-2">Opret det første køretøj ovenfor.</p> : null}
          </div>
        </section>
      </main>
    </>
  );
}
