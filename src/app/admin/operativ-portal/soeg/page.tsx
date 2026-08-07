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
type BaseResults = Awaited<ReturnType<typeof searchOperationalPortal>>;

export default async function OperationalSearchPage({ searchParams }: PageProps) {
  const user = await requireOperationalPortalAccess();
  const isEditor = canManageOperationalPortal(user);
  const params = await searchParams;
  const q = Array.isArray(params.q) ? params.q[0] ?? "" : params.q ?? "";
  const tokenGroups = buildTokenGroups(q);
  const searchTerms = buildSearchTerms(q, tokenGroups);
  const [searches, allVideos, allDocuments] = await Promise.all([
    Promise.all(searchTerms.map((term) => searchOperationalPortal(term))),
    listManagedOperationalVideos(),
    listManagedOperationalDocuments()
  ]);
  const merged = mergeBaseResults(searches);
  const baseResults = {
    ...merged,
    vehicles: merged.vehicles.filter((item) => matchesTokenGroups(`${item.name} ${item.description}`, tokenGroups)),
    places: merged.places.filter((item) => matchesTokenGroups(`${item.vehicleName} ${item.name}`, tokenGroups)),
    items: merged.items.filter((item) => matchesTokenGroups(`${item.vehicleName} ${item.placeName} ${item.name} ${item.note}`, tokenGroups))
  };
  const videos = q.trim() ? allVideos.filter((video) => matchesTokenGroups([video.title, video.description, video.category, video.vehicleName, video.placeName, video.itemName].filter(Boolean).join(" "), tokenGroups)).slice(0, 25) : [];
  const documents = q.trim() ? allDocuments.filter((document) => matchesTokenGroups([document.title, document.description, document.category, document.originalName, document.vehicleName, document.placeName, document.itemName].filter(Boolean).join(" "), tokenGroups)).slice(0, 25) : [];
  const count = baseResults.vehicles.length + baseResults.places.length + baseResults.items.length + videos.length + documents.length;

  return (
    <OperationalPageFrame>
      <OperationalScreenHeader backHref="/admin/operativ-portal" right="" title="Søg" />
      <OperationalPortalNav isEditor={isEditor} />
      <form className="flex gap-2 rounded-lg bg-[#11171b] p-3" method="get"><input autoFocus className="dark-input min-w-0 flex-1" defaultValue={q} name="q" placeholder="Fx M2 H1, HT slange eller brandhanenøgle" type="search" /><button className="grid min-w-12 place-items-center rounded-lg bg-[#c71019] px-3 text-xl font-black" type="submit">⌕</button></form>
      {q ? <p className="px-1 text-xs font-bold text-slate-500">{count} resultater for “{q}” · flere ord kan kombineres</p> : null}
      {q ? <div className="grid gap-4">
        <ResultGroup title="Køretøjer">{baseResults.vehicles.map((item) => <ResultLink href={`/admin/operativ-portal/koeretoejer/${item.id}`} key={item.id} label={item.name} meta={item.description || "Køretøj"} />)}</ResultGroup>
        <ResultGroup title="Rum">{baseResults.places.map((item) => <ResultLink href={`/admin/operativ-portal/rum/${item.id}`} key={item.id} label={item.name} meta={item.vehicleName} />)}</ResultGroup>
        <ResultGroup title="Udstyr">{baseResults.items.map((item) => <ResultLink href={`/admin/operativ-portal/udstyr/${item.id}`} key={item.id} label={item.name} meta={`${item.vehicleName} → ${item.placeName}${item.note ? ` · ${item.note}` : ""}`} />)}</ResultGroup>
        <ResultGroup title="Videoer">{videos.map((item) => <ResultLink href={`/admin/operativ-portal/videoer#video-${item.id}`} key={item.id} label={item.title} meta={`${item.category} · ${contentLocationLabel(item)}`} />)}</ResultGroup>
        <ResultGroup title="Dokumenter">{documents.map((item) => <ResultLink href={`/api/admin/operativ-portal/dokumenter/${item.id}`} key={item.id} label={item.title} meta={`${item.category} · ${contentLocationLabel(item)}`} />)}</ResultGroup>
      </div> : <div className="grid gap-2"><Suggestion query="M2 H1" text="Kombinér køretøj og rum" /><Suggestion query="HT slange" text="Forkortelser og udstyr" /><Suggestion query="brandhanenøgle" text="Find konkret materiel" /></div>}
    </OperationalPageFrame>
  );
}

function mergeBaseResults(results: BaseResults[]): BaseResults {
  const seed = results[0];
  if (!seed) throw new Error("Søgningen kunne ikke initialiseres.");
  return {
    ...seed,
    vehicles: uniqueById(results.flatMap((result) => result.vehicles)),
    places: uniqueById(results.flatMap((result) => result.places)),
    items: uniqueById(results.flatMap((result) => result.items))
  };
}

function uniqueById<T extends { id: string }>(items: T[]) {
  return Array.from(new Map(items.map((item) => [item.id, item])).values());
}

function buildTokenGroups(query: string) {
  return query.trim().toLocaleLowerCase("da-DK").split(/\s+/).filter(Boolean).slice(0, 6).map((token) => {
    const aliases = SEARCH_ALIASES[token] ?? [];
    return Array.from(new Set([token, ...aliases]));
  });
}

function buildSearchTerms(query: string, groups: string[][]) {
  const full = query.trim();
  if (!full) return [""];
  return Array.from(new Set([full, ...groups.flat()])).slice(0, 10);
}

function matchesTokenGroups(value: string, groups: string[][]) {
  if (groups.length === 0) return true;
  const haystack = value.toLocaleLowerCase("da-DK");
  return groups.every((group) => group.some((term) => haystack.includes(term)));
}

const SEARCH_ALIASES: Record<string, string[]> = {
  ht: ["højtryk", "hojtryk"],
  højtryk: ["ht", "hojtryk"],
  hojtryk: ["ht", "højtryk"],
  rd: ["røgdykker", "rogdykker"],
  røgdykker: ["rd", "rogdykker"],
  rogdykker: ["rd", "røgdykker"],
  fh: ["førerhus", "forerhus"],
  førerhus: ["fh", "forerhus"],
  forerhus: ["fh", "førerhus"]
};

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
