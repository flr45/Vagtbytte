import Link from "next/link";
import { notFound } from "next/navigation";
import { UserRole } from "@prisma/client";
import { OperationalImageManager } from "@/components/OperationalImageManager";
import { OperationalPortalNav } from "@/components/OperationalPortalNav";
import { TopBar } from "@/components/TopBar";
import { requireRole } from "@/lib/auth";
import { createOperationalItemAction } from "@/lib/operativ-portal-actions";
import { updateOperationalPlaceDetailsAction } from "@/lib/operativ-portal-content-actions";
import { contentLocationLabel, listManagedOperationalDocuments, listManagedOperationalVideos } from "@/lib/operativ-portal-content";
import { getOperationalPlace, operationalImageUrl, youtubeEmbedUrl } from "@/lib/operativ-portal";

export const dynamic = "force-dynamic";
type PageProps = { params: Promise<{ placeId: string }> };

export default async function OperationalPlacePage({ params }: PageProps) {
  await requireRole(UserRole.ADMIN);
  const { placeId } = await params;
  const [place, allDocuments, allVideos] = await Promise.all([getOperationalPlace(placeId), listManagedOperationalDocuments(), listManagedOperationalVideos()]);
  if (!place) notFound();
  const documents = allDocuments.filter((document) => document.placeId === place.id);
  const videos = allVideos.filter((video) => video.placeId === place.id);

  return (
    <><TopBar title={place.name} /><main className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-6"><OperationalPortalNav />
      <nav className="flex flex-wrap items-center gap-2 text-sm font-semibold text-zinc-600"><Link href="/admin/operativ-portal/koeretoejer">Køretøjer</Link><span>›</span><Link href={`/admin/operativ-portal/koeretoejer/${place.vehicleId}`}>{place.vehicleName}</Link><span>›</span><strong className="text-zinc-950">{place.name}</strong></nav>

      <section className="overflow-hidden rounded-2xl bg-zinc-950 text-white shadow-sm lg:grid lg:grid-cols-[minmax(0,1.15fr)_minmax(330px,.85fr)]">
        {place.coverImageId ? <img alt={place.name} className="min-h-72 h-full w-full bg-zinc-900 object-cover" src={operationalImageUrl(place.coverImageId)} /> : <div className="grid min-h-72 place-items-center bg-zinc-900 text-4xl font-black text-zinc-500">RUM</div>}
        <div className="p-6 sm:p-8"><p className="text-xs font-black uppercase tracking-[0.16em] text-red-400">{place.vehicleName} · Rum</p><h1 className="mt-2 text-3xl font-black sm:text-4xl">{place.name}</h1><p className="mt-3 text-sm font-semibold text-zinc-300">Visuel pakkeliste og tilknyttet instruktion.</p><div className="mt-4 flex flex-wrap gap-2 text-xs font-black"><span className="rounded-full bg-white/10 px-3 py-2">{place.items.length} udstyr</span><span className="rounded-full bg-white/10 px-3 py-2">{place.images.length} billeder</span><span className="rounded-full bg-white/10 px-3 py-2">{videos.length} videoer</span><span className="rounded-full bg-white/10 px-3 py-2">{documents.length} dokumenter</span></div></div>
      </section>

      <details className="rounded-2xl border border-red-200 bg-red-50 p-5"><summary className="cursor-pointer text-lg font-black text-red-950">Redigér rum og tilføj udstyr</summary><div className="mt-5 grid gap-4 lg:grid-cols-[minmax(260px,.65fr)_minmax(0,1.35fr)]"><form action={updateOperationalPlaceDetailsAction} className="grid content-start gap-4 rounded-xl bg-white p-4"><input name="placeId" type="hidden" value={place.id} /><h2 className="font-black">Rumoplysninger</h2><label className="grid gap-2 text-sm font-bold text-zinc-700">Navn<input className="focus-ring min-h-12 rounded-xl border border-zinc-200 px-4" defaultValue={place.name} name="name" required /></label><button className="app-button-secondary" type="submit">Gem rumnavn</button></form><form action={createOperationalItemAction} className="grid gap-4 rounded-xl bg-white p-4 lg:grid-cols-[minmax(180px,1fr)_100px_minmax(220px,1.3fr)_auto] lg:items-end"><input name="placeId" type="hidden" value={place.id} /><label className="grid gap-2 text-sm font-bold text-zinc-700">Udstyr<input className="focus-ring min-h-12 rounded-xl border border-zinc-200 px-4" name="name" placeholder="Fx Højtryksslange (HT)" required /></label><label className="grid gap-2 text-sm font-bold text-zinc-700">Antal<input className="focus-ring min-h-12 rounded-xl border border-zinc-200 px-4" defaultValue="1" min="1" name="quantity" required type="number" /></label><label className="grid gap-2 text-sm font-bold text-zinc-700">Note<input className="focus-ring min-h-12 rounded-xl border border-zinc-200 px-4" name="note" placeholder="Placering eller bemærkning" /></label><button className="app-button-primary min-h-12" type="submit">Tilføj</button></form></div></details>

      <OperationalImageManager description="Upload et oversigtsbillede af det åbne rum og suppler med detaljebilleder. Forsidebilledet bruges på køretøjets rumoversigt." images={place.images} placeId={place.id} title={`Billeder af ${place.name}`} vehicleId={place.vehicleId} />

      <section><div className="flex flex-wrap items-end justify-between gap-4"><div><h2 className="text-2xl font-black">Visuel pakkeliste</h2><p className="mt-1 text-sm font-semibold text-zinc-600">Tryk på et billede for at åbne udstyrets side.</p></div><span className="rounded-full bg-zinc-950 px-4 py-2 text-xs font-black text-white">{place.items.length} poster</span></div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {place.items.map((item) => <Link className="group overflow-hidden rounded-2xl border border-brand-line bg-white shadow-sm hover:border-red-300 hover:shadow-md" href={`/admin/operativ-portal/udstyr/${item.id}`} key={item.id}><div className="relative">{item.coverImageId ? <img alt={item.name} className="aspect-[4/3] w-full bg-zinc-100 object-cover" src={operationalImageUrl(item.coverImageId)} /> : <div className="grid aspect-[4/3] place-items-center bg-zinc-100 text-3xl font-black text-zinc-300">UD</div>}<span className="absolute right-3 top-3 rounded-full bg-zinc-950/90 px-3 py-1.5 text-xs font-black text-white">× {item.quantity}</span></div><div className="p-4"><strong className="block text-lg">{item.name}</strong><p className="mt-1 line-clamp-2 min-h-10 text-sm text-zinc-600">{item.note || "Ingen note tilføjet"}</p><div className="mt-3 flex items-center justify-between text-xs font-bold text-zinc-500"><span>{item.imageCount} billeder</span><span className="text-brand-red">Åbn</span></div></div></Link>)}
          {place.items.length === 0 ? <p className="rounded-2xl border border-dashed border-zinc-300 bg-white p-8 font-semibold text-zinc-600 sm:col-span-2 lg:col-span-3">Rummet er tomt. Tilføj den første udstyrspost ovenfor.</p> : null}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2"><div className="rounded-2xl border border-brand-line bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><div><h2 className="text-xl font-black">Dokumenter</h2><p className="mt-1 text-sm font-semibold text-zinc-600">Filer knyttet til dette rum.</p></div><Link className="app-button-secondary" href={`/admin/operativ-portal/dokumenter?vehicleId=${place.vehicleId}&placeId=${place.id}`}>Tilføj</Link></div><div className="mt-4 grid gap-2">{documents.map((document) => <a className="rounded-xl border border-zinc-200 p-3 hover:bg-red-50" href={`/api/admin/operativ-portal/dokumenter/${document.id}`} key={document.id} target="_blank"><strong className="block text-sm">{document.title}</strong><small className="text-zinc-500">{document.category} · {contentLocationLabel(document)}</small></a>)}{documents.length === 0 ? <p className="rounded-xl bg-zinc-50 p-4 text-sm font-semibold text-zinc-600">Ingen dokumenter tilknyttet.</p> : null}</div></div><div className="rounded-2xl border border-brand-line bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><div><h2 className="text-xl font-black">Videoer</h2><p className="mt-1 text-sm font-semibold text-zinc-600">Instruktioner knyttet til rummet.</p></div><Link className="app-button-secondary" href={`/admin/operativ-portal/videoer?vehicleId=${place.vehicleId}&placeId=${place.id}`}>Tilføj</Link></div><div className="mt-4 grid gap-4">{videos.slice(0, 3).map((video) => <article className="overflow-hidden rounded-xl border border-zinc-200" key={video.id}><iframe allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen className="aspect-video w-full" loading="lazy" src={youtubeEmbedUrl(video.youtubeId)} title={video.title} /><div className="p-3"><strong>{video.title}</strong><p className="mt-1 text-sm text-zinc-600">{video.description || video.category}</p></div></article>)}{videos.length === 0 ? <p className="rounded-xl bg-zinc-50 p-4 text-sm font-semibold text-zinc-600">Ingen videoer tilknyttet.</p> : null}</div></div></section>
    </main></>
  );
}
