import Link from "next/link";
import { notFound } from "next/navigation";
import { UserRole } from "@prisma/client";
import { OperationalPortalNav } from "@/components/OperationalPortalNav";
import { TopBar } from "@/components/TopBar";
import { requireRole } from "@/lib/auth";
import { createOperationalItemAction } from "@/lib/operativ-portal-actions";
import { getOperationalPlace } from "@/lib/operativ-portal";

export const dynamic = "force-dynamic";
type PageProps = { params: Promise<{ placeId: string }> };

export default async function OperationalPlacePage({ params }: PageProps) {
  await requireRole(UserRole.ADMIN);
  const { placeId } = await params;
  const place = await getOperationalPlace(placeId);
  if (!place) notFound();

  return (
    <>
      <TopBar title={place.name} />
      <main className="mx-auto grid w-full max-w-5xl gap-6 px-4 py-6">
        <OperationalPortalNav />
        <nav className="flex flex-wrap items-center gap-2 text-sm font-semibold text-zinc-600">
          <Link href="/admin/operativ-portal/koeretoejer">Køretøjer</Link><span>›</span>
          <Link href={`/admin/operativ-portal/koeretoejer/${place.vehicleId}`}>{place.vehicleName}</Link><span>›</span>
          <strong className="text-zinc-950">{place.name}</strong>
        </nav>

        <section className="rounded-2xl bg-zinc-950 p-6 text-white shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-red-400">{place.vehicleName} · Rum</p>
          <h1 className="mt-2 text-3xl font-black sm:text-4xl">{place.name}</h1>
          <p className="mt-3 text-sm font-semibold text-zinc-300">{place.items.length} registrerede udstyrsposter.</p>
        </section>

        <details className="rounded-2xl border border-red-200 bg-red-50 p-5">
          <summary className="cursor-pointer text-lg font-black text-red-950">Tilføj udstyr</summary>
          <form action={createOperationalItemAction} className="mt-5 grid gap-4 lg:grid-cols-[minmax(180px,1fr)_100px_minmax(220px,1.3fr)_auto] lg:items-end">
            <input name="placeId" type="hidden" value={place.id} />
            <label className="grid gap-2 text-sm font-bold text-zinc-700">Navn<input className="focus-ring min-h-12 rounded-xl border border-zinc-200 px-4" name="name" placeholder="Fx Højtryksslange (HT)" required /></label>
            <label className="grid gap-2 text-sm font-bold text-zinc-700">Antal<input className="focus-ring min-h-12 rounded-xl border border-zinc-200 px-4" defaultValue="1" min="1" name="quantity" required type="number" /></label>
            <label className="grid gap-2 text-sm font-bold text-zinc-700">Note<input className="focus-ring min-h-12 rounded-xl border border-zinc-200 px-4" name="note" placeholder="Placering eller bemærkning" /></label>
            <button className="app-button-primary min-h-12" type="submit">Tilføj</button>
          </form>
        </details>

        <section>
          <div className="flex items-end justify-between gap-4"><div><h2 className="text-2xl font-black">Pakkeliste</h2><p className="mt-1 text-sm font-semibold text-zinc-600">Indhold i {place.name}.</p></div></div>
          <div className="mt-4 overflow-hidden rounded-2xl border border-brand-line bg-white shadow-sm">
            {place.items.map((item) => (
              <Link className="grid grid-cols-[48px_minmax(0,1fr)_auto_auto] items-center gap-3 border-b border-zinc-100 p-4 last:border-b-0 hover:bg-red-50" href={`/admin/operativ-portal/udstyr/${item.id}`} key={item.id}>
                <span className="grid size-11 place-items-center rounded-lg bg-zinc-950 text-[10px] font-black text-white">UD</span>
                <span className="min-w-0"><strong className="block truncate">{item.name}</strong><small className="block truncate text-zinc-500">{item.note || "Ingen note"}</small></span>
                <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-black">× {item.quantity}</span>
                <span className="text-xs font-black text-brand-red">Åbn</span>
              </Link>
            ))}
            {place.items.length === 0 ? <p className="p-8 text-center text-sm font-semibold text-zinc-600">Rummet er tomt. Tilføj den første udstyrspost ovenfor.</p> : null}
          </div>
        </section>
      </main>
    </>
  );
}
