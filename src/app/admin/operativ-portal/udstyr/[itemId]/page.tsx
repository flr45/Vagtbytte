import Link from "next/link";
import { notFound } from "next/navigation";
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
  const specificationLines = item.specifications.split("\n").map((line) => line.trim()).filter(Boolean);

  return (
    <OperationalPageFrame>
      <OperationalScreenHeader backHref={`/admin/operativ-portal/rum/${item.placeId}`} title={item.name} />
      <OperationalPortalNav isEditor={isEditor} />

      <section className="overflow-hidden rounded-xl border border-white/10 bg-[#0b1013]">
        {item.coverImageId ? (
          <img alt={item.name} className="aspect-[16/10] w-full bg-[#161c20] object-contain" src={operationalImageUrl(item.coverImageId)} />
        ) : (
          <div className="grid aspect-[16/10] place-items-center bg-gradient-to-br from-[#2a3136] to-[#111518] text-5xl font-black text-slate-600">UD</div>
        )}
        <OperationalTabs items={[
          { href: "#overblik", label: "Overblik", active: true },
          { href: "#video", label: "Video" },
          { href: "#dokumenter", label: "Dokumenter" }
        ]} />
        <div id="overblik" className="p-4">
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-red-500">{item.vehicleName} · {item.placeName}</p>
          <div className="mt-1 flex items-start justify-between gap-3">
            <h1 className="text-2xl font-black">{item.name}</h1>
            <span className="rounded bg-red-600 px-2 py-1 text-[10px] font-black text-white">×{item.quantity}</span>
          </div>
          <p className="mt-4 text-xs font-black uppercase tracking-[0.12em] text-slate-300">Beskrivelse</p>
          <p className="mt-2 text-sm font-medium leading-6 text-slate-400">{item.note || "Der er endnu ikke tilføjet en beskrivelse til udstyret."}</p>

          {specificationLines.length > 0 ? (
            <div className="mt-5 border-t border-white/10 pt-4">
              <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-300">Specifikationer</p>
              <ul className="mt-3 grid gap-2 text-sm text-slate-400">
                {specificationLines.map((line, index) => <li className="flex gap-2" key={`${line}-${index}`}><span className="text-red-500">•</span><span>{line}</span></li>)}
              </ul>
            </div>
          ) : null}

          <div className="mt-5 border-t border-white/10 pt-4">
            <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-300">Registrerede oplysninger</p>
            <dl className="mt-3 grid gap-2 text-sm">
              <Fact label="Køretøj" value={item.vehicleName} />
              <Fact label="Placering" value={item.placeName} />
              <Fact label="Antal" value={String(item.quantity)} />
            </dl>
          </div>
        </div>
      </section>

      <section id="video" className="scroll-mt-20">
        {videos.length > 0 ? (
          <article className="overflow-hidden rounded-xl border border-white/10 bg-[#0d1317]">
            <iframe allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen className="aspect-video w-full" loading="lazy" src={youtubeEmbedUrl(videos[0].youtubeId)} title={videos[0].title} />
            <div className="p-4"><h2 className="text-base font-black">{videos[0].title}</h2><p className="mt-2 text-sm font-medium leading-6 text-slate-400">{videos[0].description || "Instruktionsvideo til udstyret."}</p></div>
          </article>
        ) : <p className="rounded-lg bg-[#11171b] p-4 text-sm text-slate-500">Ingen video tilknyttet endnu.</p>}

        {videos.length > 1 ? (
          <div className="mt-4">
            <h2 className="mb-2 text-sm font-black">Relaterede videoer</h2>
            <div className="grid gap-2">
              {videos.slice(1).map((video) => (
                <article className="grid grid-cols-[92px_minmax(0,1fr)_20px] items-center gap-3 rounded-lg bg-[#11171b] p-2" key={video.id}>
                  <div className="grid h-14 w-[92px] place-items-center rounded-md bg-[#20272c] text-xl text-red-500">▶</div>
                  <span className="min-w-0"><strong className="block truncate text-sm">{video.title}</strong><small className="mt-1 block truncate text-xs text-slate-500">{video.category}</small></span>
                  <span className="text-slate-500">›</span>
                </article>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      <OperationalPanel className="scroll-mt-20">
        <div id="dokumenter" className="flex items-center justify-between"><h2 className="text-sm font-black">Dokumenter</h2>{isEditor ? <Link className="text-xs font-bold text-red-500" href={`/admin/operativ-portal/dokumenter?itemId=${item.id}&placeId=${item.placeId}&vehicleId=${item.vehicleId}`}>Tilføj</Link> : null}</div>
        <div className="mt-3 grid gap-2">
          {documents.map((document) => <a className="grid grid-cols-[38px_minmax(0,1fr)_20px] items-center gap-2 rounded-lg bg-[#151b1f] p-2.5" href={`/api/admin/operativ-portal/dokumenter/${document.id}`} key={document.id} target="_blank"><span className="grid size-9 place-items-center rounded bg-[#c71019] text-[9px] font-black">FIL</span><span className="min-w-0"><strong className="block truncate text-xs">{document.title}</strong><small className="block truncate text-[10px] text-slate-500">{document.category} · {contentLocationLabel(document)}</small></span><span className="text-slate-500">›</span></a>)}
          {documents.length === 0 ? <p className="text-sm text-slate-500">Ingen dokumenter tilknyttet.</p> : null}
        </div>
      </OperationalPanel>

      {isEditor ? (
        <details className="rounded-lg border border-red-500/20 bg-red-500/5 p-4">
          <summary className="cursor-pointer text-sm font-black text-red-400">Administration af udstyr</summary>
          <form action={updateOperationalItemDetailsAction} className="mt-4 grid gap-3 rounded-lg bg-[#0d1317] p-4 md:grid-cols-[minmax(0,1fr)_120px_120px]">
            <input name="itemId" type="hidden" value={item.id} />
            <Field label="Navn"><input className="dark-input" defaultValue={item.name} name="name" required /></Field>
            <Field label="Antal"><input className="dark-input" defaultValue={item.quantity} min="1" name="quantity" required type="number" /></Field>
            <Field label="Rækkefølge"><input className="dark-input" defaultValue={item.sortOrder} min="0" name="sortOrder" required type="number" /></Field>
            <Field className="md:col-span-3" label="Beskrivelse / note"><textarea className="dark-input min-h-28 p-3" defaultValue={item.note} name="note" /></Field>
            <Field className="md:col-span-3" label="Specifikationer – én linje pr. punkt"><textarea className="dark-input min-h-32 p-3" defaultValue={item.specifications} name="specifications" placeholder={'Længde: 60 m\nDimension: 1/2”\nMaks. tryk: 200 bar'} /></Field>
            <button className="app-button-primary md:w-fit" type="submit">Gem udstyr</button>
          </form>
        </details>
      ) : null}

      {isEditor ? <OperationalImageManager description="Upload genkendelige billeder af udstyret." images={item.images} itemId={item.id} placeId={item.placeId} title={`Billeder af ${item.name}`} vehicleId={item.vehicleId} /> : null}
    </OperationalPageFrame>
  );
}

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return <label className={`grid gap-1.5 text-xs font-bold text-slate-300 ${className}`}>{label}{children}</label>;
}

function Fact({ label, value }: { label: string; value: string }) {
  return <div className="grid grid-cols-[86px_minmax(0,1fr)] gap-3 border-t border-white/5 pt-2 first:border-t-0 first:pt-0"><dt className="text-slate-500">{label}</dt><dd className="m-0 font-bold text-slate-200">{value}</dd></div>;
}
