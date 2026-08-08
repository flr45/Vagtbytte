import Link from "next/link";
import { AppIcon } from "@/components/AppIcon";
import {
  OperationalPageFrame,
  OperationalPortalNav,
  OperationalScreenHeader
} from "@/components/OperationalPortalNav";
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
    <OperationalPageFrame>
      <OperationalScreenHeader
        backHref="/admin/operativ-portal"
        right={<Link aria-label="Åbn favoritter" className="grid size-11 place-items-center rounded-lg transition hover:bg-white/10" href="/admin/operativ-portal/favoritter"><AppIcon className="size-5" name="star" /></Link>}
        title="Køretøjer"
      />
      <OperationalPortalNav isEditor={isEditor} />

      {error ? <p className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm font-bold text-red-100">{error}</p> : null}

      <section className="grid gap-2">
        {vehicles.map((vehicle) => {
          const code = vehicle.code || vehicleCode(vehicle.name);
          return (
            <Link className="grid min-h-[78px] grid-cols-[94px_minmax(0,1fr)_24px] items-center gap-3 rounded-lg border border-white/5 bg-[#11171b] p-2 shadow-sm transition hover:bg-[#161e23]" href={`/admin/operativ-portal/koeretoejer/${vehicle.id}`} key={vehicle.id}>
              {vehicle.coverImageId ? (
                <img alt={vehicle.name} className="h-[62px] w-[94px] rounded-md bg-[#20272c] object-cover" src={operationalImageUrl(vehicle.coverImageId)} />
              ) : (
                <div className="grid h-[62px] w-[94px] place-items-center rounded-md bg-gradient-to-br from-[#2a3035] to-[#15191d] text-lg font-black text-slate-500">{code}</div>
              )}
              <span className="min-w-0">
                <strong className="block truncate text-base font-bold">{vehicle.name}</strong>
                <small className="mt-0.5 block truncate text-xs text-slate-400">{vehicle.model || vehicle.description || `${vehicle.placeCount} rum · ${vehicle.itemCount} udstyr`}</small>
                <span className="mt-1.5 inline-flex rounded bg-[#c61019] px-1.5 py-0.5 text-[9px] font-black text-white">{code}</span>
              </span>
              <AppIcon className="size-5 text-slate-400" name="chevronRight" />
            </Link>
          );
        })}
        {vehicles.length === 0 ? <p className="rounded-lg border border-dashed border-white/15 bg-white/5 p-8 text-center text-sm font-semibold text-slate-400">Der er endnu ikke oprettet køretøjer.</p> : null}
      </section>

      {isEditor ? (
        <details className="mt-2 rounded-lg border border-white/10 bg-[#0d1317] p-4">
          <summary className="cursor-pointer text-sm font-black text-red-400">+ Opret nyt køretøj</summary>
          <form action={createOperationalVehicleAction} className="mt-4 grid gap-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Navn"><input className="dark-input" name="name" placeholder="Fx Sprøjte M2" required /></Field>
              <Field label="Kaldesignal"><input className="dark-input" name="code" placeholder="M2" /></Field>
              <Field label="Model"><input className="dark-input" name="model" placeholder="Scania P 360" /></Field>
              <Field label="Årgang"><input className="dark-input" min="1900" max="2200" name="year" type="number" /></Field>
              <Field label="Drivmiddel"><input className="dark-input" name="fuel" placeholder="Diesel" /></Field>
              <Field label="Mandskab"><input className="dark-input" name="crew" placeholder="1+5" /></Field>
              <Field label="Rækkefølge"><input className="dark-input" defaultValue={vehicles.length} min="0" name="sortOrder" type="number" /></Field>
            </div>
            <Field label="Beskrivelse"><textarea className="dark-input min-h-24 p-3" name="description" /></Field>
            <Field label="Funktion"><textarea className="dark-input min-h-24 p-3" name="functionText" /></Field>
            <button className="app-button-primary" type="submit">Opret køretøj</button>
          </form>
        </details>
      ) : null}
    </OperationalPageFrame>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="grid gap-1.5 text-xs font-bold text-slate-300">{label}{children}</label>;
}

function vehicleCode(name: string) {
  const match = name.toUpperCase().match(/\b[A-ZÆØÅ]{1,2}\d{1,2}\b/);
  return match?.[0] ?? name.slice(0, 3).toUpperCase();
}
