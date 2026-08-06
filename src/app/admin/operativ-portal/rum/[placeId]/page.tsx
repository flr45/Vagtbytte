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
import { createOperationalItemAction } from "@/lib/operativ-portal-actions";
import { updateOperationalPlaceDetailsAction } from "@/lib/operativ-portal-content-actions";
import {
  contentLocationLabel,
  listManagedOperationalDocuments,
  listManagedOperationalVideos
} from "@/lib/operativ-portal-content";
import {
  getOperationalPlace,
  operationalImageUrl,
  youtubeEmbedUrl
} from "@/lib/operativ-portal";

export const dynamic = "force-dynamic";
type PageProps = { params: Promise<{ placeId: string }> };

export default async function OperationalPlacePage({ params }: PageProps) {
  const user = await requireOperationalPortalAccess();
  const isEditor = canManageOperationalPortal(user);
  const { placeId } = await params;
  const [place, allDocuments, allVideos] = await Promise.all([
    getOperationalPlace(placeId),
    listManagedOperationalDocuments(),
    listManagedOperationalVideos()
  ]);
  if (!place) notFound();
  const documents = allDocuments.filter((document) => document.placeId === place.id);
  const videos = allVideos.filter((video) => video.placeId === place.id);

  return (
    <>
      <TopBar title={place.name} variant="operational" />
      <OperationalPageFrame>
        <OperationalPortalNav isEditor={isEditor} />
        <nav className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-400">
          <Link className="hover:text-white" href="/admin/operativ-portal/koeretoejer">Køretøjer</Link><span>›</span>
          <Link className="hover:text-white" href={`/admin/operativ-portal/koeretoejer/${place.vehicleId}`}>{place.vehicleName}</Link><span>›</span>
          <strong className="text-white">{place.name}</strong>
        </nav>

        <section className="overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#101b2c] shadow-2xl lg:grid lg:grid-cols-[minmax(0,1.15fr)_minmax(330px,.85fr)]">
          {place.coverImageId ? (
            <img alt={place.name} className="h-full min-h-72 w-full bg-slate-900 object-cover" src={operationalImageUrl(place.coverImageId)} />
          ) : (
            <div className="grid min-h-72 place-items-center bg-gradient-to-br from-[#24364f] to-[#08111f] text-5xl font-black text-white/20">RUM</div>
          )}
          <div className="p-6 sm:p-8">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-red-300">{place.vehicleName} · Placering</p>
            <h1 className="mt-3 text-4xl font-black sm:text-5xl">{place.name}</h1>
            <p className="mt-4 text-sm font-semibold leading-7 text-slate-300">Åbn materielkortene nedenfor for placering, antal og instruktion.</p>
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-2">
              <HeroStat label="Udstyr" value={place.items.length} />
              <HeroStat label="Billeder" value={place.images.length} />
              <HeroStat label="Videoer" value={videos.length} />
              <HeroStat label="Dokumenter" value={documents.length} />
            </div>
          </div>
        </section>

        {isEditor ? (
          <details className="rounded-2xl border border-red-400/20 bg-red-500/10 p-5">
            <summary className="cursor-pointer text-lg font-black text-red-100">Redigér rum og tilføj udstyr</summary>
            <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(260px,.65fr)_minmax(0,1.35fr)]">
              <form action={updateOperationalPlaceDetailsAction} className="grid content-start gap-4 rounded-2xl border border-white/10 bg-[#101b2c] p-4">
                <input name="placeId" type="hidden" value={place.id} />
                <h2 className="font-black">Rumoplysninger</h2>
                <label className="grid gap-2 text-sm font-bold text-slate-200">Navn<input className="focus-ring min-h-12 rounded-xl border border-white/10 bg-[#08111f] px-4 text-white" defaultValue={place.name} name="name" required /></label>
                <button className="app-button-secondary" type="submit">Gem rumnavn</button>
              </form>
              <form action={createOperationalItemAction} className="grid gap-4 rounded-2xl border border-white/10 bg-[#101b2c] p-4 lg:grid-cols-[minmax(180px,1fr)_100px_minmax(220px,1.3fr)_auto] lg:items-end">
                <input name="placeId" type="hidden" value={place.id} />
                <label className="grid gap-2 text-sm font-bold text-slate-200">Udstyr<input className="focus-ring min-h-12 rounded-xl border border-white/10 bg-[#08111f] px-4 text-white" name="name" placeholder="Fx Højtryksslange (HT)" required /></label>
                <label className="grid gap-2 text-sm font-bold text-slate-200">Antal<input className="focus-ring min-h-12 rounded-xl border border-white/10 bg-[#08111f] px-4 text-white" defaultValue="1" min="1" name="quantity" required type="number" /></label>
                <label className="grid gap-2 text-sm font-bold text-slate-200">Note<input className="focus-ring min-h-12 rounded-xl border border-white/10 bg-[#08111f] px-4 text-white" name="note" placeholder="Placering eller bemærkning" /></label>
                <button className="app-button-primary min-h-12" type="submit">Tilføj</button>
              </form>
            </div>
          </details>
        ) : null}

        {isEditor ? (
          <OperationalImageManager
            description="Upload et oversigtsbillede af det åbne rum og suppler med detaljebilleder."
            images={place.images}
            placeId={place.id}
            title={`Billeder af ${place.name}`}
            vehicleId={place.vehicleId}
          />
        ) : place.images.length > 1 ? (
          <OperationalPanel>
            <h2 className="text-2xl font-black">Billeder af rummet</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {place.images.map((image) => <img alt={image.altText || image.title} className="aspect-video w-full rounded-2xl object-cover" key={image.id} src={operationalImageUrl(image.id)} />)}
            </div>
          </OperationalPanel>
        ) : null}

        <section>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-red-300">Pakkeliste</p>
              <h2 className="mt-1 text-3xl font-black">Materiel i {place.name}</h2>
              <p className="mt-2 text-sm font-semibold text-slate-400">Tryk på et kort for billeder, betjening og dokumentation.</p>
            </div>
            <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-black text-slate-300">{place.items.length} poster</span>
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {place.items.map((item) => (
              <Link className="group overflow-hidden rounded-[1.5rem] border border-white/10 bg-[#101b2c] shadow-xl hover:border-red-400/40" href={`/admin/operativ-portal/udstyr/${item.id}`} key={item.id}>
                <div className="relative">
                  {item.coverImageId ? (
                    <img alt={item.name} className="aspect-[4/3] w-full bg-slate-900 object-cover transition group-hover:scale-[1.02]" src={operationalImageUrl(item.coverImageId)} />
                  ) : (
                    <div className="grid aspect-[4/3] place-items-center bg-gradient-to-br from-[#21324a] to-[#08111f] text-4xl font-black text-white/15">UD</div>
                  )}
                  <span className="absolute right-3 top-3 rounded-xl bg-red-600 px-3 py-2 text-xs font-black text-white shadow-lg">× {item.quantity}</span>
                </div>
                <div className="p-5">
                  <strong className="block text-xl">{item.name}</strong>
                  <p className="mt-2 line-clamp-2 min-h-11 text-sm font-semibold leading-6 text-slate-400">{item.note || "Ingen note tilføjet"}</p>
                  <div className="mt-4 flex items-center justify-between text-xs font-black text-slate-500"><span>{item.imageCount} billeder</span><span className="text-red-300">Åbn →</span></div>
                </div>
              </Link>
            ))}
            {place.items.length === 0 ? (
              <p className="rounded-[1.5rem] border border-dashed border-white/15 bg-white/5 p-10 text-center font-semibold text-slate-400 sm:col-span-2 lg:col-span-3">
                {isEditor ? "Rummet er tomt. Tilføj den første udstyrspost ovenfor." : "Der er endnu ikke registreret udstyr i rummet."}
              </p>
            ) : null}
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-2">
          <OperationalPanel>
            <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-red-300">Videnbank</p><h2 className="mt-1 text-2xl font-black">Dokumenter</h2></div>{isEditor ? <Link className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-black" href={`/admin/operativ-portal/dokumenter?vehicleId=${place.vehicleId}&placeId=${place.id}`}>Tilføj</Link> : null}</div>
            <div className="mt-4 grid gap-2">
              {documents.map((document) => <a className="rounded-xl border border-white/10 bg-[#08111f] p-4 hover:border-red-400/40" href={`/api/admin/operativ-portal/dokumenter/${document.id}`} key={document.id} target="_blank"><strong className="block text-sm">{document.title}</strong><small className="mt-1 block text-slate-500">{document.category} · {contentLocationLabel(document)}</small></a>)}
              {documents.length === 0 ? <p className="rounded-xl bg-white/5 p-4 text-sm font-semibold text-slate-400">Ingen dokumenter tilknyttet.</p> : null}
            </div>
          </OperationalPanel>
          <OperationalPanel>
            <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-red-300">Instruktion</p><h2 className="mt-1 text-2xl font-black">Videoer</h2></div>{isEditor ? <Link className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-black" href={`/admin/operativ-portal/videoer?vehicleId=${place.vehicleId}&placeId=${place.id}`}>Tilføj</Link> : null}</div>
            <div className="mt-4 grid gap-4">
              {videos.slice(0, 3).map((video) => <article className="overflow-hidden rounded-2xl border border-white/10 bg-[#08111f]" key={video.id}><iframe allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen className="aspect-video w-full" loading="lazy" src={youtubeEmbedUrl(video.youtubeId)} title={video.title} /><div className="p-4"><strong>{video.title}</strong><p className="mt-1 text-sm text-slate-400">{video.description || video.category}</p></div></article>)}
              {videos.length === 0 ? <p className="rounded-xl bg-white/5 p-4 text-sm font-semibold text-slate-400">Ingen videoer tilknyttet.</p> : null}
            </div>
          </OperationalPanel>
        </section>
      </OperationalPageFrame>
    </>
  );
}

function HeroStat({ label, value }: { label: string; value: number }) {
  return <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-center"><p className="text-2xl font-black">{value}</p><p className="mt-1 text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">{label}</p></div>;
}
