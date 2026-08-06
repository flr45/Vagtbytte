import Link from "next/link";
import {
  OperationalPageFrame,
  OperationalPortalHeader,
  OperationalPortalNav
} from "@/components/OperationalPortalNav";
import { TopBar } from "@/components/TopBar";
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
  const [baseResults, allVideos, allDocuments] = await Promise.all([
    searchOperationalPortal(q),
    listManagedOperationalVideos(),
    listManagedOperationalDocuments()
  ]);
  const query = q.trim().toLocaleLowerCase("da-DK");
  const videos = query
    ? allVideos.filter((video) => [video.title, video.description, video.category, video.vehicleName, video.placeName, video.itemName].filter(Boolean).join(" ").toLocaleLowerCase("da-DK").includes(query)).slice(0, 25)
    : [];
  const documents = query
    ? allDocuments.filter((document) => [document.title, document.description, document.category, document.originalName, document.vehicleName, document.placeName, document.itemName].filter(Boolean).join(" ").toLocaleLowerCase("da-DK").includes(query)).slice(0, 25)
    : [];
  const count = baseResults.vehicles.length + baseResults.places.length + baseResults.items.length + videos.length + documents.length;

  return (
    <>
      <TopBar title="Søg" variant="operational" />
      <OperationalPageFrame>
        <OperationalPortalHeader
          description="Find køretøjer, rum, udstyr, videoer og dokumenter med én samlet søgning."
          isEditor={isEditor}
          title="Find materiel"
        />
        <OperationalPortalNav isEditor={isEditor} />

        <form className="flex flex-col gap-3 rounded-[1.5rem] border border-white/10 bg-[#101b2c] p-5 shadow-xl sm:flex-row" method="get">
          <input autoFocus className="dark-input min-w-0 flex-1" defaultValue={q} name="q" placeholder="Fx M2, HT, motorsav eller venstre side" type="search" />
          <button className="app-button-primary min-h-12" type="submit">Søg</button>
        </form>

        {q ? <p className="text-sm font-bold text-slate-400">{count} resultater for “{q}”</p> : null}
        {q ? (
          <div className="grid gap-5 lg:grid-cols-2">
            <ResultGroup icon="🚒" title="Køretøjer">
              {baseResults.vehicles.map((item) => <ResultLink href={`/admin/operativ-portal/koeretoejer/${item.id}`} key={item.id} label={item.name} meta={item.description || "Køretøj"} />)}
            </ResultGroup>
            <ResultGroup icon="▦" title="Rum">
              {baseResults.places.map((item) => <ResultLink href={`/admin/operativ-portal/rum/${item.id}`} key={item.id} label={item.name} meta={item.vehicleName} />)}
            </ResultGroup>
            <ResultGroup icon="⚙" title="Udstyr">
              {baseResults.items.map((item) => <ResultLink href={`/admin/operativ-portal/udstyr/${item.id}`} key={item.id} label={item.name} meta={`${item.vehicleName} · ${item.placeName}${item.note ? ` · ${item.note}` : ""}`} />)}
            </ResultGroup>
            <ResultGroup icon="▶" title="Videoer">
              {videos.map((item) => <ResultLink href={`/admin/operativ-portal/videoer#video-${item.id}`} key={item.id} label={item.title} meta={`${item.category} · ${contentLocationLabel(item)}`} />)}
            </ResultGroup>
            <ResultGroup icon="▤" title="Dokumenter">
              {documents.map((item) => <ResultLink href={`/api/admin/operativ-portal/dokumenter/${item.id}`} key={item.id} label={item.title} meta={`${item.category} · ${contentLocationLabel(item)} · ${item.originalName}`} />)}
            </ResultGroup>
          </div>
        ) : (
          <section className="grid gap-4 sm:grid-cols-3">
            <Suggestion query="M2" text="Find et køretøj" />
            <Suggestion query="Højtryksslange" text="Find bestemt materiel" />
            <Suggestion query="kontrol" text="Find instruktioner" />
          </section>
        )}
      </OperationalPageFrame>
    </>
  );
}

function ResultGroup({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  const entries = Array.isArray(children) ? children : [children];
  return (
    <section className="rounded-[1.5rem] border border-white/10 bg-[#101b2c] p-5 shadow-xl">
      <div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-xl bg-white/5 text-xl">{icon}</span><h2 className="text-xl font-black">{title}</h2></div>
      <div className="mt-4 grid gap-2">{entries.length && entries.some(Boolean) ? children : <p className="rounded-xl bg-white/5 p-4 text-sm font-semibold text-slate-500">Ingen resultater.</p>}</div>
    </section>
  );
}

function ResultLink({ href, label, meta }: { href: string; label: string; meta: string }) {
  return <Link className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-white/10 bg-[#08111f] p-4 hover:border-red-400/40" href={href}><span className="min-w-0"><strong className="block truncate text-sm text-white">{label}</strong><small className="mt-1 block truncate text-slate-500">{meta}</small></span><span className="text-xs font-black text-red-300">Åbn →</span></Link>;
}

function Suggestion({ query, text }: { query: string; text: string }) {
  return <Link className="rounded-[1.5rem] border border-white/10 bg-[#101b2c] p-5 shadow-xl hover:border-red-400/40" href={`/admin/operativ-portal/soeg?q=${encodeURIComponent(query)}`}><p className="text-xs font-black uppercase tracking-[0.14em] text-red-300">Prøv en søgning</p><h2 className="mt-2 text-xl font-black">{text}</h2><p className="mt-3 text-sm font-semibold text-slate-500">“{query}”</p></Link>;
}
