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
    <section className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,.65fr)_minmax(0,1.35fr)]">
      <div className="min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-[#0d1317] p-5 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.13em] text-red-500">Billedstyring</p>
        <h2 className="mt-1 break-words text-xl font-black text-white">{title}</h2>
        <p className="mt-2 text-sm font-semibold text-slate-400">{description}</p>
        <div className="mt-5 min-w-0"><OperationalImageUploadForm itemId={itemId} placeId={placeId} vehicleId={vehicleId} /></div>
      </div>

      <div className="min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-[#0d1317] p-5 shadow-sm">
        <div className="flex min-w-0 items-end justify-between gap-4"><div className="min-w-0"><h2 className="truncate text-xl font-black text-white">Billedgalleri</h2><p className="mt-1 text-sm font-semibold text-slate-400">{images.length} billeder</p></div></div>
        <div className="mt-4 grid min-w-0 gap-4 sm:grid-cols-2">
          {images.map((image) => (
            <article className="min-w-0 overflow-hidden rounded-xl border border-white/10 bg-[#11171b]" key={image.id}>
              <div className="relative min-w-0">
                <img alt={image.altText || image.title} className="aspect-video w-full bg-[#20272c] object-cover" loading="lazy" src={operationalImageUrl(image.id)} />
                {image.isCover ? <span className="absolute left-3 top-3 rounded-full bg-zinc-950/90 px-3 py-1 text-[10px] font-black uppercase tracking-wide text-white">Forside</span> : null}
              </div>
              <div className="min-w-0 p-4">
                <strong className="block truncate text-white">{image.title}</strong>
                <small className="block truncate text-slate-500">{image.originalName} · {formatBytes(image.sizeBytes)}</small>
                <details className="mt-3 min-w-0 overflow-hidden rounded-xl border border-white/10 p-3">
                  <summary className="cursor-pointer text-sm font-black text-slate-200">Redigér billede</summary>
                  <form action={updateOperationalImageMetadataAction} className="mt-3 grid min-w-0 gap-3">
                    <input name="imageId" type="hidden" value={image.id} />
                    <label className="grid min-w-0 gap-1 text-sm font-bold text-slate-300">Titel<input className="dark-input min-w-0" defaultValue={image.title} name="title" required /></label>
                    <label className="grid min-w-0 gap-1 text-sm font-bold text-slate-300">Alternativ tekst<input className="dark-input min-w-0" defaultValue={image.altText} name="altText" /></label>
                    <button className="app-button-secondary w-full" type="submit">Gem tekst</button>
                  </form>
                  {!image.isCover ? <form action={setOperationalImageCoverAction} className="mt-3"><input name="imageId" type="hidden" value={image.id} /><button className="app-button-primary w-full" type="submit">Vælg som forside</button></form> : null}
                  <form action={deleteOperationalImageAction} className="mt-3"><input name="imageId" type="hidden" value={image.id} /><button className="app-button-danger w-full text-sm" type="submit">Slet billede</button></form>
                </details>
              </div>
            </article>
          ))}
          {images.length === 0 ? <p className="rounded-xl border border-dashed border-white/15 p-8 text-center text-sm font-semibold text-slate-500 sm:col-span-2">Der er endnu ikke uploadet billeder.</p> : null}
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
