import { UserRole } from "@prisma/client";
import { OperationalDocumentUploadForm } from "@/components/OperationalDocumentUploadForm";
import { OperationalPortalHeader, OperationalPortalNav } from "@/components/OperationalPortalNav";
import { TopBar } from "@/components/TopBar";
import { requireRole } from "@/lib/auth";
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
  await requireRole(UserRole.ADMIN);
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
      <TopBar title="Operative dokumenter" />
      <main className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-6">
        <OperationalPortalHeader
          title="Dokumentbibliotek"
          description="Upload, kategorisér og tilknyt manualer, instrukser, SOP'er og billeder. Filer udleveres kun efter kontrol af administratorens session."
        />
        <OperationalPortalNav />

        <section className="grid gap-4 lg:grid-cols-[minmax(330px,.75fr)_minmax(0,1.25fr)]">
          <div className="rounded-2xl border border-brand-line bg-white p-5 shadow-sm">
            <h2 className="text-xl font-black">Upload dokument</h2>
            <p className="mt-1 text-sm font-semibold text-zinc-600">Tilknyt filen til hele portalen, et køretøj, et rum eller bestemt udstyr.</p>
            <div className="mt-5">
              <OperationalDocumentUploadForm
                defaultItemId={defaultItemId}
                defaultPlaceId={defaultPlaceId}
                defaultVehicleId={defaultVehicleId}
                items={options.items}
                places={options.places}
                vehicles={options.vehicles}
              />
            </div>
          </div>

          <div className="grid content-start gap-4">
            <section className="rounded-2xl border border-brand-line bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div><h2 className="text-xl font-black">Find dokument</h2><p className="mt-1 text-sm font-semibold text-zinc-600">Søg i titel, beskrivelse, filnavn og placering.</p></div>
                <p className="text-sm font-black text-zinc-700">{documents.length} af {allDocuments.length} filer</p>
              </div>
              <form className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_220px_auto]" method="get">
                <input className="focus-ring min-h-12 rounded-xl border border-zinc-200 px-4" defaultValue={q} name="q" placeholder="Søg i dokumenter" type="search" />
                <select className="focus-ring min-h-12 rounded-xl border border-zinc-200 bg-white px-4" defaultValue={category} name="category"><option value="">Alle kategorier</option>{OPERATIONAL_DOCUMENT_CATEGORIES.map((entry) => <option key={entry}>{entry}</option>)}</select>
                <button className="app-button-secondary min-h-12" type="submit">Filtrér</button>
              </form>
            </section>

            <section className="overflow-hidden rounded-2xl border border-brand-line bg-white shadow-sm">
              {documents.map((document) => (
                <article className="border-b border-zinc-100 p-4 last:border-b-0" id={`dokument-${document.id}`} key={document.id}>
                  <div className="grid grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-3">
                    <span className="grid size-11 place-items-center rounded-lg bg-zinc-950 text-[9px] font-black text-white">{document.category.slice(0, 3).toUpperCase()}</span>
                    <a className="min-w-0" href={`/api/admin/operativ-portal/dokumenter/${document.id}`} target="_blank">
                      <strong className="block truncate">{document.title}</strong>
                      <small className="block truncate text-zinc-500">{contentLocationLabel(document)} · {document.originalName} · {formatBytes(document.sizeBytes)}</small>
                    </a>
                    <a className="app-button-secondary px-3 text-xs" href={`/api/admin/operativ-portal/dokumenter/${document.id}`} target="_blank">Åbn</a>
                  </div>
                  {document.description ? <p className="mt-3 text-sm text-zinc-600">{document.description}</p> : null}
                  <details className="mt-3 rounded-xl border border-zinc-200 p-4">
                    <summary className="cursor-pointer font-black">Redigér dokument</summary>
                    <form action={updateManagedOperationalDocumentAction} className="mt-4 grid gap-3">
                      <input name="documentId" type="hidden" value={document.id} />
                      <label className="grid gap-1 text-sm font-bold text-zinc-700">Titel<input className="focus-ring min-h-11 rounded-lg border border-zinc-200 px-3" defaultValue={document.title} name="title" required /></label>
                      <label className="grid gap-1 text-sm font-bold text-zinc-700">Kategori<select className="focus-ring min-h-11 rounded-lg border border-zinc-200 bg-white px-3" defaultValue={document.category} name="category">{OPERATIONAL_DOCUMENT_CATEGORIES.map((entry) => <option key={entry}>{entry}</option>)}</select></label>
                      <label className="grid gap-1 text-sm font-bold text-zinc-700">Beskrivelse<textarea className="focus-ring min-h-24 rounded-lg border border-zinc-200 p-3" defaultValue={document.description} name="description" /></label>
                      <label className="grid gap-1 text-sm font-bold text-zinc-700">Køretøj<select className="focus-ring min-h-11 rounded-lg border border-zinc-200 bg-white px-3" defaultValue={document.vehicleId ?? ""} name="vehicleId"><option value="">Generelt</option>{options.vehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.name}</option>)}</select></label>
                      <label className="grid gap-1 text-sm font-bold text-zinc-700">Rum<select className="focus-ring min-h-11 rounded-lg border border-zinc-200 bg-white px-3" defaultValue={document.placeId ?? ""} name="placeId"><option value="">Ikke tilknyttet</option>{options.places.map((place) => <option key={place.id} value={place.id}>{place.vehicleName} · {place.name}</option>)}</select></label>
                      <label className="grid gap-1 text-sm font-bold text-zinc-700">Udstyr<select className="focus-ring min-h-11 rounded-lg border border-zinc-200 bg-white px-3" defaultValue={document.itemId ?? ""} name="itemId"><option value="">Ikke tilknyttet</option>{options.items.map((item) => <option key={item.id} value={item.id}>{item.vehicleName} · {item.placeName} · {item.name}</option>)}</select></label>
                      <button className="app-button-primary" type="submit">Gem metadata</button>
                    </form>
                    <form action={deleteManagedOperationalDocumentAction} className="mt-3"><input name="documentId" type="hidden" value={document.id} /><button className="app-button-danger text-sm" type="submit">Slet dokument og fil</button></form>
                  </details>
                </article>
              ))}
              {documents.length === 0 ? <p className="p-8 text-center text-sm font-semibold text-zinc-600">Ingen dokumenter matcher filtreringen.</p> : null}
            </section>
          </div>
        </section>
      </main>
    </>
  );
}

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}
