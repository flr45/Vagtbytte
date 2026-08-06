import { OperationalDocumentUploadForm } from "@/components/OperationalDocumentUploadForm";
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

type SearchParams = {
  q?: string | string[];
  category?: string | string[];
  vehicleId?: string | string[];
  placeId?: string | string[];
  itemId?: string | string[];
};
type PageProps = { searchParams: Promise<SearchParams> };

export default async function OperationalDocumentsPage({ searchParams }: PageProps) {
  const user = await requireOperationalPortalAccess();
  const isEditor = canManageOperationalPortal(user);
  const [allDocuments, options, params] = await Promise.all([
    listManagedOperationalDocuments(),
    listOperationalContentOptions(),
    searchParams
  ]);
  const q = (one(params.q) ?? "").trim();
  const category = (one(params.category) ?? "").trim();
  const defaultVehicleId = one(params.vehicleId) ?? "";
  const defaultPlaceId = one(params.placeId) ?? "";
  const defaultItemId = one(params.itemId) ?? "";
  const query = q.toLocaleLowerCase("da-DK");

  const documents = allDocuments.filter((document) => {
    const matchesCategory = !category || document.category === category;
    const searchable = [
      document.title,
      document.description,
      document.category,
      document.originalName,
      document.vehicleName,
      document.placeName,
      document.itemName
    ].filter(Boolean).join(" ").toLocaleLowerCase("da-DK");
    return matchesCategory && (!query || searchable.includes(query));
  });

  return (
    <>
      <TopBar title="Videnbank" variant="operational" />
      <OperationalPageFrame>
        <OperationalPortalHeader
          description="Manualer, instrukser, SOP’er, kontrolskemaer og andre operative dokumenter samlet ét sted."
          isEditor={isEditor}
          title="Videnbank"
        />
        <OperationalPortalNav isEditor={isEditor} />

        {isEditor ? (
          <details className="rounded-2xl border border-red-400/20 bg-red-500/10 p-5" open={Boolean(defaultVehicleId || defaultPlaceId || defaultItemId)}>
            <summary className="cursor-pointer text-xl font-black text-red-100">Upload dokument</summary>
            <p className="mt-2 text-sm font-semibold text-red-100/70">Tilknyt filen til hele portalen, et køretøj, et rum eller bestemt udstyr.</p>
            <div className="mt-5 rounded-2xl border border-white/10 bg-white p-4 text-zinc-950">
              <OperationalDocumentUploadForm
                defaultItemId={defaultItemId}
                defaultPlaceId={defaultPlaceId}
                defaultVehicleId={defaultVehicleId}
                items={options.items}
                places={options.places}
                vehicles={options.vehicles}
              />
            </div>
          </details>
        ) : null}

        <section className="rounded-[1.5rem] border border-white/10 bg-[#101b2c] p-5 shadow-xl">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div><p className="text-xs font-black uppercase tracking-[0.16em] text-red-300">Dokumentbibliotek</p><h2 className="mt-1 text-2xl font-black">Find dokument</h2><p className="mt-2 text-sm font-semibold text-slate-400">Søg i titel, beskrivelse, filnavn og placering.</p></div>
            <p className="text-sm font-black text-slate-300">{documents.length} af {allDocuments.length}</p>
          </div>
          <form className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_220px_auto]" method="get">
            <input className="dark-input" defaultValue={q} name="q" placeholder="Søg i dokumenter" type="search" />
            <select className="dark-input" defaultValue={category} name="category"><option value="">Alle kategorier</option>{OPERATIONAL_DOCUMENT_CATEGORIES.map((entry) => <option key={entry}>{entry}</option>)}</select>
            <button className="app-button-secondary min-h-12" type="submit">Filtrér</button>
          </form>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {documents.map((document) => (
            <article className="flex min-h-64 flex-col rounded-[1.5rem] border border-white/10 bg-[#101b2c] p-5 shadow-xl" id={`dokument-${document.id}`} key={document.id}>
              <div className="flex items-start justify-between gap-3">
                <span className="grid size-14 place-items-center rounded-2xl bg-red-600 text-xs font-black text-white shadow-lg">{document.category.slice(0, 3).toUpperCase()}</span>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-[10px] font-black uppercase tracking-wide text-slate-300">{formatBytes(document.sizeBytes)}</span>
              </div>
              <p className="mt-5 text-xs font-black uppercase tracking-[0.14em] text-red-300">{document.category}</p>
              <h3 className="mt-2 text-xl font-black">{document.title}</h3>
              <p className="mt-2 line-clamp-3 text-sm font-semibold leading-6 text-slate-400">{document.description || document.originalName}</p>
              <p className="mt-4 text-xs font-bold text-slate-500">{contentLocationLabel(document)}</p>
              <a className="mt-auto pt-5 text-xs font-black uppercase tracking-[0.14em] text-red-300" href={`/api/admin/operativ-portal/dokumenter/${document.id}`} target="_blank">Åbn dokument →</a>

              {isEditor ? (
                <details className="mt-4 rounded-xl border border-white/10 bg-[#08111f] p-4">
                  <summary className="cursor-pointer font-black text-slate-200">Redigér dokument</summary>
                  <form action={updateManagedOperationalDocumentAction} className="mt-4 grid gap-3">
                    <input name="documentId" type="hidden" value={document.id} />
                    <DarkField label="Titel"><input className="dark-input" defaultValue={document.title} name="title" required /></DarkField>
                    <DarkField label="Kategori"><select className="dark-input" defaultValue={document.category} name="category">{OPERATIONAL_DOCUMENT_CATEGORIES.map((entry) => <option key={entry}>{entry}</option>)}</select></DarkField>
                    <DarkField label="Beskrivelse"><textarea className="dark-input min-h-24 p-3" defaultValue={document.description} name="description" /></DarkField>
                    <DarkField label="Køretøj"><select className="dark-input" defaultValue={document.vehicleId ?? ""} name="vehicleId"><option value="">Generelt</option>{options.vehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.name}</option>)}</select></DarkField>
                    <DarkField label="Rum"><select className="dark-input" defaultValue={document.placeId ?? ""} name="placeId"><option value="">Ikke tilknyttet</option>{options.places.map((place) => <option key={place.id} value={place.id}>{place.vehicleName} · {place.name}</option>)}</select></DarkField>
                    <DarkField label="Udstyr"><select className="dark-input" defaultValue={document.itemId ?? ""} name="itemId"><option value="">Ikke tilknyttet</option>{options.items.map((item) => <option key={item.id} value={item.id}>{item.vehicleName} · {item.placeName} · {item.name}</option>)}</select></DarkField>
                    <button className="app-button-primary" type="submit">Gem metadata</button>
                  </form>
                  <form action={deleteManagedOperationalDocumentAction} className="mt-3"><input name="documentId" type="hidden" value={document.id} /><button className="app-button-danger text-sm" type="submit">Slet dokument og fil</button></form>
                </details>
              ) : null}
            </article>
          ))}
          {documents.length === 0 ? <p className="rounded-[1.5rem] border border-dashed border-white/15 bg-white/5 p-10 text-center font-semibold text-slate-400 sm:col-span-2 lg:col-span-3">Ingen dokumenter matcher filtreringen.</p> : null}
        </section>
      </OperationalPageFrame>
    </>
  );
}

function DarkField({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="grid gap-2 text-sm font-bold text-slate-200">{label}{children}</label>;
}

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}
