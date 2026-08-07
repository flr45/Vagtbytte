import { OperationalDocumentUploadForm } from "@/components/OperationalDocumentUploadForm";
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
  deleteManagedOperationalDocumentAction,
  updateManagedOperationalDocumentAction
} from "@/lib/operativ-portal-content-actions";
import {
  OPERATIONAL_DOCUMENT_CATEGORIES,
  contentLocationLabel,
  listManagedOperationalDocuments,
  listOperationalContentOptions
} from "@/lib/operativ-portal-content";

export const dynamic = "force-dynamic";
type SearchParams = { q?: string | string[]; category?: string | string[]; vehicleId?: string | string[]; placeId?: string | string[]; itemId?: string | string[] };
type PageProps = { searchParams: Promise<SearchParams> };

export default async function OperationalDocumentsPage({ searchParams }: PageProps) {
  const user = await requireOperationalPortalAccess();
  const isEditor = canManageOperationalPortal(user);
  const [allDocuments, options, params] = await Promise.all([listManagedOperationalDocuments(), listOperationalContentOptions(), searchParams]);
  const q = (one(params.q) ?? "").trim();
  const category = (one(params.category) ?? "").trim();
  const defaultVehicleId = one(params.vehicleId) ?? "";
  const defaultPlaceId = one(params.placeId) ?? "";
  const defaultItemId = one(params.itemId) ?? "";
  const query = q.toLocaleLowerCase("da-DK");
  const documents = allDocuments.filter((document) => {
    const matchesCategory = !category || document.category === category;
    const searchable = [document.title, document.description, document.category, document.originalName, document.vehicleName, document.placeName, document.itemName].filter(Boolean).join(" ").toLocaleLowerCase("da-DK");
    return matchesCategory && (!query || searchable.includes(query));
  });

  return (
    <OperationalPageFrame>
      <OperationalScreenHeader backHref="/admin/operativ-portal" title="Videnbank" />
      <OperationalPortalNav isEditor={isEditor} />

      <form className="grid gap-2 rounded-lg bg-[#11171b] p-3 sm:grid-cols-[minmax(0,1fr)_190px_auto]" method="get">
        <input className="dark-input" defaultValue={q} name="q" placeholder="Søg i dokumenter" type="search" />
        <select className="dark-input" defaultValue={category} name="category"><option value="">Alle kategorier</option>{OPERATIONAL_DOCUMENT_CATEGORIES.map((entry) => <option key={entry}>{entry}</option>)}</select>
        <button className="app-button-primary" type="submit">Søg</button>
      </form>

      <section className="grid gap-2">
        {documents.map((document) => (
          <article className="rounded-lg border border-white/5 bg-[#11171b] p-3" id={`dokument-${document.id}`} key={document.id}>
            <div className="grid grid-cols-[46px_minmax(0,1fr)_22px] items-center gap-3">
              <span className="grid size-11 place-items-center rounded-md bg-[#c71019] text-[9px] font-black">{document.category.slice(0, 3).toUpperCase()}</span>
              <a className="min-w-0" href={`/api/admin/operativ-portal/dokumenter/${document.id}`} target="_blank"><strong className="block truncate text-sm">{document.title}</strong><small className="mt-1 block truncate text-xs text-slate-500">{contentLocationLabel(document)} · {formatBytes(document.sizeBytes)}</small></a>
              <span className="text-xl text-slate-500">›</span>
            </div>
            {document.description ? <p className="mt-3 text-xs leading-5 text-slate-400">{document.description}</p> : null}
            {isEditor ? <details className="mt-3 rounded-lg border border-white/10 bg-[#0d1317] p-3"><summary className="cursor-pointer text-xs font-black text-red-400">Redigér dokument</summary><form action={updateManagedOperationalDocumentAction} className="mt-3 grid gap-2"><input name="documentId" type="hidden" value={document.id} /><input className="dark-input" defaultValue={document.title} name="title" required /><select className="dark-input" defaultValue={document.category} name="category">{OPERATIONAL_DOCUMENT_CATEGORIES.map((entry) => <option key={entry}>{entry}</option>)}</select><textarea className="dark-input min-h-24 p-3" defaultValue={document.description} name="description" /><select className="dark-input" defaultValue={document.vehicleId ?? ""} name="vehicleId"><option value="">Generelt</option>{options.vehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.name}</option>)}</select><select className="dark-input" defaultValue={document.placeId ?? ""} name="placeId"><option value="">Ikke tilknyttet</option>{options.places.map((place) => <option key={place.id} value={place.id}>{place.vehicleName} · {place.name}</option>)}</select><select className="dark-input" defaultValue={document.itemId ?? ""} name="itemId"><option value="">Ikke tilknyttet</option>{options.items.map((item) => <option key={item.id} value={item.id}>{item.vehicleName} · {item.placeName} · {item.name}</option>)}</select><button className="app-button-primary" type="submit">Gem</button></form><form action={deleteManagedOperationalDocumentAction} className="mt-2"><input name="documentId" type="hidden" value={document.id} /><button className="text-xs font-black text-red-400" type="submit">Slet dokument og fil</button></form></details> : null}
          </article>
        ))}
        {documents.length === 0 ? <p className="rounded-lg border border-dashed border-white/15 bg-white/5 p-8 text-center text-sm text-slate-500">Ingen dokumenter matcher søgningen.</p> : null}
      </section>

      {isEditor ? <details className="rounded-lg border border-red-500/20 bg-red-500/5 p-4" open={Boolean(defaultVehicleId || defaultPlaceId || defaultItemId)}><summary className="cursor-pointer text-sm font-black text-red-400">+ Upload dokument</summary><div className="mt-4 rounded-lg bg-white p-3 text-zinc-950"><OperationalDocumentUploadForm defaultItemId={defaultItemId} defaultPlaceId={defaultPlaceId} defaultVehicleId={defaultVehicleId} items={options.items} places={options.places} vehicles={options.vehicles} /></div></details> : null}
    </OperationalPageFrame>
  );
}

function one(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] : value; }
function formatBytes(value: number) { if (value < 1024) return `${value} B`; if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`; return `${(value / (1024 * 1024)).toFixed(1)} MB`; }
