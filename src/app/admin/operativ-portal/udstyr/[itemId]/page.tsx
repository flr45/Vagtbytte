import Link from "next/link";
import { notFound } from "next/navigation";
import { UserRole } from "@prisma/client";
import { OperationalPortalNav } from "@/components/OperationalPortalNav";
import { TopBar } from "@/components/TopBar";
import { requireRole } from "@/lib/auth";
import { getOperationalItem, youtubeEmbedUrl } from "@/lib/operativ-portal";

export const dynamic = "force-dynamic";
type PageProps = { params: Promise<{ itemId: string }> };

export default async function OperationalItemPage({ params }: PageProps) {
  await requireRole(UserRole.ADMIN);
  const { itemId } = await params;
  const item = await getOperationalItem(itemId);
  if (!item) notFound();

  return (
    <>
      <TopBar title={item.name} />
      <main className="mx-auto grid w-full max-w-5xl gap-6 px-4 py-6">
        <OperationalPortalNav />
        <nav className="flex flex-wrap items-center gap-2 text-sm font-semibold text-zinc-600">
          <Link href="/admin/operativ-portal/koeretoejer">Køretøjer</Link><span>›</span>
          <Link href={`/admin/operativ-portal/koeretoejer/${item.vehicleId}`}>{item.vehicleName}</Link><span>›</span>
          <Link href={`/admin/operativ-portal/rum/${item.placeId}`}>{item.placeName}</Link><span>›</span>
          <strong className="text-zinc-950">{item.name}</strong>
        </nav>

        <section className="rounded-2xl bg-zinc-950 p-6 text-white shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-red-400">Udstyr · {item.vehicleName}</p>
          <h1 className="mt-2 text-3xl font-black sm:text-4xl">{item.name}</h1>
          <p className="mt-3 text-sm font-semibold text-zinc-300">Placeret i {item.placeName}.</p>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-brand-line bg-white p-5 shadow-sm">
            <h2 className="text-xl font-black">Registrerede oplysninger</h2>
            <dl className="mt-4 grid gap-3">
              <Fact label="Køretøj" value={item.vehicleName} />
              <Fact label="Placering" value={item.placeName} />
              <Fact label="Antal" value={String(item.quantity)} />
              <Fact label="Note" value={item.note || "Ingen note tilføjet"} />
            </dl>
          </div>
          <div className="rounded-2xl border border-brand-line bg-white p-5 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.13em] text-brand-red">Læring</p>
            <h2 className="mt-1 text-xl font-black">Instruktioner</h2>
            <p className="mt-2 text-sm font-semibold text-zinc-600">Tilknyt en YouTube-video for at vise betjening, kontrol eller sikkerhedspunkter.</p>
            <Link className="app-button-primary mt-5" href={`/admin/operativ-portal/videoer?itemId=${item.id}&vehicleId=${item.vehicleId}`}>Tilføj video</Link>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-black">Videoer</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {item.videos.map((video) => (
              <article className="overflow-hidden rounded-2xl border border-brand-line bg-white shadow-sm" key={video.id}>
                <iframe allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen className="aspect-video w-full" loading="lazy" src={youtubeEmbedUrl(video.youtubeId)} title={video.title} />
                <div className="p-4"><p className="text-xs font-black uppercase tracking-[0.12em] text-brand-red">{video.category}</p><h3 className="mt-1 text-lg font-black">{video.title}</h3><p className="mt-2 text-sm text-zinc-600">{video.description || "Ingen beskrivelse."}</p></div>
              </article>
            ))}
            {item.videos.length === 0 ? <p className="rounded-2xl border border-dashed border-zinc-300 bg-white p-8 font-semibold text-zinc-600 md:col-span-2">Der er endnu ikke tilknyttet en video.</p> : null}
          </div>
        </section>
      </main>
    </>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return <div className="grid grid-cols-[100px_minmax(0,1fr)] gap-3 border-t border-zinc-100 pt-3 first:border-t-0 first:pt-0"><dt className="text-sm font-bold text-zinc-500">{label}</dt><dd className="m-0 text-sm font-black text-zinc-900">{value}</dd></div>;
}
