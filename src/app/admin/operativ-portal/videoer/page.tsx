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
  const user = await requireOperationalPortalAccess();
  const isEditor = canManageOperationalPortal(user);
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
      <TopBar title="Videoakademi" variant="operational" />
      <OperationalPageFrame>
        <OperationalPortalHeader
          description="Instruktionsvideoer til køretøjer, rum og materiel – samlet i et overskueligt læringsbibliotek."
          isEditor={isEditor}
          title="Videoakademi"
        />
        <OperationalPortalNav isEditor={isEditor} />

        {error ? <p className="rounded-2xl border border-red-400/30 bg-red-500/10 p-4 font-bold text-red-100">{error}</p> : null}

        {isEditor ? (
          <details className="rounded-2xl border border-red-400/20 bg-red-500/10 p-5" open={Boolean(defaultVehicleId || defaultPlaceId || defaultItemId)}>
            <summary className="cursor-pointer text-xl font-black text-red-100">Tilføj YouTube-video</summary>
            <p className="mt-2 text-sm font-semibold text-red-100/70">Upload videoen til YouTube som ikke-listet og indsæt linket her.</p>
            <form action={createManagedOperationalVideoAction} className="mt-5 grid gap-4 rounded-2xl border border-white/10 bg-[#101b2c] p-4 lg:grid-cols-2">
              <DarkField label="Titel"><input className="dark-input" name="title" placeholder="Fx Brug af Højtryksslange (HT)" required /></DarkField>
              <DarkField label="YouTube-link"><input className="dark-input" name="youtubeUrl" placeholder="https://youtu.be/..." required type="url" /></DarkField>
              <DarkField label="Kategori"><select className="dark-input" defaultValue="Udstyr" name="category">{OPERATIONAL_VIDEO_CATEGORIES.map((entry) => <option key={entry}>{entry}</option>)}</select></DarkField>
              <DarkField className="lg:row-span-2" label="Beskrivelse"><textarea className="dark-input min-h-32 p-4" maxLength={3000} name="description" placeholder="Hvad gennemgår videoen?" /></DarkField>
              <DarkField label="Køretøj"><select className="dark-input" defaultValue={defaultVehicleId} name="vehicleId"><option value="">Generel video</option>{options.vehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.name}</option>)}</select></DarkField>
              <DarkField label="Rum"><select className="dark-input" defaultValue={defaultPlaceId} name="placeId"><option value="">Ikke tilknyttet</option>{options.places.map((place) => <option key={place.id} value={place.id}>{place.vehicleName} · {place.name}</option>)}</select></DarkField>
              <DarkField label="Udstyr"><select className="dark-input" defaultValue={defaultItemId} name="itemId"><option value="">Ikke tilknyttet</option>{options.items.map((item) => <option key={item.id} value={item.id}>{item.vehicleName} · {item.placeName} · {item.name}</option>)}</select></DarkField>
              <button className="app-button-primary min-h-12 lg:w-fit" type="submit">Tilføj video</button>
            </form>
          </details>
        ) : null}

        <section className="rounded-[1.5rem] border border-white/10 bg-[#101b2c] p-5 shadow-xl">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div><p className="text-xs font-black uppercase tracking-[0.16em] text-red-300">Bibliotek</p><h2 className="mt-1 text-2xl font-black">Find video</h2><p className="mt-2 text-sm font-semibold text-slate-400">Søg på titel, placering eller kategori.</p></div>
            <p className="text-sm font-black text-slate-300">{videos.length} af {allVideos.length}</p>
          </div>
          <form className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_220px_auto]" method="get">
            <input className="dark-input" defaultValue={q} name="q" placeholder="Søg i videoer" type="search" />
            <select className="dark-input" defaultValue={category} name="category"><option value="">Alle kategorier</option>{OPERATIONAL_VIDEO_CATEGORIES.map((entry) => <option key={entry}>{entry}</option>)}</select>
            <button className="app-button-secondary min-h-12" type="submit">Filtrér</button>
          </form>
        </section>

        <section className="grid gap-5 md:grid-cols-2">
          {videos.map((video) => (
            <article className="overflow-hidden rounded-[1.5rem] border border-white/10 bg-[#101b2c] shadow-xl" id={`video-${video.id}`} key={video.id}>
              <iframe allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen className="aspect-video w-full" loading="lazy" src={youtubeEmbedUrl(video.youtubeId)} title={video.title} />
              <div className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div><p className="text-xs font-black uppercase tracking-[0.14em] text-red-300">{video.category}</p><h3 className="mt-2 text-2xl font-black">{video.title}</h3></div>
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-[10px] font-black uppercase tracking-wide text-slate-300">{contentLocationLabel(video)}</span>
                </div>
                <p className="mt-3 text-sm font-semibold leading-6 text-slate-400">{video.description || "Ingen beskrivelse."}</p>

                {isEditor ? (
                  <details className="mt-5 rounded-xl border border-white/10 bg-[#08111f] p-4">
                    <summary className="cursor-pointer font-black text-slate-200">Redigér video</summary>
                    <form action={updateManagedOperationalVideoAction} className="mt-4 grid gap-3">
                      <input name="videoId" type="hidden" value={video.id} />
                      <DarkField label="Titel"><input className="dark-input" defaultValue={video.title} name="title" required /></DarkField>
                      <DarkField label="YouTube-link"><input className="dark-input" defaultValue={video.youtubeUrl} name="youtubeUrl" required type="url" /></DarkField>
                      <DarkField label="Kategori"><select className="dark-input" defaultValue={video.category} name="category">{OPERATIONAL_VIDEO_CATEGORIES.map((entry) => <option key={entry}>{entry}</option>)}</select></DarkField>
                      <DarkField label="Beskrivelse"><textarea className="dark-input min-h-24 p-3" defaultValue={video.description} name="description" /></DarkField>
                      <DarkField label="Køretøj"><select className="dark-input" defaultValue={video.vehicleId ?? ""} name="vehicleId"><option value="">Generel video</option>{options.vehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.name}</option>)}</select></DarkField>
                      <DarkField label="Rum"><select className="dark-input" defaultValue={video.placeId ?? ""} name="placeId"><option value="">Ikke tilknyttet</option>{options.places.map((place) => <option key={place.id} value={place.id}>{place.vehicleName} · {place.name}</option>)}</select></DarkField>
                      <DarkField label="Udstyr"><select className="dark-input" defaultValue={video.itemId ?? ""} name="itemId"><option value="">Ikke tilknyttet</option>{options.items.map((item) => <option key={item.id} value={item.id}>{item.vehicleName} · {item.placeName} · {item.name}</option>)}</select></DarkField>
                      <button className="app-button-primary" type="submit">Gem ændringer</button>
                    </form>
                    <form action={deleteManagedOperationalVideoAction} className="mt-3"><input name="videoId" type="hidden" value={video.id} /><button className="app-button-danger text-sm" type="submit">Slet video</button></form>
                  </details>
                ) : null}
              </div>
            </article>
          ))}
          {videos.length === 0 ? <p className="rounded-[1.5rem] border border-dashed border-white/15 bg-white/5 p-10 text-center font-semibold text-slate-400 md:col-span-2">Ingen videoer matcher filtreringen.</p> : null}
        </section>
      </OperationalPageFrame>
    </>
  );
}

function DarkField({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return <label className={`grid gap-2 text-sm font-bold text-slate-200 ${className}`}>{label}{children}</label>;
}

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
