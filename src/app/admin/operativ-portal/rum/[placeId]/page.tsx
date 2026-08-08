import Link from "next/link";
import { notFound } from "next/navigation";
import { AppIcon } from "@/components/AppIcon";
import { OperationalImageManager } from "@/components/OperationalImageManager";
import {
  OperationalPageFrame,
  OperationalPanel,
  OperationalPortalNav,
  OperationalScreenHeader,
  OperationalTabs
} from "@/components/OperationalPortalNav";
import {
  canManageOperationalPortal,
  requireOperationalPortalAccess
} from "@/lib/auth";
import { createOperationalItemAction } from "@/lib/operativ-portal-actions";
import { updateOperationalPlaceDetailsAction } from "@/lib/operativ-portal-content-actions";
import { contentLocationLabel } from "@/lib/operativ-portal-content";
import {
  listOperationalPlaceDocuments,
  listOperationalPlaceVideos
} from "@/lib/operativ-place-content";
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
  const [place, documents, videos] = await Promise.all([
    getOperationalPlace(placeId),
    listOperationalPlaceDocuments(placeId),
    listOperationalPlaceVideos(placeId)
  ]);
  if (!place) notFound();

  return (
    <OperationalPageFrame>
      <OperationalScreenHeader backHref={`/admin/operativ-portal/koeretoejer/${place.vehicleId}`} title={place.name} />
      <OperationalPortalNav isEditor={isEditor} />

      <section className="overflow-hidden rounded-xl border border-white/10 bg-[#0b1013]">
        {place.coverImageId ? (
          <img alt={place.name} className="aspect-[16/10] w-full bg-[#161c20] object-cover" src={operationalImageUrl(place.coverImageId)} />
        ) : (
          <div className="grid aspect-[16/10] place-items-center bg-gradient-to-br from-[#2a3136] to-[#111518] text-4xl font-black text-slate-600">RUM</div>
        )}
        <OperationalTabs items={[
          { href: "#overblik", label: "Overblik", active: true },
          { href: "#indhold", label: "Indhold" },
          { href: "#videoer", label: "Videoer" },
          { href: "#dokumenter", label: "Dokumenter" }
        ]} />
        <div id="overblik" className="p-4">
          <h1 className="text-lg font-black">{place.name} · {place.vehicleName}</h1>
          <p className="mt-2 text-sm font-medium leading-6 text-slate-400">
            {place.description || `Indeholder ${place.items.length} registrerede udstyrsposter med billeder, placering og instruktion.`}
          </p>
          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            <Link className="flex min-h-12 items-center justify-center gap-2 rounded-lg bg-red-600 px-4 text-sm font-black text-white hover:bg-red-700" href={`/admin/operativ-portal/rum/${place.id}/interaktiv`}>
              <AppIcon className="size-5" name="activity" /> Interaktivt overblik
            </Link>
            {isEditor ? (
              <Link className="flex min-h-12 items-center justify-center gap-2 rounded-lg border border-red-600 bg-red-600/10 px-4 text-sm font-black text-red-400 hover:bg-red-600/20" href={`/admin/operativ-portal/rum/${place.id}/byg`}>
                <AppIcon className="size-5" name="edit" /> Redigér interaktiv struktur
              </Link>
            ) : (
              <a className="flex min-h-12 items-center justify-center gap-2 rounded-lg border border-red-600 px-4 text-sm font-black text-red-500 hover:bg-red-600/10" href="#indhold">Se liste over indhold</a>
            )}
          </div>
        </div>
      </section>

      <section id="indhold" className="scroll-mt-20">
        <div className="mb-2 flex items-center justify-between px-1"><h2 className="text-sm font-black">{place.name} – Indhold</h2><span className="text-xs font-bold text-slate-500">{place.items.length} poster</span></div>
        <div className="grid gap-2">
          {place.items.map((item) => (
            <Link className="grid min-h-[72px] grid-cols-[68px_minmax(0,1fr)_22px] items-center gap-3 rounded-lg border border-white/5 bg-[#11171b] p-2 hover:bg-[#161e23]" href={`/admin/operativ-portal/udstyr/${item.id}`} key={item.id}>
              {item.coverImageId ? <img alt={item.name} className="h-14 w-[68px] rounded-md bg-[#20272c] object-cover" src={operationalImageUrl(item.coverImageId)} /> : <div className="grid h-14 w-[68px] place-items-center rounded-md bg-[#20272c] text-xs font-black text-slate-600">UD</div>}
              <span className="min-w-0">
                <span className="flex items-center gap-2"><strong className="block truncate text-sm">{item.name}</strong>{item.quantity > 1 ? <small className="rounded bg-red-600 px-1.5 py-0.5 text-[9px] font-black text-white">×{item.quantity}</small> : null}</span>
                <small className="mt-1 block truncate text-xs text-slate-500">{item.note || item.specifications.split("\n")[0] || `Antal: ${item.quantity}`}</small>
              </span>
              <AppIcon className="size-5 text-slate-500" name="chevronRight" />
            </Link>
          ))}
          {place.items.length === 0 ? <p className="rounded-lg border border-dashed border-white/15 bg-white/5 p-7 text-center text-sm text-slate-500">Ingen udstyrsposter i rummet.</p> : null}
        </div>
      </section>

      <section id="videoer" className="scroll-mt-20">
        <h2 className="mb-3 text-sm font-black">Videoer</h2>
        <div className="grid gap-3 md:grid-cols-2">
          {videos.slice(0, 4).map((video) => <article className="overflow-hidden rounded-lg border border-white/10 bg-[#11171b]" key={video.id}><iframe allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen className="aspect-video w-full" loading="lazy" src={youtubeEmbedUrl(video.youtubeId)} title={video.title} /><div className="p-3"><strong className="text-sm">{video.title}</strong><p className="mt-1 text-xs text-slate-500">{video.description || video.category}</p></div></article>)}
          {videos.length === 0 ? <p className="rounded-lg bg-[#11171b] p-4 text-sm text-slate-500">Ingen videoer tilknyttet.</p> : null}
        </div>
      </section>

      <OperationalPanel className="scroll-mt-20">
        <div id="dokumenter" className="flex items-center justify-between"><h2 className="text-sm font-black">Dokumenter</h2>{isEditor ? <Link className="text-xs font-bold text-red-500" href={`/admin/operativ-portal/dokumenter?vehicleId=${place.vehicleId}&placeId=${place.id}`}>Tilføj</Link> : null}</div>
        <div className="mt-3 grid gap-2">
          {documents.map((document) => <a className="grid grid-cols-[38px_minmax(0,1fr)_20px] items-center gap-2 rounded-lg bg-[#151b1f] p-2.5" href={`/api/admin/operativ-portal/dokumenter/${document.id}`} key={document.id} target="_blank"><span className="grid size-9 place-items-center rounded bg-[#c71019] text-white"><AppIcon className="size-4" name="document" /></span><span className="min-w-0"><strong className="block truncate text-xs">{document.title}</strong><small className="block truncate text-[10px] text-slate-500">{document.category} · {contentLocationLabel(document)}</small></span><AppIcon className="size-4 text-slate-500" name="chevronRight" /></a>)}
          {documents.length === 0 ? <p className="text-sm text-slate-500">Ingen dokumenter tilknyttet.</p> : null}
        </div>
      </OperationalPanel>

      {isEditor ? (
        <details className="rounded-lg border border-red-500/20 bg-red-500/5 p-4" open>
          <summary className="cursor-pointer text-sm font-black text-red-400">Administration af rum</summary>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <form action={updateOperationalPlaceDetailsAction} className="grid gap-3 rounded-lg bg-[#0d1317] p-4">
              <input name="placeId" type="hidden" value={place.id} />
              <Field label="Navn"><input className="dark-input" defaultValue={place.name} name="name" required /></Field>
              <Field label="Beskrivelse"><textarea className="dark-input min-h-24 p-3" defaultValue={place.description} name="description" /></Field>
              <Field label="Rækkefølge"><input className="dark-input" defaultValue={place.sortOrder} min="0" name="sortOrder" type="number" /></Field>
              <button className="app-button-primary" type="submit">Gem rum</button>
            </form>

            <form action={createOperationalItemAction} className="grid gap-3 rounded-lg bg-[#0d1317] p-4">
              <input name="placeId" type="hidden" value={place.id} />
              <h2 className="text-sm font-black">Tilføj udstyr</h2>
              <Field label="Navn"><input className="dark-input" name="name" placeholder="Fx Højtryksslange (HT)" required /></Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Antal"><input className="dark-input" defaultValue="1" min="1" name="quantity" required type="number" /></Field>
                <Field label="Rækkefølge"><input className="dark-input" defaultValue={place.items.length} min="0" name="sortOrder" type="number" /></Field>
              </div>
              <Field label="Kort beskrivelse / note"><textarea className="dark-input min-h-20 p-3" name="note" /></Field>
              <Field label="Specifikationer"><textarea className="dark-input min-h-24 p-3" name="specifications" placeholder={'Fx:\nLængde: 60 m\nMaks. tryk: 200 bar'} /></Field>
              <button className="app-button-primary" type="submit">Tilføj udstyr</button>
            </form>
          </div>

          <div className="mt-4 rounded-xl border border-red-500/20 bg-[#0d1317] p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-red-400">Interaktiv opbygning</p>
            <h2 className="mt-1 text-lg font-black">Rum → underområde → værktøj</h2>
            <p className="mt-2 max-w-3xl text-xs font-semibold leading-5 text-slate-500">Den interaktive editor er det eneste sted, hvor pluspunkter og underområder kobles sammen på billeder. Hvert underområde kan have sit eget billede.</p>
            <Link className="mt-4 flex min-h-12 items-center justify-center gap-2 rounded-lg bg-red-600 px-4 text-sm font-black text-white hover:bg-red-700" href={`/admin/operativ-portal/rum/${place.id}/byg`}>
              <AppIcon className="size-5" name="edit" /> Redigér interaktiv struktur
            </Link>
          </div>
        </details>
      ) : null}

      {isEditor ? <OperationalImageManager description="Upload billeder af rummet, hylder og kasser. De kan genbruges direkte i den interaktive editor." images={place.images} placeId={place.id} title={`Billeder af ${place.name}`} vehicleId={place.vehicleId} /> : null}
    </OperationalPageFrame>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="grid gap-1.5 text-xs font-bold text-slate-300">{label}{children}</label>;
}
