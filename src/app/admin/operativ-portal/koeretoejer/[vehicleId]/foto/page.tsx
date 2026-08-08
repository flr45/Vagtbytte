import Link from "next/link";
import { notFound } from "next/navigation";
import { UserRole } from "@prisma/client";
import { AppIcon } from "@/components/AppIcon";
import { OperationalQuickImageCapture } from "@/components/OperationalQuickImageCapture";
import {
  OperationalPageFrame,
  OperationalPortalNav,
  OperationalScreenHeader
} from "@/components/OperationalPortalNav";
import { requireRole } from "@/lib/auth";
import {
  getOperationalPhotoPlan,
  nextIncompletePhotoTask,
  type OperationalPhotoTask
} from "@/lib/operativ-photo-workflow";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ vehicleId: string }>;
  searchParams: Promise<{ task?: string | string[]; done?: string | string[] }>;
};

function taskHref(vehicleId: string, task: OperationalPhotoTask) {
  return `/admin/operativ-portal/koeretoejer/${vehicleId}/foto?task=${encodeURIComponent(task.key)}`;
}

export default async function OperationalVehiclePhotoPage({ params, searchParams }: PageProps) {
  await requireRole(UserRole.ADMIN);
  const { vehicleId } = await params;
  const query = await searchParams;
  const requestedKey = typeof query.task === "string" ? query.task : null;
  const done = query.done === "1";
  const plan = await getOperationalPhotoPlan(vehicleId);
  if (!plan) notFound();

  const requestedTask = requestedKey ? plan.tasks.find((task) => task.key === requestedKey) ?? null : null;
  const firstMissing = plan.tasks.find((task) => !task.completed) ?? null;
  const current = requestedTask ?? firstMissing ?? plan.tasks[0] ?? null;
  const next = current ? nextIncompletePhotoTask(plan.tasks, current.key) : null;
  const nextHref = next ? taskHref(vehicleId, next) : `/admin/operativ-portal/koeretoejer/${vehicleId}/foto?done=1`;

  const sections = plan.tasks.reduce<Array<{ name: string; tasks: OperationalPhotoTask[] }>>((groups, task) => {
    const existing = groups.find((group) => group.name === task.section);
    if (existing) existing.tasks.push(task);
    else groups.push({ name: task.section, tasks: [task] });
    return groups;
  }, []);

  return (
    <OperationalPageFrame>
      <OperationalScreenHeader backHref={`/admin/operativ-portal/koeretoejer/${vehicleId}/administration`} right={<AppIcon className="size-5" name="camera" />} title={`Fototur · ${plan.vehicleName}`} />
      <OperationalPortalNav isEditor />

      <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#0d1317] shadow-xl">
        <div className="bg-[#b70f18] px-4 py-4">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-red-100/70">Guidet fotografering</p>
          <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-2xl font-black text-white">{plan.completed}/{plan.total} billeder klar</h1>
              <p className="mt-1 text-xs font-semibold text-red-100/75">Tag køretøjet rundt om først og fortsæt derefter gennem rum og skabe.</p>
            </div>
            <strong className="text-3xl font-black text-white">{plan.percent}%</strong>
          </div>
        </div>
        <div className="h-2 bg-black/40">
          <div className="h-full bg-emerald-500 transition-all" style={{ width: `${plan.percent}%` }} />
        </div>
      </section>

      {done || !firstMissing ? (
        <section className="rounded-2xl border border-emerald-500/25 bg-emerald-500/5 p-5 text-center">
          <AppIcon className="mx-auto size-10 text-emerald-300" name="checkCircle" />
          <h2 className="mt-2 text-xl font-black text-white">Fototuren er færdig</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm font-semibold leading-6 text-slate-400">Alle planlagte køretøjs-, rum- og underområdebilleder har nu et billede. Du kan stadig åbne et punkt nedenfor og tage det om.</p>
          <Link className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg bg-white px-4 text-xs font-black text-black" href={`/admin/operativ-portal/koeretoejer/${vehicleId}/administration`}><AppIcon className="size-4" name="back" /> Tilbage til administration</Link>
        </section>
      ) : current ? (
        <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div>
            <div className="mb-3 rounded-xl border border-red-500/20 bg-red-500/5 p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-red-400">Næste foto</p>
              <div className="mt-1 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-black text-white">{current.label}</h2>
                  <p className="mt-1 text-xs font-bold text-slate-400">{current.section} · {current.detail}</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase ${current.completed ? "bg-emerald-500/15 text-emerald-300" : "bg-amber-500/15 text-amber-300"}`}>{current.completed ? "Har billede" : "Mangler billede"}</span>
              </div>
            </div>

            {current.kind === "vehicle-view" && current.viewKey ? (
              <OperationalQuickImageCapture
                label={`${plan.vehicleName} · ${current.label}`}
                mode="vehicle-view"
                successHref={nextHref}
                vehicleId={vehicleId}
                viewKey={current.viewKey}
              />
            ) : current.placeId ? (
              <OperationalQuickImageCapture
                label={`${plan.vehicleName} · ${current.label}`}
                mode="context"
                nodeId={current.nodeId}
                placeId={current.placeId}
                successHref={nextHref}
                vehicleId={vehicleId}
              />
            ) : null}
          </div>

          <aside className="grid content-start gap-3 rounded-xl border border-white/10 bg-[#0d1317] p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Fototur</p>
            <p className="text-sm font-semibold leading-6 text-slate-300">Når du trykker <strong>Gem og fortsæt</strong>, åbner næste manglende foto automatisk.</p>
            {next ? <div className="rounded-lg border border-white/10 bg-white/5 p-3"><small className="font-black uppercase tracking-wide text-slate-500">Derefter</small><strong className="mt-1 block text-sm text-white">{next.label}</strong><span className="text-xs text-slate-500">{next.section}</span></div> : <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs font-bold text-emerald-300">Dette er sidste manglende foto.</div>}
            {next ? <Link className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 text-xs font-black text-white" href={nextHref}>Spring dette over <AppIcon className="size-4" name="chevronRight" /></Link> : null}
            <Link className="flex min-h-11 items-center justify-center rounded-lg border border-white/10 px-3 text-xs font-black text-slate-300" href={`/admin/operativ-portal/koeretoejer/${vehicleId}/administration`}>Afslut fototur</Link>
          </aside>
        </section>
      ) : null}

      <section className="grid gap-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-red-400">Fotoplan</p>
          <h2 className="mt-1 text-xl font-black text-white">Hele turen</h2>
          <p className="mt-1 text-xs font-semibold text-slate-500">Grøn = billede findes. Gul = mangler. Tryk på et punkt for at tage eller udskifte billedet.</p>
        </div>

        {sections.map((section) => {
          const completed = section.tasks.filter((task) => task.completed).length;
          return (
            <div className="overflow-hidden rounded-xl border border-white/10 bg-[#0d1317]" key={section.name}>
              <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                <strong className="text-sm text-white">{section.name}</strong>
                <span className="rounded-full bg-white/5 px-2.5 py-1 text-[10px] font-black text-slate-400">{completed}/{section.tasks.length}</span>
              </div>
              <div className="divide-y divide-white/5">
                {section.tasks.map((task, index) => (
                  <Link className="grid min-h-14 grid-cols-[36px_minmax(0,1fr)_24px] items-center gap-3 px-4 py-2.5 transition hover:bg-white/5" href={taskHref(vehicleId, task)} key={task.key}>
                    <span className={`grid h-8 w-8 place-items-center rounded-full text-sm font-black ${task.completed ? "bg-emerald-500/15 text-emerald-300" : "bg-amber-500/15 text-amber-300"}`}>{task.completed ? <AppIcon className="size-4" name="checkCircle" /> : index + 1}</span>
                    <span><strong className="block text-sm text-white">{task.label}</strong><small className="text-xs font-semibold text-slate-500">{task.detail}</small></span>
                    <AppIcon className="size-5 text-red-500" name="chevronRight" />
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </section>
    </OperationalPageFrame>
  );
}
