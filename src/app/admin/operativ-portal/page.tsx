import Link from "next/link";
import { UserRole } from "@prisma/client";
import { OperationalPortalHeader, OperationalPortalNav } from "@/components/OperationalPortalNav";
import { TopBar } from "@/components/TopBar";
import { requireRole } from "@/lib/auth";
import { getOperationalStats, listOperationalVehicles } from "@/lib/operativ-portal";

export const dynamic = "force-dynamic";

export default async function OperationalPortalPage() {
  await requireRole(UserRole.ADMIN);
  const [stats, vehicles] = await Promise.all([
    getOperationalStats(),
    listOperationalVehicles()
  ]);

  return (
    <>
      <TopBar title="Operativ Portal" />
      <main className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-6">
        <Link className="focus-ring w-fit rounded-md px-2 py-2 text-sm font-semibold text-zinc-700" href="/admin">
          Tilbage til administration
        </Link>
        <OperationalPortalHeader
          title="Operativ Portal"
          description="Køretøjer, pakkelister, udstyr, videoer og dokumenter samlet i den eksisterende SBR Portal. Hele området er i denne fase låst til administratorer."
        />
        <OperationalPortalNav />

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Stat href="/admin/operativ-portal/koeretoejer" label="Køretøjer" value={stats.vehicles} />
          <Stat label="Rum" value={stats.places} />
          <Stat label="Udstyr" value={stats.items} />
          <Stat href="/admin/operativ-portal/videoer" label="Videoer" value={stats.videos} />
          <Stat href="/admin/operativ-portal/dokumenter" label="Dokumenter" value={stats.documents} />
        </section>

        <section className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(300px,.65fr)]">
          <div className="rounded-2xl border border-brand-line bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-black">Køretøjer</h2>
                <p className="mt-1 text-sm font-semibold text-zinc-600">Seneste operative struktur i portalen.</p>
              </div>
              <Link className="app-button-secondary" href="/admin/operativ-portal/koeretoejer">
                Se alle
              </Link>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {vehicles.slice(0, 6).map((vehicle) => (
                <Link
                  className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 transition hover:border-red-300 hover:bg-red-50"
                  href={`/admin/operativ-portal/koeretoejer/${vehicle.id}`}
                  key={vehicle.id}
                >
                  <p className="text-xs font-black uppercase tracking-[0.12em] text-brand-red">Køretøj</p>
                  <h3 className="mt-1 text-lg font-black">{vehicle.name}</h3>
                  <p className="mt-2 line-clamp-2 text-sm text-zinc-600">
                    {vehicle.description || "Ingen beskrivelse endnu."}
                  </p>
                  <p className="mt-3 text-xs font-bold text-zinc-500">
                    {vehicle.placeCount} rum · {vehicle.itemCount} udstyrsposter
                  </p>
                </Link>
              ))}
              {vehicles.length === 0 ? (
                <p className="rounded-xl border border-dashed border-zinc-300 p-6 text-sm font-semibold text-zinc-600 sm:col-span-2">
                  Der er endnu ikke oprettet køretøjer.
                </p>
              ) : null}
            </div>
          </div>

          <aside className="grid content-start gap-4">
            <Link className="app-card-interactive grid gap-2" href="/admin/operativ-portal/koeretoejer">
              <p className="text-xs font-black uppercase tracking-[0.12em] text-brand-red">Pakkelister</p>
              <h2 className="text-xl font-black">Administrér køretøjer og rum</h2>
              <p className="text-sm font-semibold text-zinc-600">Opret køretøjer, rum og udstyr som Højtryksslange (HT).</p>
            </Link>
            <Link className="app-card-interactive grid gap-2" href="/admin/operativ-portal/videoer">
              <p className="text-xs font-black uppercase tracking-[0.12em] text-brand-red">YouTube</p>
              <h2 className="text-xl font-black">Tilføj instruktioner</h2>
              <p className="text-sm font-semibold text-zinc-600">Indsæt ikke-listede YouTube-links og tilknyt dem til materiel.</p>
            </Link>
            <Link className="app-card-interactive grid gap-2" href="/admin/operativ-portal/dokumenter">
              <p className="text-xs font-black uppercase tracking-[0.12em] text-brand-red">Beskyttede filer</p>
              <h2 className="text-xl font-black">Upload dokumenter</h2>
              <p className="text-sm font-semibold text-zinc-600">Dokumenterne gemmes på serveren og kræver admin-session.</p>
            </Link>
          </aside>
        </section>
      </main>
    </>
  );
}

function Stat({ label, value, href }: { label: string; value: number; href?: string }) {
  const content = (
    <div className="rounded-xl border border-brand-line bg-white p-4 shadow-sm">
      <p className="text-sm font-bold text-zinc-600">{label}</p>
      <p className="mt-1 text-3xl font-black text-zinc-950">{value.toLocaleString("da-DK")}</p>
    </div>
  );
  return href ? <Link href={href}>{content}</Link> : content;
}
