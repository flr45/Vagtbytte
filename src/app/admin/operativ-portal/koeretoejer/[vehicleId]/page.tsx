import Link from "next/link";
import { notFound } from "next/navigation";
import { AppIcon, type AppIconName } from "@/components/AppIcon";
import { OperationalDocumentUploadForm } from "@/components/OperationalDocumentUploadForm";
import { OperationalImageManager } from "@/components/OperationalImageManager";
import { OperationalPackingListPdfManager } from "@/components/OperationalPackingListPdfManager";
import { OperationalVehicleAdminEditor } from "@/components/OperationalVehicleAdminEditor";
import { OperationalVehicleViewer } from "@/components/OperationalVehicleViewer";
import {
  OperationalPageFrame,
  OperationalPanel,
  OperationalPortalNav,
  OperationalScreenHeader
} from "@/components/OperationalPortalNav";
import {
  canManageOperationalPortal,
  requireOperationalPortalAccess
} from "@/lib/auth";
import {
  createOperationalPlaceAction,
  deleteOperationalDocumentAction
} from "@/lib/operativ-portal-actions";
import { groupRooms } from "@/lib/operativ-interactive";
import {
  getOperationalVehicle,
  youtubeEmbedUrl
} from "@/lib/operativ-portal";
import {
  listOperationalVehicleViewHotspots,
  listOperationalVehicleViews
} from "@/lib/operativ-vehicle-views";

export const dynamic = "force-dynamic";
type PageProps = { params: Promise<{ vehicleId: string }> };

export default async function OperationalVehiclePage({ params }: PageProps) {
  const user = await requireOperationalPortalAccess();
  const isEditor = canManageOperationalPortal(user);
  const { vehicleId } = await params;
  const vehicle = await getOperationalVehicle(vehicleId);
  if (!vehicle) notFound();

  const [vehicleViews, vehicleViewHotspots] = await Promise.all([
    listOperationalVehicleViews(vehicle.id),
    listOperationalVehicleViewHotspots(vehicle.id)
  ]);
  const code = vehicle.code || vehicleCode(vehicle.name);
  const roomGroups = groupRooms(vehicle.places);

  return (
    <OperationalPageFrame>
      <OperationalScreenHeader backHref="/admin/operativ-portal/koeretoejer" title={vehicle.name} />
      <OperationalPortalNav isEditor={isEditor} />

      <section className="overflow-hidden rounded-xl border border-white/10 bg-[#0b1013] shadow-xl">
        <OperationalVehicleViewer hotspots={vehicleViewHotspots} vehicleName={vehicle.name} views={vehicleViews} />
        <div className="p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="truncate text-3xl font-black tracking-tight">{vehicle.name}</h1>
              <p className="mt-1 truncate text-sm font-medium text-slate-400">{vehicle.model || "Model ikke angivet"}</p>
            </div>
            <span className="shrink-0 rounded bg-[#c71019] px-2.5 py-1.5 text-xs font-black text-white">{code}</span>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            <DataChip icon="calendar" label="Årgang" value={vehicle.year ? String(vehicle.year) : "—"} />
            <DataChip icon="fuel" label="Drivmiddel" value={vehicle.fuel || "—"} />
            <DataChip icon="users" label="Mandskab" value={vehicle.crew || "—"} />
          </div>

          <div className="mt-5 grid gap-4 text-sm leading-6">
            <div><h2 className="font-black text-white">Beskrivelse</h2><p className="mt-1 text-slate-400">{vehicle.description || "Ingen beskrivelse endnu."}</p></div>
            <div><h2 className="font-black text-white">Funktion</h2><p className="mt-1 text-slate-400">{vehicle.functionText || "Ingen funktionsbeskrivelse endnu."}</p></div>
          </div>

          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            <Link className="flex min-h-12 items-center justify-center gap-2 rounded-lg bg-[#c71019] px-4 text-sm font-black text-white shadow-lg hover:bg-red-700" href={`/admin/operativ-portal/koeretoejer/${vehicle.id}/interaktiv`}>
              <AppIcon className="size-5" name="activity" /> Se køretøjet interaktivt
            </Link>
            <a className="flex min-h-12 items-center justify-center gap-2 rounded-lg border border-white/10 bg-[#151b1f] px-4 text-sm font-black text-white hover:border-red-500/40 hover:bg-[#1b2227]" href={`/api/admin/operativ-portal/pakkeliste/${vehicle.id}/pdf`}>
              <AppIcon className="size-5" name="document" /> Download pakkeliste
            </a>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-white/10 bg-[#0d1317]">
        <div className="border-b border-white/10 bg-[#b70f18] px-4 py-3 text-center text-sm font-black">Rum og udstyr</div>
        <div className="grid gap-3 p-3">
          {roomGroups.map((group) => (
            <div className="overflow-hidden rounded-lg border border-white/10" key={group.section}>
              <div className="flex items-center justify-between bg-[#151b1f] px-3 py-2"><strong className="text-xs">{group.section}</strong><small className="text-[10px] font-black text-slate-500">{group.rooms.length}</small></div>
              <div className="grid grid-cols-2 gap-1.5 bg-[#0b1013] p-2 sm:grid-cols-3">
                {group.rooms.map((place) => (
                  <Link className="grid min-h-14 content-center rounded-lg border border-white/5 bg-[#151b1f] px-2 py-2 text-center hover:border-red-500/40 hover:bg-[#1b2227]" href={`/admin/operativ-portal/rum/${place.id}/interaktiv`} key={place.id}><strong className="text-xs text-slate-200">{place.name}</strong><small className="mt-1 text-[9px] text-slate-500">{place.itemCount} poster</small></Link>
                ))}
              </div>
            </div>
          ))}
          {vehicle.places.length === 0 ? <p className="p-5 text-center text-sm text-slate-500">Ingen rum registreret endnu.</p> : null}
        </div>
        <Link className="m-3 mt-0 flex min-h-12 items-center justify-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 text-sm font-black text-red-300" href={`/admin/operativ-portal/koeretoejer/${vehicle.id}/interaktiv`}>Åbn fuld interaktiv visning <AppIcon className="size-4" name="chevronRight" /></Link>
      </section>

      {isEditor ? (
        <details className="relative z-10 min-w-0 overflow-hidden rounded-lg border border-red-500/20 bg-red-500/5 p-4">
          <summary className="cursor-pointer text-sm font-black text-red-400">Grundoplysninger og nyt rum</summary>

          <div className="mt-4 grid min-w-0 gap-4 xl:grid-cols-2">
            <OperationalVehicleAdminEditor
              vehicle={{
                id: vehicle.id,
                name: vehicle.name,
                code: vehicle.code,
                model: vehicle.model,
                year: vehicle.year,
                fuel: vehicle.fuel,
                crew: vehicle.crew,
                sortOrder: 0,
                description: vehicle.description,
                functionText: vehicle.functionText
              }}
            />

            <form action={createOperationalPlaceAction} className="relative z-20 grid min-w-0 content-start gap-3 overflow-hidden rounded-lg bg-[#0d1317] p-4 pointer-events-auto">
              <input name="vehicleId" type="hidden" value={vehicle.id} />
              <h2 className="text-sm font-black">Tilføj rum eller område</h2>
              <Field label="Navn"><input className="dark-input min-w-0" name="name" placeholder="Fx Højre side – forreste rum" required /></Field>
              <Field label="Beskrivelse"><textarea className="dark-input min-h-24 min-w-0 resize-y p-3" name="description" placeholder="Hvad findes typisk i rummet?" /></Field>
              <Field label="Rækkefølge"><input className="dark-input min-w-0" defaultValue={vehicle.places.length} min="0" name="sortOrder" type="number" /></Field>
              <button className="app-button-primary w-full" type="submit">Tilføj rum</button>
            </form>
          </div>
        </details>
      ) : null}

      {isEditor ? (
        <section className="rounded-xl border border-red-500/20 bg-[#0d1317] p-4">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-red-400">Administration</p>
          <h2 className="mt-1 text-lg font-black text-white">Billeder, sider og pluspunkter</h2>
          <p className="mt-2 max-w-3xl text-xs font-semibold leading-5 text-slate-400">Brug det samlede administrationsværktøj til Front, Højre side, Bagende, Venstre side og Tag. Pluspunkter er adskilt pr. visning.</p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <Link className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-red-600 px-4 text-sm font-black text-white hover:bg-red-700" href={`/admin/operativ-portal/koeretoejer/${vehicle.id}/administration`}><AppIcon className="size-5" name="settings" /> Administrér køretøjet</Link>
            <Link className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 text-sm font-black text-white hover:bg-white/10" href={`/admin/operativ-portal/koeretoejer/${vehicle.id}/foto`}><AppIcon className="size-5" name="camera" /> Start fototur</Link>
          </div>
        </section>
      ) : null}

      {isEditor ? <OperationalPackingListPdfManager vehicleId={vehicle.id} vehicleName={vehicle.name} /> : null}

      {isEditor ? (
        <OperationalImageManager description="Upload og administrér køretøjsbilleder. Front, Højre, Bagende, Venstre og Tag vælges i det samlede administrationsværktøj." images={vehicle.images} title={`Billeder af ${vehicle.name}`} vehicleId={vehicle.id} />
      ) : null}

      <section className="grid min-w-0 gap-3 lg:grid-cols-2">
        <OperationalPanel>
          <div className="flex items-center justify-between"><h2 className="text-base font-black">Dokumenter</h2><Link className="text-xs font-bold text-red-500" href="/admin/operativ-portal/dokumenter">Alle</Link></div>
          <div className="mt-3 grid gap-2">
            {vehicle.documents.slice(0, 5).map((document) => (
              <div className="grid min-w-0 grid-cols-[38px_minmax(0,1fr)_auto] items-center gap-2 rounded-lg bg-[#151b1f] p-2.5" key={document.id}>
                <span className="grid size-9 place-items-center rounded bg-[#c71019] text-white"><AppIcon className="size-4" name="document" /></span>
                <a className="min-w-0" href={`/api/admin/operativ-portal/dokumenter/${document.id}`} rel="noreferrer" target="_blank"><strong className="block truncate text-xs">{document.title}</strong><small className="block truncate text-[10px] text-slate-500">{document.originalName}</small></a>
                {isEditor ? <form action={deleteOperationalDocumentAction}><input name="documentId" type="hidden" value={document.id} /><button className="text-[10px] font-bold text-red-400" type="submit">Slet</button></form> : <AppIcon className="size-4 text-slate-500" name="chevronRight" />}
              </div>
            ))}
            {vehicle.documents.length === 0 ? <p className="text-sm text-slate-500">Ingen dokumenter endnu.</p> : null}
          </div>
          {isEditor ? <details className="mt-3 text-zinc-950"><summary className="cursor-pointer text-xs font-black text-red-400">Upload dokument</summary><div className="mt-3"><OperationalDocumentUploadForm defaultVehicleId={vehicle.id} vehicles={[{ id: vehicle.id, name: vehicle.name }]} /></div></details> : null}
        </OperationalPanel>

        <OperationalPanel>
          <div className="flex items-center justify-between"><h2 className="text-base font-black">Videoer</h2><Link className="text-xs font-bold text-red-500" href="/admin/operativ-portal/videoer">Alle</Link></div>
          <div className="mt-3 grid gap-3">
            {vehicle.videos.slice(0, 2).map((video) => (
              <article className="min-w-0 overflow-hidden rounded-lg bg-[#151b1f]" key={video.id}><iframe allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen className="aspect-video w-full" loading="lazy" src={youtubeEmbedUrl(video.youtubeId)} title={video.title} /><div className="p-3"><strong className="text-sm">{video.title}</strong></div></article>
            ))}
            {vehicle.videos.length === 0 ? <p className="text-sm text-slate-500">Ingen videoer tilknyttet.</p> : null}
          </div>
        </OperationalPanel>
      </section>
    </OperationalPageFrame>
  );
}

function DataChip({ icon, label, value }: { icon: AppIconName; label: string; value: string }) {
  return <div className="min-w-0 rounded-lg bg-[#141a1e] p-2.5 text-center"><AppIcon className="mx-auto size-5 text-red-400" name={icon} /><p className="mt-1 text-[9px] text-slate-500">{label}</p><p className="truncate text-sm font-black">{value}</p></div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="grid min-w-0 gap-1.5 text-xs font-bold text-slate-300">{label}{children}</label>;
}

function vehicleCode(name: string) {
  const match = name.toUpperCase().match(/\b[A-ZÆØÅ]{1,2}\d{1,2}\b/);
  return match?.[0] ?? name.slice(0, 3).toUpperCase();
}
