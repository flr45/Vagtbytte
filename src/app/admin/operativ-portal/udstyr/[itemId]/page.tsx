import Link from "next/link";
import { notFound } from "next/navigation";
import { UserRole } from "@prisma/client";
import { OperationalImageManager } from "@/components/OperationalImageManager";
import { OperationalPortalNav } from "@/components/OperationalPortalNav";
import { TopBar } from "@/components/TopBar";
import { requireRole } from "@/lib/auth";
import { updateOperationalItemDetailsAction } from "@/lib/operativ-portal-content-actions";
import { contentLocationLabel, listManagedOperationalDocuments, listManagedOperationalVideos } from "@/lib/operativ-portal-content";
import { getOperationalItem, operationalImageUrl, youtubeEmbedUrl } from "@/lib/operativ-portal";

export const dynamic = "force-dynamic";
type PageProps = { params: Promise<{ itemId: string }> };

export default async function OperationalItemPage({ params }: PageProps) {
  await requireRole(UserRole.ADMIN);
  const { itemId } = await params;
  const [item, allDocuments, allVideos] = await Promise.all([getOperationalItem(itemId), listManagedOperationalDocuments(), listManagedOperationalVideos()]);
  if (!item) notFound();
  const documents = allDocuments.filter((document) => document.itemId === item.id);
  const videos = allVideos.filter((video) => video.itemId === item.id);

  return (
    <><TopBar title={item.name} /><main className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-6"><OperationalPortalNav />
      <nav className="flex flex-wrap items-center gap-2 text-sm font-semibold text-zinc-600"><Link href="/admin/operativ-portal/koeretoejer">Køretøjer</Link><span>›</span><Link href={`/admin/operativ-portal/koeretoejer/${item.vehicleId}`}>{item.vehicleName}</Link><span>›</span><Link href={`/admin/operativ-portal/rum/${item.placeId}`}>{item.placeName}</Link><span>›</span><strong className="text-zinc-950">{item.name}</strong></nav>

      <section className="overflow-hidden rounded-2xl bg-zinc-950 text-white shadow-sm lg:grid lg:grid-cols-[minmax(0,1.05fr)_minmax(360px,.95fr)]">
        {item.coverImageId ? <img alt={item.name} className="min-h-80 h-full w-full bg-zinc-900 object-contain" src={operationalImageUrl(item.coverImageId)} /> : <div className="grid min-h-80 place-items-center bg-zinc-900 text-5xl font-black text-zinc-600">UD</div>}
        <div className="p-6 sm:p-8"><p className="text-xs font-black uppercase tracking-[0.16em] text-red-400">Udstyr · {item.vehicleName}</p><h1 className="mt-2 text-3xl font-black sm:text-4xl">{item.name}</h1><p className="mt-3 text-sm font-semibold text-zinc-300">Placeret i {item.placeName}.</p><div className="mt-5 flex flex-wrap gap-2 text-xs font-black"><span className="rounded-full bg-white/10 px-3 py-2">Antal {item.quantity}</span><span className="rounded-full bg-white/10 px-3 py-2">{item.images.length} billeder</span><span className="rounded-full bg-white/10 px-3 py-2">{videos.length} videoer</span><span className="rounded-full bg-white/10 px-3 py-2">{documents.length} dokumenter</span></div>{item.note ? <p className="mt-5 rounded-xl bg-white/10 p-4 text-sm font-semibold text-zinc-200">{item.note}</p> : null}</div>
      </section>

      <details className="rounded-2xl border border-red-200 bg-red-50 p-5"><summary className="cursor-pointer text-lg font-black text-red-950">Redigér udstyr</summary><form action={updateOperationalItemDetailsAction} className="mt-5 grid gap-4 rounded-xl bg-white p-4 md:grid-cols-[minmax(0,1fr)_120px]"><input name="itemId" type="hidden" value={item.id} /><label className="grid gap-2 text-sm font-bold text-zinc-700">Navn<input className="focus-ring min-h-12 rounded-xl border border-zinc-200 px-4" defaultValue={item.name} name="name" required /></label><label className="grid gap-2 text-sm font-bold text-zinc-700">Antal<input className="focus-ring min-h-12 rounded-xl border border-zinc-200 px-4" defaultValue={item.quantity} min="1" name="quantity" required type="number" /></label><label className="grid gap-2 text-sm font-bold text-zinc-700 md:col-span-2">Note<textarea className="focus-ring min-h-24 rounded-xl border border-zinc-200 p-4" defaultValue={item.note} name="note" placeholder="Placering, kontrolpunkt eller bemærkning" /></label><button className="app-button-primary md:w-fit" type="submit">Gem udstyr</button></form></details>

      <OperationalImageManager description="Upload genkendelige billeder af udstyret, betjeningspunkter eller korrekt placering. Forsidebilledet vises i rummets visuelle pakkeliste." images={item.images} itemId={item.id} placeId={item.placeId} title={`Billeder af ${item.name}`} vehicleId={item.vehicleId} />

      <section className="grid gap-4 md:grid-cols-2"><div className="rounded-2xl border border-brand-line bg-white p-5 shadow-sm"><h2 className="text-xl font-black">Registrerede oplysninger</h2><dl className="mt-4 grid gap-3"><Fact label="Køretøj" value={item.vehicleName} /><Fact label="Placering" value={item.placeName} /><Fact label="Antal" value={String(item.quantity)} /><Fact label="Note" value={item.note || "Ingen note tilføjet"} /></dl></div><div className="rounded-2xl border border-brand-line bg-white p-5 shadow-sm"><p className="text-xs font-black uppercase tracking-[0.13em] text-brand-red">Indhold</p><h2 className="mt-1 text-xl font-black">Instruktion og dokumentation</h2><p className="mt-2 text-sm font-semibold text-zinc-600">Tilknyt læringsvideoer, manualer, kontrolskemaer og andre filer direkte til udstyret.</p><div className="mt-5 flex flex-wrap gap-2"><Link className="app-button-primary" href={`/admin/operativ-portal/videoer?itemId=${item.id}&placeId=${item.placeId}&vehicleId=${item.vehicleId}`}>Tilføj video</Link><Link className="app-button-secondary" href={`/admin/operativ-portal/dokumenter?itemId=${item.id}&placeId=${item.placeId}&vehicleId=${item.vehicleId}`}>Upload dokument</Link></div></div></section>

      <section><h2 className="text-2xl font-black">Videoer</h2><div className="mt-4 grid gap-4 md:grid-cols-2">{videos.map((video) => <article className="overflow-hidden rounded-2xl border border-brand-line bg-white shadow-sm" key={video.id}><iframe allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen className="aspect-video w-full" loading="lazy" src={youtubeEmbedUrl(video.youtubeId)} title={video.title} /><div className="p-4"><p className="text-xs font-black uppercase tracking-[0.12em] text-brand-red">{video.category}</p><h3 className="mt-1 text-lg font-black">{video.title}</h3><p className="mt-2 text-sm text-zinc-600">{video.description || "Ingen beskrivelse."}</p></div></article>)}{videos.length === 0 ? <p className="rounded-2xl border border-dashed border-zinc-300 bg-white p-8 font-semibold text-zinc-600 md:col-span-2">Der er endnu ikke tilknyttet en video.</p> : null}</div></section>

      <section><div className="flex items-end justify-between gap-4"><div><h2 className="text-2xl font-black">Dokumenter</h2><p className="mt-1 text-sm font-semibold text-zinc-600">Filer knyttet direkte til {item.name}.</p></div></div><div className="mt-4 overflow-hidden rounded-2xl border border-brand-line bg-white shadow-sm">{documents.map((document) => <a className="grid grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-3 border-b border-zinc-100 p-4 last:border-b-0 hover:bg-red-50" href={`/api/admin/operativ-portal/dokumenter/${document.id}`} key={document.id} target="_blank"><span className="grid size-11 place-items-center rounded-lg bg-zinc-950 text-[9px] font-black text-white">FIL</span><span className="min-w-0"><strong className="block truncate">{document.title}</strong><small className="block truncate text-zinc-500">{document.category} · {contentLocationLabel(document)}</small></span><span className="text-xs font-black text-brand-red">Åbn</span></a>)}{documents.length === 0 ? <p className="p-8 text-center text-sm font-semibold text-zinc-600">Ingen dokumenter tilknyttet endnu.</p> : null}</div></section>
    </main></>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return <div className="grid grid-cols-[100px_minmax(0,1fr)] gap-3 border-t border-zinc-100 pt-3 first:border-t-0 first:pt-0"><dt className="text-sm font-bold text-zinc-500">{label}</dt><dd className="m-0 text-sm font-black text-zinc-900">{value}</dd></div>;
}
