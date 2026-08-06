import type { OperationalImage } from "@/lib/operativ-portal";
import { operationalImageUrl } from "@/lib/operativ-portal";
import {
  deleteOperationalImageAction,
  setOperationalImageCoverAction,
  updateOperationalImageMetadataAction
} from "@/lib/operativ-portal-image-actions";
import { OperationalImageUploadForm } from "./OperationalImageUploadForm";

export function OperationalImageManager({
  title,
  description,
  images,
  vehicleId,
  placeId,
  itemId
}: {
  title: string;
  description: string;
  images: OperationalImage[];
  vehicleId: string;
  placeId?: string;
  itemId?: string;
}) {
  return (
    <section className="grid gap-4 lg:grid-cols-[minmax(300px,.65fr)_minmax(0,1.35fr)]">
      <div className="rounded-2xl border border-brand-line bg-white p-5 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.13em] text-brand-red">Billedstyring</p>
        <h2 className="mt-1 text-xl font-black">{title}</h2>
        <p className="mt-2 text-sm font-semibold text-zinc-600">{description}</p>
        <div className="mt-5"><OperationalImageUploadForm itemId={itemId} placeId={placeId} vehicleId={vehicleId} /></div>
      </div>

      <div className="rounded-2xl border border-brand-line bg-white p-5 shadow-sm">
        <div className="flex items-end justify-between gap-4"><div><h2 className="text-xl font-black">Billedgalleri</h2><p className="mt-1 text-sm font-semibold text-zinc-600">{images.length} billeder</p></div></div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {images.map((image) => (
            <article className="overflow-hidden rounded-xl border border-zinc-200" key={image.id}>
              <div className="relative">
                <img alt={image.altText || image.title} className="aspect-video w-full bg-zinc-100 object-cover" loading="lazy" src={operationalImageUrl(image.id)} />
                {image.isCover ? <span className="absolute left-3 top-3 rounded-full bg-zinc-950/90 px-3 py-1 text-[10px] font-black uppercase tracking-wide text-white">Forside</span> : null}
              </div>
              <div className="p-4">
                <strong className="block truncate">{image.title}</strong>
                <small className="block truncate text-zinc-500">{image.originalName} · {formatBytes(image.sizeBytes)}</small>
                <details className="mt-3 rounded-xl border border-zinc-200 p-3">
                  <summary className="cursor-pointer text-sm font-black">Redigér billede</summary>
                  <form action={updateOperationalImageMetadataAction} className="mt-3 grid gap-3">
                    <input name="imageId" type="hidden" value={image.id} />
                    <label className="grid gap-1 text-sm font-bold text-zinc-700">Titel<input className="focus-ring min-h-11 rounded-lg border border-zinc-200 px-3" defaultValue={image.title} name="title" required /></label>
                    <label className="grid gap-1 text-sm font-bold text-zinc-700">Alternativ tekst<input className="focus-ring min-h-11 rounded-lg border border-zinc-200 px-3" defaultValue={image.altText} name="altText" /></label>
                    <button className="app-button-secondary" type="submit">Gem tekst</button>
                  </form>
                  {!image.isCover ? <form action={setOperationalImageCoverAction} className="mt-3"><input name="imageId" type="hidden" value={image.id} /><button className="app-button-primary w-full" type="submit">Vælg som forside</button></form> : null}
                  <form action={deleteOperationalImageAction} className="mt-3"><input name="imageId" type="hidden" value={image.id} /><button className="app-button-danger w-full text-sm" type="submit">Slet billede</button></form>
                </details>
              </div>
            </article>
          ))}
          {images.length === 0 ? <p className="rounded-xl border border-dashed border-zinc-300 p-8 text-center text-sm font-semibold text-zinc-600 sm:col-span-2">Der er endnu ikke uploadet billeder.</p> : null}
        </div>
      </div>
    </section>
  );
}

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}
