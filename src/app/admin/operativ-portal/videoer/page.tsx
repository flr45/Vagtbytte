import { UserRole } from "@prisma/client";
import { OperationalPortalHeader, OperationalPortalNav } from "@/components/OperationalPortalNav";
import { TopBar } from "@/components/TopBar";
import { requireRole } from "@/lib/auth";
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

type SearchParams = {
  fejl?: string | string[];
  vehicleId?: string | string[];
  placeId?: string | string[];
  itemId?: string | string[];
  q?: string | string[];
  category?: string | string[];
};
type PageProps = { searchParams: Promise<SearchParams> };

export default async function OperationalVideosPage({ searchParams }: PageProps) {
  await requireRole(UserRole.ADMIN);
  const [allVideos, options, params] = await Promise.all([
    listManagedOperationalVideos(),
    listOperationalContentOptions(),
    searchParams
  ]);
  const error = one(params.fejl);
  const defaultVehicleId = one(params.vehicleId) ?? "";
  const defaultPlaceId = one(params.placeId) ?? "";
  const defaultItemId = one(params.itemId) ?? "";
  const q = (one(params.q) ?? "").trim();
  const category = (one(params.category) ?? "").trim();
  const query = q.toLocaleLowerCase("da-DK");

  const videos = allVideos.filter((video) => {
    const matchesCategory = !category || video.category === category;
    const searchable = [
      video.title,
      video.description,
      video.category,
      video.vehicleName,
      video.placeName,
      video.itemName
    ].filter(Boolean).join(" ").toLocaleLowerCase("da-DK");
    return matchesCategory && (!query || searchable.includes(query));
  });

  return (
    <>
      <TopBar title="Videoakademi" />
      <main className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-6">
        <OperationalPortalHeader
          title="Videoakademi"
          description="Indsæt ikke-listede YouTube-videoer, afspil dem direkte i SBR Portal og tilknyt dem til køretøj, rum eller udstyr."
        />
        <OperationalPortalNav />
        {error ? <p className="rounded-xl border border-red-200 bg-red-50 p-4 font-bold text-red-900">{error}</p> : null}

        <details className="rounded-2xl border border-red-200 bg-red-50 p-5" open={Boolean(defaultVehicleId || defaultPlaceId || defaultItemId)}>
          <summary className="cursor-pointer text-xl font-black text-red-950">Tilføj YouTube-video</summary>
          <p className="mt-2 text-sm font-semibold text-red-900/70">Upload videoen til YouTube som ikke-listet og indsæt linket her. Videoen gemmes ikke på Raspberry Pi’en.</p>
          <form action={createManagedOperationalVideoAction} className="mt-5 grid gap-4 rounded-xl bg-white p-4 lg:grid-cols-2">
            <label className="grid gap-2 text-sm font-bold text-zinc-700">Titel<input className="focus-ring min-h-12 rounded-xl border border-zinc-200 px-4" name="title" placeholder="Fx Brug af Højtryksslange (HT)" required /></label>
            <label className="grid gap-2 text-sm font-bold text-zinc-700">YouTube-link<input className="focus-ring min-h-12 rounded-xl border border-zinc-200 px-4" name="youtubeUrl" placeholder="https://youtu.be/..." required type="url" /></label>
            <label className="grid gap-2 text-sm font-bold text-zinc-700">Kategori<select className="focus-ring min-h-12 rounded-xl border border-zinc-200 bg-white px-4" defaultValue="Udstyr" name="category">{OPERATIONAL_VIDEO_CATEGORIES.map((entry) => <option key={entry}>{entry}</option>)}</select></label>
            <label className="grid gap-2 text-sm font-bold text-zinc-700 lg:row-span-2">Beskrivelse<textarea className="focus-ring min-h-32 rounded-xl border border-zinc-200 p-4" maxLength={3000} name="description" placeholder="Hvad gennemgår videoen, og hvornår er den relevant?" /></label>
            <label className="grid gap-2 text-sm font-bold text-zinc-700">Køretøj<select className="focus-ring min-h-12 rounded-xl border border-zinc-200 bg-white px-4" defaultValue={defaultVehicleId} name="vehicleId"><option value="">Generel video</option>{options.vehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.name}</option>)}</select></label>
            <label className="grid gap-2 text-sm font-bold text-zinc-700">Rum<select className="focus-ring min-h-12 rounded-xl border border-zinc-200 bg-white px-4" defaultValue={defaultPlaceId} name="placeId"><option value="">Ikke tilknyttet</option>{options.places.map((place) => <option key={place.id} value={place.id}>{place.vehicleName} · {place.name}</option>)}</select></label>
            <label className="grid gap-2 text-sm font-bold text-zinc-700">Udstyr<select className="focus-ring min-h-12 rounded-xl border border-zinc-200 bg-white px-4" defaultValue={defaultItemId} name="itemId"><option value="">Ikke tilknyttet</option>{options.items.map((item) => <option key={item.id} value={item.id}>{item.vehicleName} · {item.placeName} · {item.name}</option>)}</select></label>
            <button className="app-button-primary min-h-12 lg:w-fit" type="submit">Tilføj video</button>
          </form>
        </details>

        <section className="rounded-2xl border border-brand-line bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div><h2 className="text-xl font-black">Find video</h2><p className="mt-1 text-sm font-semibold text-zinc-600">Filtrér på titel, placering eller kategori.</p></div>
            <p className="text-sm font-black text-zinc-700">{videos.length} af {allVideos.length} videoer</p>
          </div>
          <form className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_220px_auto]" method="get">
            <input className="focus-ring min-h-12 rounded-xl border border-zinc-200 px-4" defaultValue={q} name="q" placeholder="Søg i videoer" type="search" />
            <select className="focus-ring min-h-12 rounded-xl border border-zinc-200 bg-white px-4" defaultValue={category} name="category"><option value="">Alle kategorier</option>{OPERATIONAL_VIDEO_CATEGORIES.map((entry) => <option key={entry}>{entry}</option>)}</select>
            <button className="app-button-secondary min-h-12" type="submit">Filtrér</button>
          </form>
        </section>

        <section>
          <div className="grid gap-5 md:grid-cols-2">
            {videos.map((video) => (
              <article className="overflow-hidden rounded-2xl border border-brand-line bg-white shadow-sm" id={`video-${video.id}`} key={video.id}>
                <iframe allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen className="aspect-video w-full" loading="lazy" src={youtubeEmbedUrl(video.youtubeId)} title={video.title} />
                <div className="p-5">
                  <p className="text-xs font-black uppercase tracking-[0.12em] text-brand-red">{video.category}</p>
                  <h3 className="mt-1 text-xl font-black">{video.title}</h3>
                  <p className="mt-2 text-sm text-zinc-600">{video.description || "Ingen beskrivelse."}</p>
                  <p className="mt-3 text-xs font-bold text-zinc-500">{contentLocationLabel(video)}</p>
                  <details className="mt-4 rounded-xl border border-zinc-200 p-4">
                    <summary className="cursor-pointer font-black">Redigér video</summary>
                    <form action={updateManagedOperationalVideoAction} className="mt-4 grid gap-3">
                      <input name="videoId" type="hidden" value={video.id} />
                      <label className="grid gap-1 text-sm font-bold text-zinc-700">Titel<input className="focus-ring min-h-11 rounded-lg border border-zinc-200 px-3" defaultValue={video.title} name="title" required /></label>
                      <label className="grid gap-1 text-sm font-bold text-zinc-700">YouTube-link<input className="focus-ring min-h-11 rounded-lg border border-zinc-200 px-3" defaultValue={video.youtubeUrl} name="youtubeUrl" required type="url" /></label>
                      <label className="grid gap-1 text-sm font-bold text-zinc-700">Kategori<select className="focus-ring min-h-11 rounded-lg border border-zinc-200 bg-white px-3" defaultValue={video.category} name="category">{OPERATIONAL_VIDEO_CATEGORIES.map((entry) => <option key={entry}>{entry}</option>)}</select></label>
                      <label className="grid gap-1 text-sm font-bold text-zinc-700">Beskrivelse<textarea className="focus-ring min-h-24 rounded-lg border border-zinc-200 p-3" defaultValue={video.description} name="description" /></label>
                      <label className="grid gap-1 text-sm font-bold text-zinc-700">Køretøj<select className="focus-ring min-h-11 rounded-lg border border-zinc-200 bg-white px-3" defaultValue={video.vehicleId ?? ""} name="vehicleId"><option value="">Generel video</option>{options.vehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.name}</option>)}</select></label>
                      <label className="grid gap-1 text-sm font-bold text-zinc-700">Rum<select className="focus-ring min-h-11 rounded-lg border border-zinc-200 bg-white px-3" defaultValue={video.placeId ?? ""} name="placeId"><option value="">Ikke tilknyttet</option>{options.places.map((place) => <option key={place.id} value={place.id}>{place.vehicleName} · {place.name}</option>)}</select></label>
                      <label className="grid gap-1 text-sm font-bold text-zinc-700">Udstyr<select className="focus-ring min-h-11 rounded-lg border border-zinc-200 bg-white px-3" defaultValue={video.itemId ?? ""} name="itemId"><option value="">Ikke tilknyttet</option>{options.items.map((item) => <option key={item.id} value={item.id}>{item.vehicleName} · {item.placeName} · {item.name}</option>)}</select></label>
                      <button className="app-button-primary" type="submit">Gem ændringer</button>
                    </form>
                    <form action={deleteManagedOperationalVideoAction} className="mt-3"><input name="videoId" type="hidden" value={video.id} /><button className="app-button-danger text-sm" type="submit">Slet video</button></form>
                  </details>
                </div>
              </article>
            ))}
            {videos.length === 0 ? <p className="rounded-2xl border border-dashed border-zinc-300 bg-white p-8 font-semibold text-zinc-600 md:col-span-2">Ingen videoer matcher filtreringen.</p> : null}
          </div>
        </section>
      </main>
    </>
  );
}

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
