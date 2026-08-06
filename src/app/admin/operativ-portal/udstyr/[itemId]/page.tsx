import Link from "next/link";
import { notFound } from "next/navigation";
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
import { updateOperationalItemDetailsAction } from "@/lib/operativ-portal-content-actions";
import {
  contentLocationLabel,
  listManagedOperationalDocuments,
  listManagedOperationalVideos
} from "@/lib/operativ-portal-content";
import {
  getOperationalItem,
  operationalImageUrl,
  youtubeEmbedUrl
} from "@/lib/operativ-portal";

export const dynamic = "force-dynamic";
type PageProps = { params: Promise<{ itemId: string }> };

export default async function OperationalItemPage({ params }: PageProps) {
  const user = await requireOperationalPortalAccess();
  const isEditor = canManageOperationalPortal(user);
  const { itemId } = await params;
  const [item, allDocuments, allVideos] = await Promise.all([
    getOperationalItem(itemId),
    listManagedOperationalDocuments(),
    listManagedOperationalVideos()
  ]);
  if (!item) notFound();

  const documents = allDocuments.filter((document) => document.itemId === item.id);
  const videos = allVideos.filter((video) => video.itemId === item.id);

  return (
    <>
      <TopBar title={item.name} variant="operational" />
      <OperationalPageFrame>
        <OperationalPortalNav isEditor={isEditor} />

        <nav className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-400">
          <Link className="hover:text-white" href="/admin/operativ-portal/koeretoejer">Køretøjer</Link>
          <span>›</span>
          <Link className="hover:text-white" href={`/admin/operativ-portal/koeretoejer/${item.vehicleId}`}>{item.vehicleName}</Link>
          <span>›</span>
          <Link className="hover:text-white" href={`/admin/operativ-portal/rum/${item.placeId}`}>{item.placeName}</Link>
          <span>›</span>
          <strong className="text-white">{item.name}</strong>
        </nav>

        <section className="overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#101b2c] shadow-2xl lg:grid lg:grid-cols-[minmax(0,1.12fr)_minmax(360px,.88fr)]">
          <div className="relative min-h-80 bg-[#08111f]">
            {item.coverImageId ? (
              <img alt={item.name} className="h-full min-h-80 w-full object-contain p-2" src={operationalImageUrl(item.coverImageId)} />
            ) : (
              <div className="grid min-h-80 place-items-center bg-gradient-to-br from-[#24364f] to-[#08111f] text-6xl font-black text-white/15">UD</div>
            )}
            <span className="absolute right-5 top-5 rounded-xl bg-red-600 px-3 py-2 text-sm font-black text-white shadow-xl">× {item.quantity}</span>
          </div>
          <div className="flex flex-col justify-center p-6 sm:p-8">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-red-300">Udstyr · {item.vehicleName}</p>
            <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">{item.name}</h1>
            <p className="mt-4 text-sm font-semibold text-slate-300">Placeret i <strong className="text-white">{item.placeName}</strong>.</p>
            {item.note ? (
              <p className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm font-semibold leading-6 text-slate-300">{item.note}</p>
            ) : null}
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-2">
              <HeroStat label="Antal" value={item.quantity} />
              <HeroStat label="Billeder" value={item.images.length} />
              <HeroStat label="Videoer" value={videos.length} />
              <HeroStat label="Dokumenter" value={documents.length} />
            </div>
          </div>
        </section>

        {isEditor ? (
          <details className="rounded-2xl border border-red-400/20 bg-red-500/10 p-5">
            <summary className="cursor-pointer text-lg font-black text-red-100">Redigér udstyr</summary>
            <form action={updateOperationalItemDetailsAction} className="mt-5 grid gap-4 rounded-2xl border border-white/10 bg-[#101b2c] p-4 md:grid-cols-[minmax(0,1fr)_120px]">
              <input name="itemId" type="hidden" value={item.id} />
              <label className="grid gap-2 text-sm font-bold text-slate-200">Navn<input className="focus-ring min-h-12 rounded-xl border border-white/10 bg-[#08111f] px-4 text-white" defaultValue={item.name} name="name" required /></label>
              <label className="grid gap-2 text-sm font-bold text-slate-200">Antal<input className="focus-ring min-h-12 rounded-xl border border-white/10 bg-[#08111f] px-4 text-white" defaultValue={item.quantity} min="1" name="quantity" required type="number" /></label>
              <label className="grid gap-2 text-sm font-bold text-slate-200 md:col-span-2">Note<textarea className="focus-ring min-h-24 rounded-xl border border-white/10 bg-[#08111f] p-4 text-white" defaultValue={item.note} name="note" placeholder="Placering, kontrolpunkt eller bemærkning" /></label>
              <button className="app-button-primary md:w-fit" type="submit">Gem udstyr</button>
            </form>
          </details>
        ) : null}

        {isEditor ? (
          <OperationalImageManager
            description="Upload genkendelige billeder af udstyret, betjeningspunkter eller korrekt placering."
            images={item.images}
            itemId={item.id}
            placeId={item.placeId}
            title={`Billeder af ${item.name}`}
            vehicleId={item.vehicleId}
          />
        ) : item.images.length > 1 ? (
          <OperationalPanel>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-red-300">Billedgalleri</p>
            <h2 className="mt-1 text-2xl font-black">Detaljebilleder</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {item.images.map((image) => (
                <img alt={image.altText || image.title} className="aspect-video w-full rounded-2xl bg-slate-900 object-contain" key={image.id} src={operationalImageUrl(image.id)} />
              ))}
            </div>
          </OperationalPanel>
        ) : null}

        <section className="grid gap-5 lg:grid-cols-[minmax(0,.72fr)_minmax(0,1.28fr)]">
          <OperationalPanel>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-red-300">Placering</p>
            <h2 className="mt-1 text-2xl font-black">Registrerede oplysninger</h2>
            <dl className="mt-5 grid gap-3">
              <Fact label="Køretøj" value={item.vehicleName} />
              <Fact label="Rum" value={item.placeName} />
              <Fact label="Antal" value={String(item.quantity)} />
              <Fact label="Note" value={item.note || "Ingen note tilføjet"} />
            </dl>
          </OperationalPanel>

          <OperationalPanel>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-red-300">Instruktion og dokumentation</p>
            <h2 className="mt-1 text-2xl font-black">Lær udstyret at kende</h2>
            <p className="mt-3 text-sm font-semibold leading-6 text-slate-400">Se betjening, sikkerhed, kontrolpunkter og relevante manualer direkte ved materiellet.</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <a className="rounded-2xl border border-white/10 bg-[#08111f] p-4 hover:border-red-400/40" href="#videoer">
                <span className="text-2xl" aria-hidden="true">▶</span>
                <strong className="mt-3 block text-lg">Videoer</strong>
                <small className="mt-1 block font-semibold text-slate-500">{videos.length} tilknyttet</small>
              </a>
              <a className="rounded-2xl border border-white/10 bg-[#08111f] p-4 hover:border-red-400/40" href="#dokumenter">
                <span className="text-2xl" aria-hidden="true">▤</span>
                <strong className="mt-3 block text-lg">Dokumenter</strong>
                <small className="mt-1 block font-semibold text-slate-500">{documents.length} tilknyttet</small>
              </a>
            </div>
            {isEditor ? (
              <div className="mt-5 flex flex-wrap gap-2">
                <Link className="app-button-primary" href={`/admin/operativ-portal/videoer?itemId=${item.id}&placeId=${item.placeId}&vehicleId=${item.vehicleId}`}>Tilføj video</Link>
                <Link className="app-button-secondary" href={`/admin/operativ-portal/dokumenter?itemId=${item.id}&placeId=${item.placeId}&vehicleId=${item.vehicleId}`}>Upload dokument</Link>
              </div>
            ) : null}
          </OperationalPanel>
        </section>

        <section id="videoer" className="scroll-mt-24">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div><p className="text-xs font-black uppercase tracking-[0.16em] text-red-300">Instruktion</p><h2 className="mt-1 text-3xl font-black">Videoer</h2></div>
          </div>
          <div className="mt-5 grid gap-5 md:grid-cols-2">
            {videos.map((video) => (
              <article className="overflow-hidden rounded-[1.5rem] border border-white/10 bg-[#101b2c] shadow-xl" key={video.id}>
                <iframe allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen className="aspect-video w-full" loading="lazy" src={youtubeEmbedUrl(video.youtubeId)} title={video.title} />
                <div className="p-5"><p className="text-xs font-black uppercase tracking-[0.14em] text-red-300">{video.category}</p><h3 className="mt-2 text-xl font-black">{video.title}</h3><p className="mt-2 text-sm font-semibold leading-6 text-slate-400">{video.description || "Ingen beskrivelse."}</p></div>
              </article>
            ))}
            {videos.length === 0 ? <p className="rounded-[1.5rem] border border-dashed border-white/15 bg-white/5 p-8 font-semibold text-slate-400 md:col-span-2">Der er endnu ikke tilknyttet en video.</p> : null}
          </div>
        </section>

        <section id="dokumenter" className="scroll-mt-24">
          <div><p className="text-xs font-black uppercase tracking-[0.16em] text-red-300">Videnbank</p><h2 className="mt-1 text-3xl font-black">Dokumenter</h2><p className="mt-2 text-sm font-semibold text-slate-400">Filer knyttet direkte til {item.name}.</p></div>
          <div className="mt-5 overflow-hidden rounded-[1.5rem] border border-white/10 bg-[#101b2c] shadow-xl">
            {documents.map((document) => (
              <a className="grid grid-cols-[48px_minmax(0,1fr)_auto] items-center gap-3 border-b border-white/10 p-4 last:border-b-0 hover:bg-white/5" href={`/api/admin/operativ-portal/dokumenter/${document.id}`} key={document.id} target="_blank">
                <span className="grid size-12 place-items-center rounded-xl bg-red-600 text-[10px] font-black text-white">FIL</span>
                <span className="min-w-0"><strong className="block truncate">{document.title}</strong><small className="mt-1 block truncate text-slate-500">{document.category} · {contentLocationLabel(document)}</small></span>
                <span className="text-xs font-black text-red-300">Åbn</span>
              </a>
            ))}
            {documents.length === 0 ? <p className="p-8 text-center text-sm font-semibold text-slate-400">Ingen dokumenter tilknyttet endnu.</p> : null}
          </div>
        </section>
      </OperationalPageFrame>
    </>
  );
}

function HeroStat({ label, value }: { label: string; value: number }) {
  return <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-center"><p className="text-2xl font-black">{value}</p><p className="mt-1 text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">{label}</p></div>;
}

function Fact({ label, value }: { label: string; value: string }) {
  return <div className="grid grid-cols-[90px_minmax(0,1fr)] gap-3 border-t border-white/10 pt-3 first:border-t-0 first:pt-0"><dt className="text-sm font-bold text-slate-500">{label}</dt><dd className="m-0 text-sm font-black text-white">{value}</dd></div>;
}
