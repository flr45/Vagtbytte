import Link from "next/link";
import { notFound } from "next/navigation";
import { OperationalDocumentUploadForm } from "@/components/OperationalDocumentUploadForm";
import { OperationalImageManager } from "@/components/OperationalImageManager";
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
  deleteOperationalDocumentAction,
  updateOperationalVehicleAction
} from "@/lib/operativ-portal-actions";
import {
  getOperationalVehicle,
  operationalImageUrl,
  youtubeEmbedUrl
} from "@/lib/operativ-portal";

export const dynamic = "force-dynamic";
type PageProps = { params: Promise<{ vehicleId: string }> };

export default async function OperationalVehiclePage({ params }: PageProps) {
  const user = await requireOperationalPortalAccess();
  const isEditor = canManageOperationalPortal(user);
  const { vehicleId } = await params;
  const vehicle = await getOperationalVehicle(vehicleId);
  if (!vehicle) notFound();

  return (
    <OperationalPageFrame>
      <OperationalScreenHeader backHref="/admin/operativ-portal/koeretoejer" title={vehicle.name} />
      <OperationalPortalNav isEditor={isEditor} />

      <section className="overflow-hidden rounded-xl border border-white/10 bg-[#0b1013] shadow-xl">
        {vehicle.coverImageId ? (
          <img alt={vehicle.name} className="aspect-[16/10] w-full bg-[#161c20] object-cover" src={operationalImageUrl(vehicle.coverImageId)} />
        ) : (
          <div className="grid aspect-[16/10] place-items-center bg-gradient-to-br from-[#2a3136] to-[#111518] text-5xl font-black text-slate-600">{vehicleCode(vehicle.name)}</div>
        )}
        <div className="p-4 sm:p-5">
          <h1 className="text-3xl font-black tracking-tight">{vehicle.name}</h1>
          <p className="mt-1 text-sm font-medium text-slate-400">{vehicle.description || "Ingen beskrivelse endnu."}</p>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <InfoChip icon="▦" label="Rum" value={vehicle.placeCount} />
            <InfoChip icon="◉" label="Udstyr" value={vehicle.itemCount} />
            <InfoChip icon="▶" label="Videoer" value={vehicle.videoCount} />
          </div>
          <Link className="mt-5 flex min-h-12 items-center justify-center gap-2 rounded-lg bg-[#c71019] px-4 text-sm font-black text-white shadow-lg hover:bg-red-700" href="#interaktivt">
            <span aria-hidden="true">⌗</span> Se køretøjet interaktivt
          </Link>
        </div>
      </section>

      <section id="interaktivt" className="scroll-mt-20 overflow-hidden rounded-xl border border-white/10 bg-[#0d1317]">
        <div className="border-b border-white/10 bg-[#b70f18] px-4 py-3 text-center text-sm font-black">Interaktivt overblik</div>
        {vehicle.coverImageId ? <img alt={`Oversigt over ${vehicle.name}`} className="aspect-[16/7] w-full bg-[#11171b] object-cover opacity-90" src={operationalImageUrl(vehicle.coverImageId)} /> : null}
        <div className="grid grid-cols-3 gap-2 p-3">
          {vehicle.places.map((place) => (
            <Link className="grid min-h-14 place-items-center rounded-lg border border-white/5 bg-[#151b1f] px-2 text-center text-xs font-bold text-slate-200 hover:border-red-500/40 hover:bg-[#1b2227]" href={`/admin/operativ-portal/rum/${place.id}`} key={place.id}>{place.name}</Link>
          ))}
          {vehicle.places.length === 0 ? <p className="col-span-3 p-5 text-center text-sm text-slate-500">Ingen rum registreret endnu.</p> : null}
        </div>
        <div className="m-3 mt-0 flex items-center gap-3 rounded-lg bg-[#151b1f] p-4 text-sm text-slate-400"><span className="text-3xl">☝</span><span>Tryk på et område for at se indholdet</span></div>
      </section>

      {isEditor ? (
        <details className="rounded-lg border border-red-500/20 bg-red-500/5 p-4">
          <summary className="cursor-pointer text-sm font-black text-red-400">Administration af {vehicle.name}</summary>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <form action={updateOperationalVehicleAction} className="grid gap-3 rounded-lg bg-[#0d1317] p-4">
              <input name="vehicleId" type="hidden" value={vehicle.id} />
              <label className="grid gap-1.5 text-xs font-bold text-slate-300">Navn<input className="dark-input" defaultValue={vehicle.name} name="name" required /></label>
              <label className="grid gap-1.5 text-xs font-bold text-slate-300">Beskrivelse<textarea className="dark-input min-h-28 p-3" defaultValue={vehicle.description} name="description" /></label>
              <button className="app-button-primary" type="submit">Gem køretøj</button>
            </form>
            <form action={createOperationalPlaceAction} className="grid content-start gap-3 rounded-lg bg-[#0d1317] p-4">
              <input name="vehicleId" type="hidden" value={vehicle.id} />
              <h2 className="text-sm font-black">Tilføj rum eller område</h2>
              <input className="dark-input" name="name" placeholder="Fx Rum 1 – venstre forrest" required />
              <button className="app-button-primary" type="submit">Tilføj rum</button>
            </form>
          </div>
        </details>
      ) : null}

      {isEditor ? (
        <OperationalImageManager description="Upload oversigtsbilleder af køretøjet." images={vehicle.images} title={`Billeder af ${vehicle.name}`} vehicleId={vehicle.id} />
      ) : null}

      <section className="grid gap-3 lg:grid-cols-2">
        <OperationalPanel>
          <div className="flex items-center justify-between"><h2 className="text-base font-black">Dokumenter</h2><Link className="text-xs font-bold text-red-500" href="/admin/operativ-portal/dokumenter">Alle</Link></div>
          <div className="mt-3 grid gap-2">
            {vehicle.documents.slice(0, 5).map((document) => (
              <div className="grid grid-cols-[38px_minmax(0,1fr)_auto] items-center gap-2 rounded-lg bg-[#151b1f] p-2.5" key={document.id}>
                <span className="grid size-9 place-items-center rounded bg-[#c71019] text-[9px] font-black">FIL</span>
                <a className="min-w-0" href={`/api/admin/operativ-portal/dokumenter/${document.id}`} target="_blank"><strong className="block truncate text-xs">{document.title}</strong><small className="block truncate text-[10px] text-slate-500">{document.originalName}</small></a>
                {isEditor ? <form action={deleteOperationalDocumentAction}><input name="documentId" type="hidden" value={document.id} /><button className="text-[10px] font-bold text-red-400" type="submit">Slet</button></form> : <span className="text-slate-500">›</span>}
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
              <article className="overflow-hidden rounded-lg bg-[#151b1f]" key={video.id}><iframe allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen className="aspect-video w-full" loading="lazy" src={youtubeEmbedUrl(video.youtubeId)} title={video.title} /><div className="p-3"><strong className="text-sm">{video.title}</strong></div></article>
            ))}
            {vehicle.videos.length === 0 ? <p className="text-sm text-slate-500">Ingen videoer tilknyttet.</p> : null}
          </div>
        </OperationalPanel>
      </section>
    </OperationalPageFrame>
  );
}

function InfoChip({ icon, label, value }: { icon: string; label: string; value: number }) {
  return <div className="rounded-lg bg-[#141a1e] p-2.5 text-center"><span className="text-xl text-red-400">{icon}</span><p className="mt-1 text-[9px] text-slate-500">{label}</p><p className="text-sm font-black">{value}</p></div>;
}

function vehicleCode(name: string) {
  const match = name.toUpperCase().match(/\b[A-ZÆØÅ]{1,2}\d{1,2}\b/);
  return match?.[0] ?? name.slice(0, 3).toUpperCase();
}
