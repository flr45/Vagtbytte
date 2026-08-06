import Link from "next/link";
import {
  OperationalPageFrame,
  OperationalPanel,
  OperationalPortalHeader,
  OperationalPortalNav
} from "@/components/OperationalPortalNav";
import { TopBar } from "@/components/TopBar";
import {
  canManageOperationalPortal,
  requireOperationalPortalAccess
} from "@/lib/auth";
import {
  getOperationalStats,
  listOperationalVehicles,
  operationalImageUrl
} from "@/lib/operativ-portal";

export const dynamic = "force-dynamic";

const modules = [
  {
    href: "/admin/operativ-portal/koeretoejer",
    icon: "🚒",
    title: "Køretøjer",
    text: "Åbn rum, pakkelister og materiel via billeder."
  },
  {
    href: "/admin/operativ-portal/videoer",
    icon: "▶",
    title: "Videoakademi",
    text: "Se instruktioner til betjening, kontrol og sikkerhed."
  },
  {
    href: "/admin/operativ-portal/dokumenter",
    icon: "▤",
    title: "Videnbank",
    text: "Manualer, instrukser, SOP’er og kontrolskemaer."
  },
  {
    href: "/admin/operativ-portal/soeg",
    icon: "⌕",
    title: "Find udstyr",
    text: "Søg på tværs af køretøjer, rum, materiel og indhold."
  }
];

export default async function OperationalPortalPage() {
  const user = await requireOperationalPortalAccess();
  const isEditor = canManageOperationalPortal(user);
  const [stats, vehicles] = await Promise.all([getOperationalStats(), listOperationalVehicles()]);

  return (
    <>
      <TopBar title="Operativ Portal" variant="operational" />
      <OperationalPageFrame>
        <OperationalPortalHeader
          description="Et hurtigt operativt værktøj til køretøjer, pakkelister, instruktioner og dokumentation."
          isEditor={isEditor}
          title="Operativ Portal"
        />
        <OperationalPortalNav isEditor={isEditor} />

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {modules.map((module) => (
            <Link
              className="group relative min-h-52 overflow-hidden rounded-[1.5rem] border border-white/10 bg-[#101b2c] p-5 shadow-xl transition hover:-translate-y-1 hover:border-red-400/40 hover:bg-[#142238]"
              href={module.href}
              key={module.href}
            >
              <div className="absolute -right-8 -top-8 size-32 rounded-full bg-red-500/10 blur-2xl transition group-hover:bg-red-500/20" />
              <span className="relative grid size-14 place-items-center rounded-2xl border border-white/10 bg-white/5 text-3xl">
                {module.icon}
              </span>
              <h2 className="relative mt-6 text-2xl font-black">{module.title}</h2>
              <p className="relative mt-2 text-sm font-semibold leading-6 text-slate-400">{module.text}</p>
              <span className="relative mt-5 inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-red-300">
                Åbn modul <span aria-hidden="true">→</span>
              </span>
            </Link>
          ))}
        </section>

        <section className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
          <Stat label="Køretøjer" value={stats.vehicles} />
          <Stat label="Rum" value={stats.places} />
          <Stat label="Udstyr" value={stats.items} />
          <Stat label="Billeder" value={stats.images} />
          <Stat label="Videoer" value={stats.videos} />
          <Stat label="Dokumenter" value={stats.documents} />
        </section>

        <OperationalPanel>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-red-300">Hurtig adgang</p>
              <h2 className="mt-1 text-2xl font-black">Stationens køretøjer</h2>
              <p className="mt-2 text-sm font-semibold text-slate-400">Vælg et køretøj for at åbne den visuelle pakkeliste.</p>
            </div>
            <Link className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-black hover:bg-white/10" href="/admin/operativ-portal/koeretoejer">
              Se alle
            </Link>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {vehicles.slice(0, 6).map((vehicle) => (
              <Link
                className="group overflow-hidden rounded-2xl border border-white/10 bg-[#0a1422] transition hover:border-red-400/40 hover:shadow-2xl"
                href={`/admin/operativ-portal/koeretoejer/${vehicle.id}`}
                key={vehicle.id}
              >
                {vehicle.coverImageId ? (
                  <img
                    alt={vehicle.name}
                    className="aspect-[16/10] w-full bg-slate-900 object-cover transition duration-300 group-hover:scale-[1.02]"
                    src={operationalImageUrl(vehicle.coverImageId)}
                  />
                ) : (
                  <div className="grid aspect-[16/10] place-items-center bg-gradient-to-br from-[#1e2d44] to-[#09111e] text-4xl font-black text-white/30">
                    {vehicle.name.slice(0, 3).toUpperCase()}
                  </div>
                )}
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-red-300">Køretøj</p>
                      <h3 className="mt-1 text-xl font-black">{vehicle.name}</h3>
                    </div>
                    <span className="rounded-lg bg-red-600 px-2.5 py-1.5 text-xs font-black text-white">
                      {vehicleCode(vehicle.name)}
                    </span>
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm text-slate-400">{vehicle.description || "Ingen beskrivelse endnu."}</p>
                  <p className="mt-4 text-xs font-bold text-slate-500">{vehicle.placeCount} rum · {vehicle.itemCount} udstyr</p>
                </div>
              </Link>
            ))}
            {vehicles.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-white/15 bg-white/5 p-8 text-center font-semibold text-slate-400 sm:col-span-2 lg:col-span-3">
                Der er endnu ikke oprettet køretøjer.
              </p>
            ) : null}
          </div>
        </OperationalPanel>

        <section className="grid gap-4 lg:grid-cols-2">
          <OperationalPanel>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-red-300">Lommekort</p>
            <h2 className="mt-2 text-2xl font-black">Hurtige operative huskeregler</h2>
            <p className="mt-3 text-sm font-semibold leading-6 text-slate-400">
              Modulet er klargjort til korte indsatskort, tjeklister og procedurer i næste indholdsetape.
            </p>
            <span className="mt-5 inline-flex rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-black text-slate-300">Kommer snart</span>
          </OperationalPanel>
          <OperationalPanel>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-red-300">QR-adgang</p>
            <h2 className="mt-2 text-2xl font-black">Scan direkte ved køretøj eller materiel</h2>
            <p className="mt-3 text-sm font-semibold leading-6 text-slate-400">
              Strukturen er klar til QR-koder, der kan åbne det præcise rum eller udstyr direkte.
            </p>
            <span className="mt-5 inline-flex rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-black text-slate-300">Kommer snart</span>
          </OperationalPanel>
        </section>
      </OperationalPageFrame>
    </>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#101b2c]/90 p-4 shadow-lg">
      <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-black text-white">{value.toLocaleString("da-DK")}</p>
    </div>
  );
}

function vehicleCode(name: string) {
  const match = name.toUpperCase().match(/\b[A-ZÆØÅ]{1,2}\d{1,2}\b/);
  return match?.[0] ?? name.slice(0, 3).toUpperCase();
}
