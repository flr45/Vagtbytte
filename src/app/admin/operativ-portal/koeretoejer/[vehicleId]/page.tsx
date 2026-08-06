import Link from "next/link";
import { notFound } from "next/navigation";
import { UserRole } from "@prisma/client";
import { OperationalDocumentUploadForm } from "@/components/OperationalDocumentUploadForm";
import { OperationalImageManager } from "@/components/OperationalImageManager";
import { OperationalPortalNav } from "@/components/OperationalPortalNav";
import { TopBar } from "@/components/TopBar";
import { requireRole } from "@/lib/auth";
import { createOperationalPlaceAction, deleteOperationalDocumentAction, updateOperationalVehicleAction } from "@/lib/operativ-portal-actions";
import { getOperationalVehicle, operationalImageUrl, youtubeEmbedUrl } from "@/lib/operativ-portal";

export const dynamic = "force-dynamic";
type PageProps = { params: Promise<{ vehicleId: string }> };

export default async function OperationalVehiclePage({ params }: PageProps) {
  await requireRole(UserRole.ADMIN);
  const { vehicleId } = await params;
  const vehicle = await getOperationalVehicle(vehicleId);
  if (!vehicle) notFound();

  return (
    <>
      <TopBar title={vehicle.name} />
      <main className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-6">
        <OperationalPortalNav />
        <nav className="flex flex-wrap items-center gap-2 text-sm font-semibold text-zinc-600"><Link href="/admin/operativ-portal/koeretoejer">Køretøjer</Link><span>›</span><strong className="text-zinc-950">{vehicle.name}</strong></nav>

        <section className="overflow-hidden rounded-2xl bg-zinc-950 text-white shadow-sm lg:grid lg:grid-cols-[minmax(0,1.15fr)_minmax(340px,.85fr)]">
          {vehicle.coverImageId ? <img alt={vehicle.name} className="min-h-72 h-full w-full bg-zinc-900 object-cover" src={operationalImageUrl(vehicle.coverImageId)} /> : <div className="grid min-h-72 place-items-center bg-zinc-900 text-5xl font-black">{vehicle.name.slice(0, 3).toUpperCase()}</div>}
          <div className="p-6 sm:p-8"><p className="text-xs font-black uppercase tracking-[0.16em] text-red-400">Køretøj · Kun administratorer</p><h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">{vehicle.name}</h1><p className="mt-3 text-sm font-semibold leading-6 text-zinc-300">{vehicle.description || "Der er endnu ikke tilføjet en beskrivelse."}</p><div className="mt-5 flex flex-wrap gap-2 text-xs font-black"><span className="rounded-full bg-white/10 px-3 py-2">{vehicle.placeCount} rum</span><span className="rounded-full bg-white/10 px-3 py-2">{vehicle.itemCount} udstyr</span><span className="rounded-full bg-white/10 px-3 py-2">{vehicle.imageCount} billeder</span><span className="rounded-full bg-white/10 px-3 py-2">{vehicle.documentCount} dokumenter</span><span className="rounded-full bg-white/10 px-3 py-2">{vehicle.videoCount} videoer</span></div></div>
        </section>

        <details className="rounded-2xl border border-red-200 bg-red-50 p-5"><summary className="cursor-pointer text-lg font-black text-red-950">Redigér køretøjet og tilføj rum</summary><div className="mt-5 grid gap-5 lg:grid-cols-2">
          <form action={updateOperationalVehicleAction} className="grid gap-4 rounded-xl bg-white p-4"><input name="vehicleId" type="hidden" value={vehicle.id} /><label className="grid gap-2 text-sm font-bold text-zinc-700">Navn<input className="focus-ring min-h-12 rounded-xl border border-zinc-200 px-4" defaultValue={vehicle.name} name="name" required /></label><label className="grid gap-2 text-sm font-bold text-zinc-700">Beskrivelse<textarea className="focus-ring min-h-32 rounded-xl border border-zinc-200 p-4" defaultValue={vehicle.description} name="description" /></label><button className="app-button-primary" type="submit">Gem køretøj</button></form>
          <form action={createOperationalPlaceAction} className="grid content-start gap-4 rounded-xl bg-white p-4"><input name="vehicleId" type="hidden" value={vehicle.id} /><h2 className="text-lg font-black">Tilføj rum eller område</h2><label className="grid gap-2 text-sm font-bold text-zinc-700">Navn<input className="focus-ring min-h-12 rounded-xl border border-zinc-200 px-4" name="name" placeholder="Fx Venstre side, rum 1" required /></label><button className="app-button-primary" type="submit">Tilføj rum</button></form>
        </div></details>

        <OperationalImageManager description="Upload oversigtsbilleder af køretøjet. Det valgte forsidebillede bruges på dashboardet og køretøjsoversigten." images={vehicle.images} title={`Billeder af ${vehicle.name}`} vehicleId={vehicle.id} />

        <section><div className="flex items-end justify-between gap-4"><div><h2 className="text-2xl font-black">Rum og områder</h2><p className="mt-1 text-sm font-semibold text-zinc-600">Vælg et rum for at åbne den visuelle pakkeliste.</p></div></div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {vehicle.places.map((place, index) => <Link className="group overflow-hidden rounded-2xl border border-brand-line bg-white shadow-sm hover:border-red-300 hover:shadow-md" href={`/admin/operativ-portal/rum/${place.id}`} key={place.id}>{place.coverImageId ? <img alt={place.name} className="aspect-[4/3] w-full bg-zinc-100 object-cover" src={operationalImageUrl(place.coverImageId)} /> : <div className="grid aspect-[4/3] place-items-center bg-zinc-100 text-3xl font-black text-zinc-400">{String(index + 1).padStart(2, "0")}</div>}<div className="p-4"><strong className="block text-lg">{place.name}</strong><small className="mt-1 block text-zinc-500">{place.itemCount} udstyrsposter · {place.imageCount} billeder</small><span className="mt-3 block text-xs font-black text-brand-red">Åbn rum</span></div></Link>)}
            {vehicle.places.length === 0 ? <p className="rounded-xl border border-dashed border-zinc-300 bg-white p-6 font-semibold text-zinc-600 sm:col-span-2 lg:col-span-3">Brug redigeringspanelet til at oprette det første rum.</p> : null}
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-brand-line bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><div><h2 className="text-xl font-black">Dokumenter</h2><p className="mt-1 text-sm font-semibold text-zinc-600">Filer knyttet til {vehicle.name}.</p></div><Link className="app-button-secondary" href="/admin/operativ-portal/dokumenter">Alle</Link></div><div className="mt-4 grid gap-2">{vehicle.documents.slice(0, 6).map((document) => <div className="flex items-center gap-3 rounded-xl border border-zinc-200 p-3" key={document.id}><a className="min-w-0 flex-1" href={`/api/admin/operativ-portal/dokumenter/${document.id}`} target="_blank"><strong className="block truncate text-sm">{document.title}</strong><small className="text-zinc-500">{document.originalName}</small></a><form action={deleteOperationalDocumentAction}><input name="documentId" type="hidden" value={document.id} /><button className="app-button-danger px-3 text-xs" type="submit">Slet</button></form></div>)}{vehicle.documents.length === 0 ? <p className="rounded-xl bg-zinc-50 p-4 text-sm font-semibold text-zinc-600">Ingen dokumenter endnu.</p> : null}</div><details className="mt-4 rounded-xl border border-zinc-200 p-4"><summary className="cursor-pointer font-black">Upload dokument</summary><div className="mt-4"><OperationalDocumentUploadForm defaultVehicleId={vehicle.id} vehicles={[{ id: vehicle.id, name: vehicle.name }]} /></div></details></div>
          <div className="rounded-2xl border border-brand-line bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><div><h2 className="text-xl font-black">Instruktionsvideoer</h2><p className="mt-1 text-sm font-semibold text-zinc-600">Videoer knyttet til køretøjet.</p></div><Link className="app-button-secondary" href={`/admin/operativ-portal/videoer?vehicleId=${vehicle.id}`}>Tilføj</Link></div><div className="mt-4 grid gap-4">{vehicle.videos.slice(0, 3).map((video) => <article className="overflow-hidden rounded-xl border border-zinc-200" key={video.id}><iframe allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen className="aspect-video w-full" loading="lazy" src={youtubeEmbedUrl(video.youtubeId)} title={video.title} /><div className="p-4"><strong>{video.title}</strong><p className="mt-1 text-sm text-zinc-600">{video.description || video.category}</p></div></article>)}{vehicle.videos.length === 0 ? <p className="rounded-xl bg-zinc-50 p-4 text-sm font-semibold text-zinc-600">Ingen videoer tilknyttet endnu.</p> : null}</div></div>
        </section>
      </main>
    </>
  );
}
