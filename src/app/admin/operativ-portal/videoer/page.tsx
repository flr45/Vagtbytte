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
  createManagedOperationalVideoAction,
  deleteManagedOperationalVideoAction,
  updateManagedOperationalVideoAction
} from "@/lib/operativ-portal-content-actions";
import {
  OPERATIONAL_VIDEO_CATEGORIES,
  contentLocationLabel,
  listManagedOperationalVideos,
  listOperationalContentOptions
} from "@/lib/operativ-portal-content";
import { youtubeEmbedUrl } from "@/lib/operativ-portal";

export const dynamic = "force-dynamic";

type SearchParams = { fejl?: string | string[]; vehicleId?: string | string[]; placeId?: string | string[]; itemId?: string | string[]; q?: string | string[]; category?: string | string[] };
type PageProps = { searchParams: Promise<SearchParams> };

export default async function OperationalVideosPage({ searchParams }: PageProps) {
  const user = await requireOperationalPortalAccess();
  const isEditor = canManageOperationalPortal(user);
  const [allVideos, options, params] = await Promise.all([listManagedOperationalVideos(), listOperationalContentOptions(), searchParams]);
  const error = one(params.fejl);
  const defaultVehicleId = one(params.vehicleId) ?? "";
  const defaultPlaceId = one(params.placeId) ?? "";
  const defaultItemId = one(params.itemId) ?? "";
  const q = (one(params.q) ?? "").trim();
  const category = (one(params.category) ?? "").trim();
  const query = q.toLocaleLowerCase("da-DK");
  const videos = allVideos.filter((video) => {
    const matchesCategory = !category || video.category === category;
    const searchable = [video.title, video.description, video.category, video.vehicleName, video.placeName, video.itemName].filter(Boolean).join(" ").toLocaleLowerCase("da-DK");
    return matchesCategory && (!query || searchable.includes(query));
  });

  return (
    <OperationalPageFrame>
      <OperationalScreenHeader backHref="/admin/operativ-portal" title="Videoakademi" />
      <OperationalPortalNav isEditor={isEditor} />
      {error ? <p className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm font-bold text-red-100">{error}</p> : null}

      <form className="grid gap-2 rounded-lg bg-[#11171b] p-3 sm:grid-cols-[minmax(0,1fr)_190px_auto]" method="get">
        <input className="dark-input" defaultValue={q} name="q" placeholder="Søg i videoer" type="search" />
        <select className="dark-input" defaultValue={category} name="category"><option value="">Alle kategorier</option>{OPERATIONAL_VIDEO_CATEGORIES.map((entry) => <option key={entry}>{entry}</option>)}</select>
        <button className="app-button-primary" type="submit">Søg</button>
      </form>

      <section className="grid gap-3 md:grid-cols-2">
        {videos.map((video) => (
          <article className="overflow-hidden rounded-xl border border-white/10 bg-[#0d1317]" id={`video-${video.id}`} key={video.id}>
            <iframe allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen className="aspect-video w-full" loading="lazy" src={youtubeEmbedUrl(video.youtubeId)} title={video.title} />
            <div className="p-4"><p className="text-[10px] font-black uppercase tracking-wider text-red-500">{video.category}</p><h2 className="mt-1 text-lg font-black">{video.title}</h2><p className="mt-2 text-sm leading-6 text-slate-400">{video.description || "Ingen beskrivelse."}</p><p className="mt-3 text-xs text-slate-500">{contentLocationLabel(video)}</p>
              {isEditor ? <details className="mt-4 rounded-lg border border-white/10 bg-[#11171b] p-3"><summary className="cursor-pointer text-xs font-black text-red-400">Redigér video</summary><form action={updateManagedOperationalVideoAction} className="mt-3 grid gap-2"><input name="videoId" type="hidden" value={video.id} /><input className="dark-input" defaultValue={video.title} name="title" required /><input className="dark-input" defaultValue={video.youtubeUrl} name="youtubeUrl" required type="url" /><select className="dark-input" defaultValue={video.category} name="category">{OPERATIONAL_VIDEO_CATEGORIES.map((entry) => <option key={entry}>{entry}</option>)}</select><textarea className="dark-input min-h-24 p-3" defaultValue={video.description} name="description" /><select className="dark-input" defaultValue={video.vehicleId ?? ""} name="vehicleId"><option value="">Generel video</option>{options.vehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.name}</option>)}</select><select className="dark-input" defaultValue={video.placeId ?? ""} name="placeId"><option value="">Ikke tilknyttet</option>{options.places.map((place) => <option key={place.id} value={place.id}>{place.vehicleName} · {place.name}</option>)}</select><select className="dark-input" defaultValue={video.itemId ?? ""} name="itemId"><option value="">Ikke tilknyttet</option>{options.items.map((item) => <option key={item.id} value={item.id}>{item.vehicleName} · {item.placeName} · {item.name}</option>)}</select><button className="app-button-primary" type="submit">Gem</button></form><form action={deleteManagedOperationalVideoAction} className="mt-2"><input name="videoId" type="hidden" value={video.id} /><button className="text-xs font-black text-red-400" type="submit">Slet video</button></form></details> : null}
            </div>
          </article>
        ))}
        {videos.length === 0 ? <p className="rounded-lg border border-dashed border-white/15 bg-white/5 p-8 text-center text-sm text-slate-500 md:col-span-2">Ingen videoer matcher søgningen.</p> : null}
      </section>

      {isEditor ? <details className="rounded-lg border border-red-500/20 bg-red-500/5 p-4" open={Boolean(defaultVehicleId || defaultPlaceId || defaultItemId)}><summary className="cursor-pointer text-sm font-black text-red-400">+ Tilføj YouTube-video</summary><form action={createManagedOperationalVideoAction} className="mt-4 grid gap-3 lg:grid-cols-2"><input className="dark-input" name="title" placeholder="Titel" required /><input className="dark-input" name="youtubeUrl" placeholder="YouTube-link" required type="url" /><select className="dark-input" defaultValue="Udstyr" name="category">{OPERATIONAL_VIDEO_CATEGORIES.map((entry) => <option key={entry}>{entry}</option>)}</select><textarea className="dark-input min-h-24 p-3" maxLength={3000} name="description" placeholder="Beskrivelse" /><select className="dark-input" defaultValue={defaultVehicleId} name="vehicleId"><option value="">Generel video</option>{options.vehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.name}</option>)}</select><select className="dark-input" defaultValue={defaultPlaceId} name="placeId"><option value="">Ikke tilknyttet rum</option>{options.places.map((place) => <option key={place.id} value={place.id}>{place.vehicleName} · {place.name}</option>)}</select><select className="dark-input" defaultValue={defaultItemId} name="itemId"><option value="">Ikke tilknyttet udstyr</option>{options.items.map((item) => <option key={item.id} value={item.id}>{item.vehicleName} · {item.placeName} · {item.name}</option>)}</select><button className="app-button-primary" type="submit">Tilføj video</button></form></details> : null}
    </OperationalPageFrame>
  );
}

function one(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] : value; }
