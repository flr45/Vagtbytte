import { UserRole } from "@prisma/client";
import { OperationalPortalHeader, OperationalPortalNav } from "@/components/OperationalPortalNav";
import { TopBar } from "@/components/TopBar";
import { requireRole } from "@/lib/auth";
import {
  createOperationalVideoAction,
  deleteOperationalVideoAction
} from "@/lib/operativ-portal-actions";
import {
  listOperationalVehicles,
  listOperationalVideos,
  youtubeEmbedUrl
} from "@/lib/operativ-portal";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type SearchParams = {
  fejl?: string | string[];
  vehicleId?: string | string[];
  itemId?: string | string[];
};
type PageProps = { searchParams: Promise<SearchParams> };

export default async function OperationalVideosPage({ searchParams }: PageProps) {
  await requireRole(UserRole.ADMIN);
  const [videos, vehicles, items, params] = await Promise.all([
    listOperationalVideos(),
    listOperationalVehicles(),
    prisma.$queryRaw<Array<{ id: string; name: string; vehicleName: string }>>`
      SELECT i.id, i.name, v.name AS "vehicleName"
      FROM operational_item i
      INNER JOIN operational_place p ON p.id = i.place_id
      INNER JOIN operational_vehicle v ON v.id = p.vehicle_id
      ORDER BY v.name, i.name
    `,
    searchParams
  ]);
  const error = one(params.fejl);
  const defaultVehicleId = one(params.vehicleId) ?? "";
  const defaultItemId = one(params.itemId) ?? "";

  return (
    <>
      <TopBar title="Videoakademi" />
      <main className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-6">
        <OperationalPortalHeader
          title="Videoakademi"
          description="Tilføj ikke-listede YouTube-videoer og vis dem direkte i SBR Portal. Videoerne kan knyttes til et køretøj eller et bestemt udstyr."
        />
        <OperationalPortalNav />
        {error ? <p className="rounded-xl border border-red-200 bg-red-50 p-4 font-bold text-red-900">{error}</p> : null}

        <section className="rounded-2xl border border-brand-line bg-white p-5 shadow-sm">
          <h2 className="text-xl font-black">Tilføj YouTube-video</h2>
          <p className="mt-1 text-sm font-semibold text-zinc-600">Upload videoen til YouTube som ikke-listet og indsæt derefter linket her.</p>
          <form action={createOperationalVideoAction} className="mt-5 grid gap-4 lg:grid-cols-2">
            <label className="grid gap-2 text-sm font-bold text-zinc-700">Titel<input className="focus-ring min-h-12 rounded-xl border border-zinc-200 px-4" name="title" placeholder="Fx Brug af Højtryksslange (HT)" required /></label>
            <label className="grid gap-2 text-sm font-bold text-zinc-700">YouTube-link<input className="focus-ring min-h-12 rounded-xl border border-zinc-200 px-4" name="youtubeUrl" placeholder="https://youtu.be/..." required type="url" /></label>
            <label className="grid gap-2 text-sm font-bold text-zinc-700">Kategori<select className="focus-ring min-h-12 rounded-xl border border-zinc-200 bg-white px-4" defaultValue="Udstyr" name="category"><option>Køretøj</option><option>Udstyr</option><option>Procedure</option><option>Sikkerhed</option><option>Vedligehold</option></select></label>
            <label className="grid gap-2 text-sm font-bold text-zinc-700">Køretøj<select className="focus-ring min-h-12 rounded-xl border border-zinc-200 bg-white px-4" defaultValue={defaultVehicleId} name="vehicleId"><option value="">Ikke tilknyttet</option>{vehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.name}</option>)}</select></label>
            <label className="grid gap-2 text-sm font-bold text-zinc-700">Udstyr<select className="focus-ring min-h-12 rounded-xl border border-zinc-200 bg-white px-4" defaultValue={defaultItemId} name="itemId"><option value="">Ikke tilknyttet</option>{items.map((item) => <option key={item.id} value={item.id}>{item.vehicleName} · {item.name}</option>)}</select></label>
            <label className="grid gap-2 text-sm font-bold text-zinc-700 lg:row-span-2">Beskrivelse<textarea className="focus-ring min-h-32 rounded-xl border border-zinc-200 p-4" name="description" placeholder="Kort beskrivelse af hvad videoen gennemgår" /></label>
            <button className="app-button-primary min-h-12 lg:w-fit" type="submit">Tilføj video</button>
          </form>
        </section>

        <section>
          <div><h2 className="text-2xl font-black">Alle videoer</h2><p className="mt-1 text-sm font-semibold text-zinc-600">{videos.length} videoer registreret</p></div>
          <div className="mt-4 grid gap-5 md:grid-cols-2">
            {videos.map((video) => (
              <article className="overflow-hidden rounded-2xl border border-brand-line bg-white shadow-sm" id={`video-${video.id}`} key={video.id}>
                <iframe allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen className="aspect-video w-full" loading="lazy" src={youtubeEmbedUrl(video.youtubeId)} title={video.title} />
                <div className="p-5">
                  <p className="text-xs font-black uppercase tracking-[0.12em] text-brand-red">{video.category}</p>
                  <h3 className="mt-1 text-xl font-black">{video.title}</h3>
                  <p className="mt-2 text-sm text-zinc-600">{video.description || "Ingen beskrivelse."}</p>
                  <p className="mt-3 text-xs font-bold text-zinc-500">{video.vehicleName || "Generel"}{video.itemName ? ` · ${video.itemName}` : ""}</p>
                  <form action={deleteOperationalVideoAction} className="mt-4"><input name="videoId" type="hidden" value={video.id} /><button className="app-button-danger text-sm" type="submit">Slet video</button></form>
                </div>
              </article>
            ))}
            {videos.length === 0 ? <p className="rounded-2xl border border-dashed border-zinc-300 bg-white p-8 font-semibold text-zinc-600 md:col-span-2">Ingen videoer er oprettet endnu.</p> : null}
          </div>
        </section>
      </main>
    </>
  );
}

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
