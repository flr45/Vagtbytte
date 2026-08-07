import Link from "next/link";
import { notFound } from "next/navigation";
import { OperationalDocumentUploadForm } from "@/components/OperationalDocumentUploadForm";
import { OperationalHotspotEditor } from "@/components/OperationalHotspotEditor";
import { OperationalImageManager } from "@/components/OperationalImageManager";
import { OperationalVehicleAdminEditor } from "@/components/OperationalVehicleAdminEditor";
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
import { setOperationalInteractiveImageAction } from "@/lib/operativ-portal-hotspot-actions";
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

  const code = vehicle.code || vehicleCode(vehicle.name);
  const interactiveImageId = vehicle.interactiveImageId || vehicle.coverImageId;

  return (
    <OperationalPageFrame>
      <OperationalScreenHeader backHref="/admin/operativ-portal/koeretoejer" title={vehicle.name} />
      <OperationalPortalNav isEditor={isEditor} />

      <section className="overflow-hidden rounded-xl border border-white/10 bg-[#0b1013] shadow-xl">
        {vehicle.coverImageId ? (
          <img alt={vehicle.name} className="aspect-[16/10] w-full bg-[#161c20] object-cover" src={operationalImageUrl(vehicle.coverImageId)} />
        ) : (
          <div className="grid aspect-[16/10] place-items-center bg-gradient-to-br from-[#2a3136] to-[#111518] text-5xl font-black text-slate-600">{code}</div>
        )}
        <div className="p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="truncate text-3xl font-black tracking-tight">{vehicle.name}</h1>
              <p className="mt-1 truncate text-sm font-medium text-slate-400">{vehicle.model || "Model ikke angivet"}</p>
            </div>
            <span className="shrink-0 rounded bg-[#c71019] px-2.5 py-1.5 text-xs font-black text-white">{code}</span>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            <DataChip icon="▣" label="Årgang" value={vehicle.year ? String(vehicle.year) : "—"} />
            <DataChip icon="◒" label="Drivmiddel" value={vehicle.fuel || "—"} />
            <DataChip icon="♙" label="Mandskab" value={vehicle.crew || "—"} />
          </div>

          <div className="mt-5 grid gap-4 text-sm leading-6">
            <div><h2 className="font-black text-white">Beskrivelse</h2><p className="mt-1 text-slate-400">{vehicle.description || "Ingen beskrivelse endnu."}</p></div>
            <div><h2 className="font-black text-white">Funktion</h2><p className="mt-1 text-slate-400">{vehicle.functionText || "Ingen funktionsbeskrivelse endnu."}</p></div>
          </div>

          <Link className="mt-5 flex min-h-12 items-center justify-center gap-2 rounded-lg bg-[#c71019] px-4 text-sm font-black text-white shadow-lg hover:bg-red-700" href="#interaktivt">
            <span aria-hidden="true">⌗</span> Se køretøjet interaktivt
          </Link>
        </div>
      </section>

      <section id="interaktivt" className="scroll-mt-20 overflow-hidden rounded-xl border border-white/10 bg-[#0d1317]">
        <div className="border-b border-white/10 bg-[#b70f18] px-4 py-3 text-center text-sm font-black">Interaktivt overblik</div>
        {interactiveImageId ? (
          <div className="relative bg-black">
            <img alt={`Interaktiv oversigt over ${vehicle.name}`} className="block w-full" src={operationalImageUrl(interactiveImageId)} />
            {vehicle.hotspots.map((hotspot) => (
              <Link
                aria-label={`Åbn ${hotspot.label || hotspot.placeName}`}
                className="absolute grid size-9 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-white bg-[#d71920] text-xl font-black leading-none text-white shadow-[0_4px_18px_rgba(0,0,0,.65)] transition hover:scale-110"
                href={`/admin/operativ-portal/rum/${hotspot.placeId}`}
                key={hotspot.id}
                style={{ left: `${hotspot.xPercent}%`, top: `${hotspot.yPercent}%` }}
                title={hotspot.label || hotspot.placeName}
              >+</Link>
            ))}
          </div>
        ) : (
          <div className="grid min-h-40 place-items-center bg-[#11171b] px-6 text-center text-sm font-semibold text-slate-500">Der er endnu ikke valgt et interaktivt køretøjsbillede.</div>
        )}

        <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-3">
          {vehicle.places.map((place) => (
            <Link className="grid min-h-14 place-items-center rounded-lg border border-white/5 bg-[#151b1f] px-2 text-center text-xs font-bold text-slate-200 hover:border-red-500/40 hover:bg-[#1b2227]" href={`/admin/operativ-portal/rum/${place.id}`} key={place.id}>{place.name}</Link>
          ))}
          {vehicle.places.length === 0 ? <p className="col-span-full p-5 text-center text-sm text-slate-500">Ingen rum registreret endnu.</p> : null}
        </div>
        <div className="m-3 mt-0 flex items-center gap-3 rounded-lg bg-[#151b1f] p-4 text-sm text-slate-400"><span className="text-3xl">☝</span><span>Tryk på et hotspot eller et rum for at se indholdet</span></div>
      </section>

      {isEditor ? (
        <details className="relative z-10 min-w-0 overflow-hidden rounded-lg border border-red-500/20 bg-red-500/5 p-4" open>
          <summary className="cursor-pointer text-sm font-black text-red-400">Administration af {vehicle.name}</summary>

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
              <Field label="Navn"><input className="dark-input min-w-0" name="name" placeholder="Fx Rum 1 – venstre forrest" required /></Field>
              <Field label="Beskrivelse"><textarea className="dark-input min-h-24 min-w-0 resize-y p-3" name="description" placeholder="Hvad findes typisk i rummet?" /></Field>
              <Field label="Rækkefølge"><input className="dark-input min-w-0" defaultValue={vehicle.places.length} min="0" name="sortOrder" type="number" /></Field>
              <button className="app-button-primary w-full" type="submit">Tilføj rum</button>
            </form>
          </div>

          <div className="mt-4 grid min-w-0 gap-4 xl:grid-cols-[minmax(260px,.55fr)_minmax(0,1.45fr)]">
            <form action={setOperationalInteractiveImageAction} className="relative z-20 grid min-w-0 content-start gap-3 overflow-hidden rounded-lg bg-[#0d1317] p-4 pointer-events-auto">
              <input name="vehicleId" type="hidden" value={vehicle.id} />
              <h2 className="text-sm font-black">Interaktivt billede</h2>
              <p className="text-xs font-semibold leading-5 text-slate-500">1. Vælg et køretøjsbillede. 2. Gem. 3. Placér derefter punkterne i editoren.</p>
              <select className="dark-input min-w-0" defaultValue={vehicle.interactiveImageId ?? ""} name="imageId">
                <option value="">Brug forsidebillede / intet valgt</option>
                {vehicle.images.map((image) => <option key={image.id} value={image.id}>{image.title || image.originalName}</option>)}
              </select>
              <button className="app-button-primary w-full" type="submit">Gem interaktivt billede</button>
            </form>

            {interactiveImageId ? (
              <OperationalHotspotEditor
                hotspots={vehicle.hotspots}
                imageSrc={operationalImageUrl(interactiveImageId)}
                places={vehicle.places.map((place) => ({ id: place.id, name: place.name }))}
                vehicleId={vehicle.id}
              />
            ) : (
              <div className="min-w-0 rounded-lg bg-[#0d1317] p-5 text-sm font-semibold text-slate-500">Upload først et køretøjsbillede og vælg det som interaktivt billede.</div>
            )}
          </div>
        </details>
      ) : null}

      {isEditor ? (
        <OperationalImageManager description="Upload oversigtsbilleder af køretøjet. Et af billederne kan bruges til den interaktive hotspot-visning." images={vehicle.images} title={`Billeder af ${vehicle.name}`} vehicleId={vehicle.id} />
      ) : null}

      <section className="grid min-w-0 gap-3 lg:grid-cols-2">
        <OperationalPanel>
          <div className="flex items-center justify-between"><h2 className="text-base font-black">Dokumenter</h2><Link className="text-xs font-bold text-red-500" href="/admin/operativ-portal/dokumenter">Alle</Link></div>
          <div className="mt-3 grid gap-2">
            {vehicle.documents.slice(0, 5).map((document) => (
              <div className="grid min-w-0 grid-cols-[38px_minmax(0,1fr)_auto] items-center gap-2 rounded-lg bg-[#151b1f] p-2.5" key={document.id}>
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
              <article className="min-w-0 overflow-hidden rounded-lg bg-[#151b1f]" key={video.id}><iframe allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen className="aspect-video w-full" loading="lazy" src={youtubeEmbedUrl(video.youtubeId)} title={video.title} /><div className="p-3"><strong className="text-sm">{video.title}</strong></div></article>
            ))}
            {vehicle.videos.length === 0 ? <p className="text-sm text-slate-500">Ingen videoer tilknyttet.</p> : null}
          </div>
        </OperationalPanel>
      </section>
    </OperationalPageFrame>
  );
}

function DataChip({ icon, label, value }: { icon: string; label: string; value: string }) {
  return <div className="min-w-0 rounded-lg bg-[#141a1e] p-2.5 text-center"><span className="text-xl text-red-400">{icon}</span><p className="mt-1 text-[9px] text-slate-500">{label}</p><p className="truncate text-sm font-black">{value}</p></div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="grid min-w-0 gap-1.5 text-xs font-bold text-slate-300">{label}{children}</label>;
}

function vehicleCode(name: string) {
  const match = name.toUpperCase().match(/\b[A-ZÆØÅ]{1,2}\d{1,2}\b/);
  return match?.[0] ?? name.slice(0, 3).toUpperCase();
}
