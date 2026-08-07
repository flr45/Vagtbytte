import Link from "next/link";
import {
  OperationalPageFrame,
  OperationalPortalNav,
  OperationalScreenHeader
} from "@/components/OperationalPortalNav";
import {
  canManageOperationalPortal,
  requireOperationalPortalAccess
} from "@/lib/auth";
import {
  contentLocationLabel,
  listManagedOperationalDocuments,
  listManagedOperationalVideos
} from "@/lib/operativ-portal-content";
import { searchOperationalPortal } from "@/lib/operativ-portal";

export const dynamic = "force-dynamic";
type PageProps = { searchParams: Promise<{ q?: string | string[] }> };

export default async function OperationalSearchPage({ searchParams }: PageProps) {
  const user = await requireOperationalPortalAccess();
  const isEditor = canManageOperationalPortal(user);
  const params = await searchParams;
  const q = Array.isArray(params.q) ? params.q[0] ?? "" : params.q ?? "";
  const [baseResults, allVideos, allDocuments] = await Promise.all([searchOperationalPortal(q), listManagedOperationalVideos(), listManagedOperationalDocuments()]);
  const query = q.trim().toLocaleLowerCase("da-DK");
  const videos = query ? allVideos.filter((video) => [video.title, video.description, video.category, video.vehicleName, video.placeName, video.itemName].filter(Boolean).join(" ").toLocaleLowerCase("da-DK").includes(query)).slice(0, 25) : [];
  const documents = query ? allDocuments.filter((document) => [document.title, document.description, document.category, document.originalName, document.vehicleName, document.placeName, document.itemName].filter(Boolean).join(" ").toLocaleLowerCase("da-DK").includes(query)).slice(0, 25) : [];
  const count = baseResults.vehicles.length + baseResults.places.length + baseResults.items.length + videos.length + documents.length;

  return (
    <OperationalPageFrame>
      <OperationalScreenHeader backHref="/admin/operativ-portal" right="" title="Søg" />
      <OperationalPortalNav isEditor={isEditor} />
      <form className="flex gap-2 rounded-lg bg-[#11171b] p-3" method="get"><input autoFocus className="dark-input min-w-0 flex-1" defaultValue={q} name="q" placeholder="Søg efter køretøj, rum eller udstyr" type="search" /><button className="grid min-w-12 place-items-center rounded-lg bg-[#c71019] px-3 text-xl font-black" type="submit">⌕</button></form>
      {q ? <p className="px-1 text-xs font-bold text-slate-500">{count} resultater for “{q}”</p> : null}
      {q ? <div className="grid gap-4">
        <ResultGroup title="Køretøjer">{baseResults.vehicles.map((item) => <ResultLink href={`/admin/operativ-portal/koeretoejer/${item.id}`} key={item.id} label={item.name} meta={item.description || "Køretøj"} />)}</ResultGroup>
        <ResultGroup title="Rum">{baseResults.places.map((item) => <ResultLink href={`/admin/operativ-portal/rum/${item.id}`} key={item.id} label={item.name} meta={item.vehicleName} />)}</ResultGroup>
        <ResultGroup title="Udstyr">{baseResults.items.map((item) => <ResultLink href={`/admin/operativ-portal/udstyr/${item.id}`} key={item.id} label={item.name} meta={`${item.vehicleName} · ${item.placeName}${item.note ? ` · ${item.note}` : ""}`} />)}</ResultGroup>
        <ResultGroup title="Videoer">{videos.map((item) => <ResultLink href={`/admin/operativ-portal/videoer#video-${item.id}`} key={item.id} label={item.title} meta={`${item.category} · ${contentLocationLabel(item)}`} />)}</ResultGroup>
        <ResultGroup title="Dokumenter">{documents.map((item) => <ResultLink href={`/api/admin/operativ-portal/dokumenter/${item.id}`} key={item.id} label={item.title} meta={`${item.category} · ${contentLocationLabel(item)}`} />)}</ResultGroup>
      </div> : <div className="grid gap-2"><Suggestion query="M2" text="Køretøj" /><Suggestion query="Højtryksslange" text="Udstyr" /><Suggestion query="kontrol" text="Instruktion" /></div>}
    </OperationalPageFrame>
  );
}

function ResultGroup({ title, children }: { title: string; children: React.ReactNode }) {
  const entries = Array.isArray(children) ? children : [children];
  return <section><h2 className="mb-2 px-1 text-xs font-black uppercase tracking-wider text-slate-500">{title}</h2><div className="grid gap-2">{entries.length && entries.some(Boolean) ? children : <p className="rounded-lg bg-[#11171b] p-4 text-sm text-slate-500">Ingen resultater.</p>}</div></section>;
}

function ResultLink({ href, label, meta }: { href: string; label: string; meta: string }) {
  return <Link className="grid grid-cols-[minmax(0,1fr)_22px] items-center gap-3 rounded-lg bg-[#11171b] p-3 hover:bg-[#161e23]" href={href}><span className="min-w-0"><strong className="block truncate text-sm">{label}</strong><small className="mt-1 block truncate text-xs text-slate-500">{meta}</small></span><span className="text-xl text-slate-500">›</span></Link>;
}

function Suggestion({ query, text }: { query: string; text: string }) {
  return <Link className="grid grid-cols-[42px_minmax(0,1fr)_22px] items-center gap-3 rounded-lg bg-[#11171b] p-3" href={`/admin/operativ-portal/soeg?q=${encodeURIComponent(query)}`}><span className="grid size-10 place-items-center rounded-md bg-[#1b2227] text-red-500">⌕</span><span><strong className="block text-sm">{text}</strong><small className="text-xs text-slate-500">Søg efter “{query}”</small></span><span className="text-xl text-slate-500">›</span></Link>;
}
