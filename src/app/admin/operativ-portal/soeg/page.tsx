import Link from "next/link";
import { UserRole } from "@prisma/client";
import { OperationalPortalHeader, OperationalPortalNav } from "@/components/OperationalPortalNav";
import { TopBar } from "@/components/TopBar";
import { requireRole } from "@/lib/auth";
import {
  contentLocationLabel,
  listManagedOperationalDocuments,
  listManagedOperationalVideos
} from "@/lib/operativ-portal-content";
import { searchOperationalPortal } from "@/lib/operativ-portal";

export const dynamic = "force-dynamic";
type PageProps = { searchParams: Promise<{ q?: string | string[] }> };

export default async function OperationalSearchPage({ searchParams }: PageProps) {
  await requireRole(UserRole.ADMIN);
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
      <TopBar title="Søg i Operativ Portal" />
      <main className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-6">
        <OperationalPortalHeader title="Global søgning" description="Find køretøjer, rum, udstyr, videoer og dokumenter med én søgning." />
        <OperationalPortalNav />
        <form className="flex flex-col gap-3 rounded-2xl border border-brand-line bg-white p-5 shadow-sm sm:flex-row" method="get">
          <input autoFocus className="focus-ring min-h-12 min-w-0 flex-1 rounded-xl border border-zinc-200 px-4 text-base" defaultValue={q} name="q" placeholder="Fx M2, HT, motorsav eller venstre side" type="search" />
          <button className="app-button-primary min-h-12" type="submit">Søg</button>
        </form>

        {q ? <p className="text-sm font-bold text-zinc-600">{count} resultater for “{q}”</p> : null}
        {q ? (
          <div className="grid gap-5 lg:grid-cols-2">
            <ResultGroup title="Køretøjer">
              {baseResults.vehicles.map((item) => <ResultLink href={`/admin/operativ-portal/koeretoejer/${item.id}`} key={item.id} label={item.name} meta={item.description || "Køretøj"} />)}
            </ResultGroup>
            <ResultGroup title="Rum">
              {baseResults.places.map((item) => <ResultLink href={`/admin/operativ-portal/rum/${item.id}`} key={item.id} label={item.name} meta={item.vehicleName} />)}
            </ResultGroup>
            <ResultGroup title="Udstyr">
              {baseResults.items.map((item) => <ResultLink href={`/admin/operativ-portal/udstyr/${item.id}`} key={item.id} label={item.name} meta={`${item.vehicleName} · ${item.placeName}${item.note ? ` · ${item.note}` : ""}`} />)}
            </ResultGroup>
            <ResultGroup title="Videoer">
              {videos.map((item) => <ResultLink href={`/admin/operativ-portal/videoer#video-${item.id}`} key={item.id} label={item.title} meta={`${item.category} · ${contentLocationLabel(item)}`} />)}
            </ResultGroup>
            <ResultGroup title="Dokumenter">
              {documents.map((item) => <ResultLink href={`/api/admin/operativ-portal/dokumenter/${item.id}`} key={item.id} label={item.title} meta={`${item.category} · ${contentLocationLabel(item)} · ${item.originalName}`} />)}
            </ResultGroup>
          </div>
        ) : (
          <p className="rounded-2xl border border-dashed border-zinc-300 bg-white p-8 text-center font-semibold text-zinc-600">Skriv et søgeord for at begynde.</p>
        )}
      </main>
    </>
  );
}

function ResultGroup({ title, children }: { title: string; children: React.ReactNode }) {
  const entries = Array.isArray(children) ? children : [children];
  return <section className="rounded-2xl border border-brand-line bg-white p-4 shadow-sm"><h2 className="text-lg font-black">{title}</h2><div className="mt-3 grid gap-2">{entries.length && entries.some(Boolean) ? children : <p className="rounded-lg bg-zinc-50 p-4 text-sm font-semibold text-zinc-500">Ingen resultater.</p>}</div></section>;
}

function ResultLink({ href, label, meta }: { href: string; label: string; meta: string }) {
  return <Link className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-zinc-200 p-3 hover:border-red-300 hover:bg-red-50" href={href}><span className="min-w-0"><strong className="block truncate text-sm">{label}</strong><small className="block truncate text-zinc-500">{meta}</small></span><span className="text-xs font-black text-brand-red">Åbn</span></Link>;
}
