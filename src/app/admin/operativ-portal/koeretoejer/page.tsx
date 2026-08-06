import Link from "next/link";
import {
  OperationalPageFrame,
  OperationalPortalHeader,
  OperationalPortalNav
} from "@/components/OperationalPortalNav";
import { TopBar } from "@/components/TopBar";
import {
  canManageOperationalPortal,
  requireOperationalPortalAccess
} from "@/lib/auth";
import { createOperationalVehicleAction } from "@/lib/operativ-portal-actions";
import { listOperationalVehicles, operationalImageUrl } from "@/lib/operativ-portal";

export const dynamic = "force-dynamic";
type PageProps = { searchParams: Promise<{ fejl?: string | string[] }> };

export default async function OperationalVehiclesPage({ searchParams }: PageProps) {
  const user = await requireOperationalPortalAccess();
  const isEditor = canManageOperationalPortal(user);
  const [vehicles, params] = await Promise.all([listOperationalVehicles(), searchParams]);
  const error = Array.isArray(params.fejl) ? params.fejl[0] : params.fejl;

  return (
    <>
      <TopBar title="Køretøjer" variant="operational" />
      <OperationalPageFrame>
        <OperationalPortalHeader
          description="Vælg et køretøj for at finde rum, placeringer og materiel i den visuelle pakkeliste."
          isEditor={isEditor}
          title="Køretøjer"
        />
        <OperationalPortalNav isEditor={isEditor} />

        {error ? (
          <p className="rounded-2xl border border-red-400/30 bg-red-500/10 p-4 font-bold text-red-100">{error}</p>
        ) : null}

        {isEditor ? (
          <details className="rounded-2xl border border-red-400/20 bg-red-500/10 p-5">
            <summary className="cursor-pointer text-lg font-black text-red-100">Opret nyt køretøj</summary>
            <form action={createOperationalVehicleAction} className="mt-4 grid gap-4 rounded-2xl border border-white/10 bg-[#101b2c] p-4 lg:grid-cols-[minmax(220px,.7fr)_minmax(0,1.3fr)_auto] lg:items-end">
              <label className="grid gap-2 text-sm font-bold text-slate-200">
                Navn
                <input className="focus-ring min-h-12 rounded-xl border border-white/10 bg-[#08111f] px-4 text-white" name="name" placeholder="Fx Sprøjte M2" required />
              </label>
              <label className="grid gap-2 text-sm font-bold text-slate-200">
                Beskrivelse
                <input className="focus-ring min-h-12 rounded-xl border border-white/10 bg-[#08111f] px-4 text-white" name="description" placeholder="Primært førsteudrykningskøretøj" />
              </label>
              <button className="app-button-primary min-h-12" type="submit">Opret køretøj</button>
            </form>
          </details>
        ) : null}

        <section>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-red-300">Station Slagelse</p>
              <h2 className="mt-1 text-3xl font-black">Alle køretøjer</h2>
              <p className="mt-2 text-sm font-semibold text-slate-400">{vehicles.length} registreret</p>
            </div>
          </div>

          <div className="mt-5 grid gap-5 md:grid-cols-2">
            {vehicles.map((vehicle) => (
              <Link
                className="group overflow-hidden rounded-[1.5rem] border border-white/10 bg-[#101b2c] shadow-xl transition hover:-translate-y-1 hover:border-red-400/40 hover:shadow-2xl"
                href={`/admin/operativ-portal/koeretoejer/${vehicle.id}`}
                key={vehicle.id}
              >
                <div className="relative">
                  {vehicle.coverImageId ? (
                    <img alt={vehicle.name} className="aspect-[16/9] w-full bg-slate-900 object-cover transition duration-300 group-hover:scale-[1.02]" src={operationalImageUrl(vehicle.coverImageId)} />
                  ) : (
                    <div className="grid aspect-[16/9] place-items-center bg-gradient-to-br from-[#24344d] via-[#101c2e] to-[#070d16] text-5xl font-black text-white/25">
                      {vehicleCode(vehicle.name)}
                    </div>
                  )}
                  <span className="absolute right-4 top-4 rounded-xl bg-red-600 px-3 py-2 text-sm font-black text-white shadow-lg">
                    {vehicleCode(vehicle.name)}
                  </span>
                </div>
                <div className="p-5 sm:p-6">
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-red-300">Operativt køretøj</p>
                  <h3 className="mt-2 text-2xl font-black">{vehicle.name}</h3>
                  <p className="mt-3 line-clamp-2 min-h-12 text-sm font-semibold leading-6 text-slate-400">{vehicle.description || "Ingen beskrivelse endnu."}</p>
                  <div className="mt-5 flex flex-wrap gap-2 text-xs font-black text-slate-300">
                    <span className="rounded-full bg-white/5 px-3 py-2">{vehicle.placeCount} rum</span>
                    <span className="rounded-full bg-white/5 px-3 py-2">{vehicle.itemCount} udstyr</span>
                    <span className="rounded-full bg-white/5 px-3 py-2">{vehicle.videoCount} videoer</span>
                  </div>
                  <span className="mt-5 inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-red-300">Åbn køretøj →</span>
                </div>
              </Link>
            ))}
            {vehicles.length === 0 ? (
              <p className="rounded-[1.5rem] border border-dashed border-white/15 bg-white/5 p-10 text-center font-semibold text-slate-400 md:col-span-2">
                {isEditor ? "Opret det første køretøj ovenfor." : "Der er endnu ikke oprettet køretøjer."}
              </p>
            ) : null}
          </div>
        </section>
      </OperationalPageFrame>
    </>
  );
}

function vehicleCode(name: string) {
  const match = name.toUpperCase().match(/\b[A-ZÆØÅ]{1,2}\d{1,2}\b/);
  return match?.[0] ?? name.slice(0, 3).toUpperCase();
}
