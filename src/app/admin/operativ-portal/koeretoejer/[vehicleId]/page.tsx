import Link from "next/link";
import { notFound } from "next/navigation";
import { OperationalDocumentUploadForm } from "@/components/OperationalDocumentUploadForm";
import { OperationalImageManager } from "@/components/OperationalImageManager";
import {
  OperationalPageFrame,
  OperationalPanel,
  OperationalPortalNav
} from "@/components/OperationalPortalNav";
import { TopBar } from "@/components/TopBar";
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
    <>
      <TopBar title={vehicle.name} variant="operational" />
      <OperationalPageFrame>
        <OperationalPortalNav isEditor={isEditor} />

        <nav className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-400">
          <Link className="hover:text-white" href="/admin/operativ-portal/koeretoejer">Køretøjer</Link>
          <span>›</span>
          <strong className="text-white">{vehicle.name}</strong>
        </nav>

        <section className="overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#101b2c] shadow-2xl lg:grid lg:grid-cols-[minmax(0,1.2fr)_minmax(340px,.8fr)]">
          <div className="relative min-h-80 bg-[#08111f]">
            {vehicle.coverImageId ? (
              <img alt={vehicle.name} className="h-full min-h-80 w-full object-cover" src={operationalImageUrl(vehicle.coverImageId)} />
            ) : (
              <div className="grid min-h-80 place-items-center bg-gradient-to-br from-[#263952] to-[#080f1a] text-6xl font-black text-white/20">
                {vehicleCode(vehicle.name)}
              </div>
            )}
            <span className="absolute left-5 top-5 rounded-xl bg-red-600 px-3 py-2 text-sm font-black text-white shadow-xl">
              {vehicleCode(vehicle.name)}
            </span>
          </div>
          <div className="flex flex-col justify-center p-6 sm:p-8">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-red-300">Station Slagelse · Køretøj</p>
            <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">{vehicle.name}</h1>
            <p className="mt-4 text-sm font-semibold leading-7 text-slate-300">{vehicle.description || "Der er endnu ikke tilføjet en beskrivelse."}</p>
            <div className="mt-6 grid grid-cols-2 gap-3 text-center sm:grid-cols-3">
              <HeroStat label="Rum" value={vehicle.placeCount} />
              <HeroStat label="Udstyr" value={vehicle.itemCount} />
              <HeroStat label="Videoer" value={vehicle.videoCount} />
            </div>
          </div>
        </section>

        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <QuickLink href="#rum" icon="▦" label="Rum" />
          <QuickLink href="#dokumenter" icon="▤" label="Dokumenter" />
          <QuickLink href="#videoer" icon="▶" label="Videoer" />
          <QuickLink href="/admin/operativ-portal/soeg" icon="⌕" label="Søg" />
        </section>

        {isEditor ? (
          <details className="rounded-2xl border border-red-400/20 bg-red-500/10 p-5">
            <summary className="cursor-pointer text-lg font-black text-red-100">Redigér køretøj og tilføj rum</summary>
            <div className="mt-5 grid gap-5 lg:grid-cols-2">
              <form action={updateOperationalVehicleAction} className="grid gap-4 rounded-2xl border border-white/10 bg-[#101b2c] p-4">
                <input name="vehicleId" type="hidden" value={vehicle.id} />
                <label className="grid gap-2 text-sm font-bold text-slate-200">Navn<input className="focus-ring min-h-12 rounded-xl border border-white/10 bg-[#08111f] px-4 text-white" defaultValue={vehicle.name} name="name" required /></label>
                <label className="grid gap-2 text-sm font-bold text-slate-200">Beskrivelse<textarea className="focus-ring min-h-32 rounded-xl border border-white/10 bg-[#08111f] p-4 text-white" defaultValue={vehicle.description} name="description" /></label>
                <button className="app-button-primary" type="submit">Gem køretøj</button>
              </form>
              <form action={createOperationalPlaceAction} className="grid content-start gap-4 rounded-2xl border border-white/10 bg-[#101b2c] p-4">
                <input name="vehicleId" type="hidden" value={vehicle.id} />
                <h2 className="text-lg font-black">Tilføj rum eller område</h2>
                <label className="grid gap-2 text-sm font-bold text-slate-200">Navn<input className="focus-ring min-h-12 rounded-xl border border-white/10 bg-[#08111f] px-4 text-white" name="name" placeholder="Fx H1, venstre side" required /></label>
                <button className="app-button-primary" type="submit">Tilføj rum</button>
              </form>
            </div>
          </details>
        ) : null}

        {isEditor ? (
          <OperationalImageManager
            description="Upload oversigtsbilleder af køretøjet. Forsidebilledet bruges på dashboard og køretøjsoversigt."
            images={vehicle.images}
            title={`Billeder af ${vehicle.name}`}
            vehicleId={vehicle.id}
          />
        ) : vehicle.images.length > 1 ? (
          <OperationalPanel>
            <h2 className="text-2xl font-black">Billedgalleri</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {vehicle.images.map((image) => (
                <img alt={image.altText || image.title} className="aspect-video w-full rounded-2xl bg-slate-900 object-cover" key={image.id} src={operationalImageUrl(image.id)} />
              ))}
            </div>
          </OperationalPanel>
        ) : null}

        <section id="rum">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-red-300">Visuel struktur</p>
              <h2 className="mt-1 text-3xl font-black">Rum og områder</h2>
              <p className="mt-2 text-sm font-semibold text-slate-400">Vælg det rum, du står ved.</p>
            </div>
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {vehicle.places.map((place, index) => (
              <Link className="group overflow-hidden rounded-[1.5rem] border border-white/10 bg-[#101b2c] shadow-xl hover:border-red-400/40" href={`/admin/operativ-portal/rum/${place.id}`} key={place.id}>
                {place.coverImageId ? (
                  <img alt={place.name} className="aspect-[4/3] w-full bg-slate-900 object-cover transition group-hover:scale-[1.02]" src={operationalImageUrl(place.coverImageId)} />
                ) : (
                  <div className="grid aspect-[4/3] place-items-center bg-gradient-to-br from-[#22334b] to-[#08111f] text-4xl font-black text-white/20">{String(index + 1).padStart(2, "0")}</div>
                )}
                <div className="p-5">
                  <strong className="block text-xl">{place.name}</strong>
                  <small className="mt-2 block font-semibold text-slate-400">{place.itemCount} udstyrsposter</small>
                  <span className="mt-4 block text-xs font-black uppercase tracking-[0.14em] text-red-300">Åbn rum →</span>
                </div>
              </Link>
            ))}
            {vehicle.places.length === 0 ? (
              <p className="rounded-[1.5rem] border border-dashed border-white/15 bg-white/5 p-8 text-center font-semibold text-slate-400 sm:col-span-2 lg:col-span-3">
                {isEditor ? "Brug redigeringspanelet til at oprette det første rum." : "Der er endnu ikke registreret rum på køretøjet."}
              </p>
            ) : null}
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-2">
          <OperationalPanel className="scroll-mt-24" >
            <div id="dokumenter" className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-red-300">Videnbank</p>
                <h2 className="mt-1 text-2xl font-black">Dokumenter</h2>
              </div>
              <Link className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-black" href="/admin/operativ-portal/dokumenter">Alle</Link>
            </div>
            <div className="mt-4 grid gap-2">
              {vehicle.documents.slice(0, 6).map((document) => (
                <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-[#08111f] p-3" key={document.id}>
                  <span className="grid size-10 place-items-center rounded-lg bg-red-600 text-[10px] font-black">FIL</span>
                  <a className="min-w-0 flex-1" href={`/api/admin/operativ-portal/dokumenter/${document.id}`} target="_blank">
                    <strong className="block truncate text-sm">{document.title}</strong>
                    <small className="text-slate-500">{document.originalName}</small>
                  </a>
                  {isEditor ? (
                    <form action={deleteOperationalDocumentAction}><input name="documentId" type="hidden" value={document.id} /><button className="text-xs font-black text-red-300" type="submit">Slet</button></form>
                  ) : null}
                </div>
              ))}
              {vehicle.documents.length === 0 ? <p className="rounded-xl bg-white/5 p-4 text-sm font-semibold text-slate-400">Ingen dokumenter endnu.</p> : null}
            </div>
            {isEditor ? (
              <details className="mt-4 rounded-xl border border-white/10 p-4"><summary className="cursor-pointer font-black">Upload dokument</summary><div className="mt-4 text-zinc-950"><OperationalDocumentUploadForm defaultVehicleId={vehicle.id} vehicles={[{ id: vehicle.id, name: vehicle.name }]} /></div></details>
            ) : null}
          </OperationalPanel>

          <OperationalPanel className="scroll-mt-24">
            <div id="videoer" className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-red-300">Instruktion</p>
                <h2 className="mt-1 text-2xl font-black">Videoer</h2>
              </div>
              <Link className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-black" href={isEditor ? `/admin/operativ-portal/videoer?vehicleId=${vehicle.id}` : "/admin/operativ-portal/videoer"}>{isEditor ? "Tilføj" : "Alle"}</Link>
            </div>
            <div className="mt-4 grid gap-4">
              {vehicle.videos.slice(0, 3).map((video) => (
                <article className="overflow-hidden rounded-2xl border border-white/10 bg-[#08111f]" key={video.id}>
                  <iframe allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen className="aspect-video w-full" loading="lazy" src={youtubeEmbedUrl(video.youtubeId)} title={video.title} />
                  <div className="p-4"><strong>{video.title}</strong><p className="mt-1 text-sm text-slate-400">{video.description || video.category}</p></div>
                </article>
              ))}
              {vehicle.videos.length === 0 ? <p className="rounded-xl bg-white/5 p-4 text-sm font-semibold text-slate-400">Ingen videoer tilknyttet endnu.</p> : null}
            </div>
          </OperationalPanel>
        </section>
      </OperationalPageFrame>
    </>
  );
}

function HeroStat({ label, value }: { label: string; value: number }) {
  return <div className="rounded-xl border border-white/10 bg-white/5 p-3"><p className="text-2xl font-black">{value}</p><p className="mt-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">{label}</p></div>;
}

function QuickLink({ href, icon, label }: { href: string; icon: string; label: string }) {
  return <Link className="grid min-h-24 place-items-center rounded-2xl border border-white/10 bg-[#101b2c] p-3 text-center shadow-lg hover:border-red-400/40 hover:bg-[#142238]" href={href}><span className="text-2xl" aria-hidden="true">{icon}</span><span className="text-sm font-black">{label}</span></Link>;
}

function vehicleCode(name: string) {
  const match = name.toUpperCase().match(/\b[A-ZÆØÅ]{1,2}\d{1,2}\b/);
  return match?.[0] ?? name.slice(0, 3).toUpperCase();
}
