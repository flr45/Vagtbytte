import Link from "next/link";
import { AppIcon, type AppIconName } from "@/components/AppIcon";
import { SbrFirePageFrame } from "@/components/SbrFireApp";
import { logoutAction } from "@/lib/actions";
import { canAccessOperationalPortal, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function SbrFireMorePage() {
  const user = await requireUser();
  const hasAdminAccess = user.role === "ADMIN" || user.hasAdminAccess;
  const hasOperationalAccess = canAccessOperationalPortal(user);
  const notificationPath = user.role === "VC" ? "/vagtcentral/notifikationer" : "/brandmand/notifikationer";
  const [unreadCount, account] = await Promise.all([
    user.role === "ADMIN" ? Promise.resolve(0) : prisma.notification.count({
      where: { recipientUserId: user.id, readAt: null, publishedAt: { not: null }, cancelledAt: null }
    }),
    prisma.user.findUnique({ where: { id: user.id }, select: { email: true } })
  ]);

  return (
    <SbrFirePageFrame active="more" backHref="/app" title="Mere">
      <section className="rounded-2xl border border-white/10 bg-[#0d1317] p-5 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-red-400">Profil</p>
            <h2 className="mt-1 text-2xl font-black text-white">{user.name}</h2>
          </div>
          <Link className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-black text-red-300 transition hover:bg-red-500/20" href="/app/profil">
            <AppIcon className="size-4" name="edit" /> Rediger
          </Link>
        </div>
        <div className="mt-3 grid gap-2 text-sm font-semibold text-slate-400 sm:grid-cols-2">
          <p>Rolle: <strong className="text-white">{roleLabel(user.role)}</strong></p>
          <p>Medarbejdernummer: <strong className="text-white">{user.employeeNumber ?? "—"}</strong></p>
          <p className="sm:col-span-2 break-words">E-mail: <strong className="text-white">{account?.email ?? "Ikke registreret"}</strong></p>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#0d1317] shadow-xl">
        <MenuLink description="Navn, e-mail og adgangskode" href="/app/profil" icon="user" title="Mine oplysninger" />
        {user.role !== "ADMIN" ? <MenuLink description={unreadCount ? `${unreadCount} ulæste` : "Se beskeder og hændelser"} href={notificationPath} icon="bell" title="Notifikationer" /> : null}
        {hasOperationalAccess ? <MenuLink description="Køretøjer, søgning, QR og favoritter" href="/admin/operativ-portal" icon="truck" title="Operativ" /> : null}
        {hasAdminAccess ? <MenuLink description="Brugere, alarmer, system og opsætning" href="/admin" icon="settings" title="Administration" /> : null}
        {user.role === "VC" ? <MenuLink description="Tidligere vagtsager og hændelser" href="/vagtcentral/historik" icon="history" title="Historik" /> : null}
      </section>

      <section className="rounded-2xl border border-white/10 bg-[#0d1317] p-4 shadow-xl">
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-red-400">Sådan installerer du appen</p>
        <h2 className="mt-1 text-lg font-black text-white">SBR Fire App på hjemmeskærmen</h2>
        <p className="mt-2 text-sm font-semibold leading-6 text-slate-400">Installer siden som en app, så SBR Fire åbner i sit eget vindue uden browserbjælker.</p>

        <div className="mt-4 grid gap-4">
          <InstallGuide
            title="iPhone / iPad (Safari)"
            steps={[
              "Åbn SBR Fire App i Safari.",
              "Tryk på Del-knappen (firkant med pil op).",
              "Rul ned og vælg “Føj til hjemmeskærm”.",
              "Tryk “Tilføj”."
            ]}
          />
          <InstallGuide
            title="Android (Chrome)"
            steps={[
              "Åbn SBR Fire App i Chrome.",
              "Tryk på menuen med tre prikker øverst til højre.",
              "Vælg “Installer app” eller “Føj til startskærm”.",
              "Bekræft med “Installer” eller “Tilføj”."
            ]}
          />
        </div>
      </section>

      <form action={logoutAction}>
        <button className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 text-sm font-black text-red-300 transition hover:bg-red-500/20" type="submit"><AppIcon className="size-5" name="logout" /> Log ud</button>
      </form>
    </SbrFirePageFrame>
  );
}

function MenuLink({ title, description, href, icon }: { title: string; description: string; href: string; icon: AppIconName }) {
  return (
    <Link className="grid min-h-20 grid-cols-[44px_minmax(0,1fr)_24px] items-center gap-3 border-b border-white/5 px-4 py-3 transition last:border-b-0 hover:bg-white/5" href={href}>
      <span className="grid size-10 place-items-center rounded-xl bg-white/5 text-slate-300"><AppIcon className="size-5" name={icon} /></span>
      <span><strong className="block text-sm font-black text-white">{title}</strong><small className="mt-1 block text-xs font-semibold text-slate-500">{description}</small></span>
      <AppIcon className="size-5 text-red-500" name="chevronRight" />
    </Link>
  );
}

function InstallGuide({ title, steps }: { title: string; steps: string[] }) {
  return (
    <div className="rounded-xl border border-white/10 bg-[#080d10] p-4">
      <div className="flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-xl bg-white/5 text-slate-200"><AppIcon className="size-5" name="phone" /></span>
        <h3 className="text-sm font-black text-white">{title}</h3>
      </div>
      <ol className="mt-4 grid gap-3">
        {steps.map((step, index) => (
          <li className="grid grid-cols-[28px_minmax(0,1fr)] items-start gap-3 text-sm font-semibold leading-5 text-slate-400" key={step}>
            <span className="grid size-7 place-items-center rounded-full border border-white/15 bg-white/5 text-xs font-black text-slate-200">{index + 1}</span>
            <span className="pt-1">{step}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function roleLabel(role: string) {
  if (role === "BRANDFIGHTER") return "Brandmand";
  if (role === "VC") return "Vagtcentral";
  return "Administrator";
}
