import { UserRole } from "@prisma/client";
import { OperationalDocumentUploadForm } from "@/components/OperationalDocumentUploadForm";
import { OperationalPortalHeader, OperationalPortalNav } from "@/components/OperationalPortalNav";
import { TopBar } from "@/components/TopBar";
import { requireRole } from "@/lib/auth";
import { deleteOperationalDocumentAction } from "@/lib/operativ-portal-actions";
import { listOperationalDocuments, listOperationalVehicles } from "@/lib/operativ-portal";

export const dynamic = "force-dynamic";

export default async function OperationalDocumentsPage() {
  await requireRole(UserRole.ADMIN);
  const [documents, vehicles] = await Promise.all([
    listOperationalDocuments(),
    listOperationalVehicles()
  ]);

  return (
    <>
      <TopBar title="Operative dokumenter" />
      <main className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-6">
        <OperationalPortalHeader
          title="Dokumentbibliotek"
          description="Upload manualer, instrukser, SOP'er og billeder. Filerne gemmes i en vedvarende servermappe og udleveres kun efter kontrol af administratorens session."
        />
        <OperationalPortalNav />

        <section className="grid gap-4 lg:grid-cols-[minmax(320px,.72fr)_minmax(0,1.28fr)]">
          <div className="rounded-2xl border border-brand-line bg-white p-5 shadow-sm">
            <h2 className="text-xl font-black">Upload dokument</h2>
            <p className="mt-1 text-sm font-semibold text-zinc-600">Filen bliver ikke offentligt tilgængelig via en direkte mappeadresse.</p>
            <div className="mt-5"><OperationalDocumentUploadForm vehicles={vehicles.map(({ id, name }) => ({ id, name }))} /></div>
          </div>

          <div className="rounded-2xl border border-brand-line bg-white p-5 shadow-sm">
            <div className="flex items-end justify-between gap-4"><div><h2 className="text-xl font-black">Alle dokumenter</h2><p className="mt-1 text-sm font-semibold text-zinc-600">{documents.length} filer</p></div></div>
            <div className="mt-4 overflow-hidden rounded-xl border border-zinc-200">
              {documents.map((document) => (
                <div className="grid grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-3 border-b border-zinc-100 p-4 last:border-b-0" key={document.id}>
                  <span className="grid size-11 place-items-center rounded-lg bg-zinc-950 text-[9px] font-black text-white">FIL</span>
                  <a className="min-w-0" href={`/api/admin/operativ-portal/dokumenter/${document.id}`} target="_blank">
                    <strong className="block truncate">{document.title}</strong>
                    <small className="block truncate text-zinc-500">{document.vehicleName || "Generelt"} · {document.originalName} · {formatBytes(document.sizeBytes)}</small>
                  </a>
                  <form action={deleteOperationalDocumentAction}><input name="documentId" type="hidden" value={document.id} /><button className="app-button-danger px-3 text-xs" type="submit">Slet</button></form>
                </div>
              ))}
              {documents.length === 0 ? <p className="p-8 text-center text-sm font-semibold text-zinc-600">Ingen dokumenter er uploadet endnu.</p> : null}
            </div>
          </div>
        </section>
      </main>
    </>
  );
}

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}
