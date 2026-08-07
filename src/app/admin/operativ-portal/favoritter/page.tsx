import Link from "next/link";
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
  listOperationalFavorites,
  listOperationalRecent,
  operationalTargetTypeLabel,
  type OperationalPersonalEntry
} from "@/lib/operativ-portal-personal";
import { operationalImageUrl } from "@/lib/operativ-portal";

export const dynamic = "force-dynamic";

export default async function OperationalFavoritesPage() {
  const user = await requireOperationalPortalAccess();
  const isEditor = canManageOperationalPortal(user);
  const [favorites, recent] = await Promise.all([
    listOperationalFavorites(user.id, 50),
    listOperationalRecent(user.id, 10)
  ]);

  return (
    <OperationalPageFrame>
      <OperationalScreenHeader backHref="/admin/operativ-portal" right="" title="Favoritter" />
      <OperationalPortalNav isEditor={isEditor} />

      <section>
        <div className="mb-2 flex items-center justify-between px-1">
          <h2 className="text-sm font-black">Mine favoritter</h2>
          <span className="text-xs font-bold text-slate-500">{favorites.length}</span>
        </div>
        <div className="grid gap-2 md:grid-cols-2">
          {favorites.map((entry) => <PersonalEntry entry={entry} key={`${entry.type}-${entry.id}`} />)}
          {favorites.length === 0 ? (
            <div className="col-span-full rounded-xl border border-dashed border-white/15 bg-[#11171b] p-7 text-center">
              <p className="text-sm font-bold text-slate-300">Ingen favoritter endnu</p>
              <p className="mt-2 text-xs leading-5 text-slate-500">Åbn et køretøj, rum eller udstyr og tryk på stjernen for at gemme det her.</p>
            </div>
          ) : null}
        </div>
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between px-1">
          <h2 className="text-sm font-black">Senest sete</h2>
          <span className="text-xs font-bold text-slate-500">De seneste {Math.min(recent.length, 10)}</span>
        </div>
        <div className="grid gap-2 md:grid-cols-2">
          {recent.map((entry) => <PersonalEntry entry={entry} key={`${entry.type}-${entry.id}`} />)}
          {recent.length === 0 ? <p className="col-span-full rounded-lg bg-[#11171b] p-4 text-sm text-slate-500">Du har ikke åbnet noget indhold endnu.</p> : null}
        </div>
      </section>
    </OperationalPageFrame>
  );
}

function PersonalEntry({ entry }: { entry: OperationalPersonalEntry }) {
  return (
    <Link className="grid min-h-[72px] grid-cols-[68px_minmax(0,1fr)_22px] items-center gap-3 rounded-lg border border-white/5 bg-[#11171b] p-2 hover:bg-[#161e23]" href={entry.href}>
      {entry.coverImageId ? (
        <img alt="" className="h-14 w-[68px] rounded-md bg-[#20272c] object-cover" src={operationalImageUrl(entry.coverImageId)} />
      ) : (
        <div className="grid h-14 w-[68px] place-items-center rounded-md bg-[#20272c] text-[10px] font-black uppercase text-slate-500">{operationalTargetTypeLabel(entry.type)}</div>
      )}
      <span className="min-w-0">
        <strong className="block truncate text-sm">{entry.title}</strong>
        <small className="mt-1 block truncate text-xs text-slate-500">{entry.subtitle}</small>
        <span className="mt-1 inline-flex rounded bg-red-600/15 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider text-red-400">{operationalTargetTypeLabel(entry.type)}</span>
      </span>
      <span className="text-xl text-slate-500">›</span>
    </Link>
  );
}
