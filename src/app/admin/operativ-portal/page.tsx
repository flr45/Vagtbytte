import Link from "next/link";
import {
  OperationalPageFrame,
  OperationalPortalNav
} from "@/components/OperationalPortalNav";
import {
  canManageOperationalPortal,
  requireOperationalPortalAccess
} from "@/lib/auth";
import {
  listOperationalVehicles,
  operationalImageUrl
} from "@/lib/operativ-portal";

export const dynamic = "force-dynamic";

const modules = [
  {
    href: "/admin/operativ-portal/dokumenter",
    icon: "▤",
    title: "LOMMEKORT",
    text: "Operative kort og lommekort",
    primary: true
  },
  {
    href: "/admin/operativ-portal/koeretoejer",
    icon: "🚒",
    title: "KØRETØJER",
    text: "Oversigt over køretøjer"
  },
  {
    href: "/admin/operativ-portal/videoer",
    icon: "▶",
    title: "VIDEOAKADEMI",
    text: "Undervisningsvideoer og instruktioner"
  },
  {
    href: "/admin/operativ-portal/dokumenter",
    icon: "▥",
    title: "VIDENSBANK",
    text: "SOP’er, instrukser og vigtige dokumenter"
  }
];

export default async function OperationalPortalPage() {
  const user = await requireOperationalPortalAccess();
  const isEditor = canManageOperationalPortal(user);
  const vehicles = await listOperationalVehicles();

  return (
    <OperationalPageFrame>
      <div className="flex items-center justify-between px-1 py-1 md:hidden">
        <Link aria-label="Tilbage til SBR Portal" className="grid size-11 place-items-center text-2xl text-slate-200" href="/">☰</Link>
        <span className="text-xl text-slate-300" aria-hidden="true">♧</span>
      </div>

      <section className="grid justify-items-center py-5 text-center sm:py-8">
        <div className="grid size-28 place-items-center rounded-full border-2 border-amber-500/70 bg-[#101519] shadow-[0_0_40px_rgba(220,38,38,.12)]">
          <div className="grid size-20 place-items-center rounded-full border border-red-600 bg-[#15191c] text-center">
            <span className="text-2xl font-black tracking-tight text-white">SBR</span>
          </div>
        </div>
        <h1 className="mt-7 text-4xl font-black tracking-tight sm:text-5xl">SBR <span className="text-red-600">Fire</span> App</h1>
        <p className="mt-2 text-lg font-semibold text-slate-200">Operativ Portal</p>
        <p className="mt-1 text-sm text-slate-400">Slagelse Brand og Redning</p>
        {isEditor ? <span className="mt-3 rounded bg-red-600/15 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-red-400">Admin</span> : null}
      </section>

      <section className="grid grid-cols-2 gap-3">
        {modules.map((module) => (
          <Link className={`${module.primary ? "bg-gradient-to-br from-[#c21720] to-[#8f0d14]" : "bg-[#11171b]"} group grid min-h-40 content-center justify-items-center rounded-xl border border-white/10 p-4 text-center shadow-lg transition hover:border-red-500/50`} href={module.href} key={module.title}>
            <span aria-hidden="true" className={`text-4xl ${module.primary ? "text-white" : "text-red-500"}`}>{module.icon}</span>
            <h2 className="mt-4 text-sm font-black tracking-wide text-white sm:text-base">{module.title}</h2>
            <p className={`mt-1 max-w-44 text-xs font-medium leading-5 ${module.primary ? "text-red-50/90" : "text-slate-400"}`}>{module.text}</p>
          </Link>
        ))}
      </section>

      <Link className="grid grid-cols-[56px_minmax(0,1fr)_24px] items-center gap-3 rounded-xl border border-white/10 bg-[#11171b] p-4 shadow-lg hover:border-red-500/50" href="/admin/operativ-portal/scan">
        <span className="grid size-12 place-items-center rounded-lg text-3xl text-red-500">⌗</span>
        <span>
          <strong className="block text-sm font-black">SCAN QR-KODE</strong>
          <small className="mt-1 block text-xs font-medium leading-5 text-slate-400">Scan en QR-kode og få hurtig adgang til information</small>
        </span>
        <span className="text-xl text-slate-500">›</span>
      </Link>

      {vehicles.length > 0 ? (
        <section className="rounded-xl border border-white/10 bg-[#0d1317] p-3 md:block">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-black">Hurtig adgang</h2>
            <Link className="text-xs font-bold text-red-500" href="/admin/operativ-portal/koeretoejer">Alle køretøjer</Link>
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            {vehicles.slice(0, 4).map((vehicle) => {
              const code = vehicle.code || vehicleCode(vehicle.name);
              return (
                <Link className="grid grid-cols-[74px_minmax(0,1fr)_18px] items-center gap-3 rounded-lg bg-[#12191e] p-2 hover:bg-[#172026]" href={`/admin/operativ-portal/koeretoejer/${vehicle.id}`} key={vehicle.id}>
                  {vehicle.coverImageId ? <img alt={vehicle.name} className="h-14 w-[74px] rounded-md object-cover" src={operationalImageUrl(vehicle.coverImageId)} /> : <div className="grid h-14 w-[74px] place-items-center rounded-md bg-[#20272c] text-xs font-black text-slate-500">{code}</div>}
                  <span className="min-w-0"><strong className="block truncate text-sm">{vehicle.name}</strong><small className="mt-1 block truncate text-xs text-slate-500">{vehicle.model || `${vehicle.placeCount} rum · ${vehicle.itemCount} udstyr`}</small><span className="mt-1 inline-flex rounded bg-red-600 px-1.5 py-0.5 text-[8px] font-black text-white">{code}</span></span>
                  <span className="text-xl text-slate-500">›</span>
                </Link>
              );
            })}
          </div>
        </section>
      ) : null}

      <OperationalPortalNav isEditor={isEditor} />
    </OperationalPageFrame>
  );
}

function vehicleCode(name: string) {
  const match = name.toUpperCase().match(/\b[A-ZÆØÅ]{1,2}\d{1,2}\b/);
  return match?.[0] ?? name.slice(0, 3).toUpperCase();
}
