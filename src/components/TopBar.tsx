import Link from "next/link";
import { logoutAction } from "@/lib/actions";
import { canAccessOperationalPortal, getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BellIcon, LogOutIcon } from "./Icons";
import { SbrFireNavigation, type SbrFireModule } from "./SbrFireApp";

type TopBarProps = {
  title: string;
  variant?: "default" | "operational";
  activeModule?: SbrFireModule;
};

export async function TopBar({ title, activeModule = "vagt" }: TopBarProps) {
  const user = await getCurrentUser();
  const unreadCount = user
    ? await prisma.notification.count({
        where: { recipientUserId: user.id, readAt: null, publishedAt: { not: null }, cancelledAt: null }
      })
    : 0;
  const notificationPath =
    user?.role === "VC"
      ? "/vagtcentral/notifikationer"
      : user?.role === "BRANDFIGHTER"
        ? "/brandmand/notifikationer"
        : "/admin";
  const hasAdminAccess = Boolean(user && (user.role === "ADMIN" || user.hasAdminAccess));
  const hasOperationalAccess = canAccessOperationalPortal(user);

  return (
    <>
      <header className="border-b border-red-950 bg-[#b70f18] pt-[env(safe-area-inset-top)] text-white shadow-lg">
        <div className="mx-auto grid min-h-16 w-full max-w-6xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-[max(1rem,env(safe-area-inset-left))] py-3 pr-[max(1rem,env(safe-area-inset-right))]">
          <Link className="min-w-0" href="/app">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-red-100/70">SBR Fire App</p>
            <p className="mt-0.5 truncate text-lg font-black text-white">{title}</p>
            {user ? <p className="mt-0.5 hidden truncate text-xs font-semibold text-red-100/70 sm:block">{user.name}</p> : null}
          </Link>

          <nav aria-label="Hovednavigation" className="hidden min-w-0 flex-wrap items-center justify-end gap-2 sm:flex">
            {user ? <Link className="min-h-10 rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-sm font-black text-white hover:bg-white/15" href="/app">Hjem</Link> : null}
            {user?.role === "BRANDFIGHTER" ? <Link className="min-h-10 rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-sm font-black text-white hover:bg-white/15" href="/brandmand/alarmer">🚨 Alarmer</Link> : null}
            {hasOperationalAccess ? <Link className="min-h-10 rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-sm font-black text-white hover:bg-white/15" href="/admin/operativ-portal">🚒 Operativ</Link> : null}
            {hasAdminAccess && user?.role !== "ADMIN" ? <Link className="min-h-10 rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-sm font-black text-white hover:bg-white/15" href="/admin">Admin</Link> : null}
            {user?.role !== "ADMIN" ? (
              <Link aria-label={unreadCount > 0 ? `Notifikationer, ${unreadCount} ulæste` : "Notifikationer"} className="relative grid min-h-10 min-w-10 place-items-center rounded-lg border border-white/15 bg-white/10 px-3 text-white hover:bg-white/15" href={notificationPath}>
                <BellIcon className="size-4" />
                {unreadCount > 0 ? <span className="absolute -right-1 -top-1 grid min-h-5 min-w-5 place-items-center rounded-full bg-white px-1 text-[10px] font-black text-red-700">{unreadCount > 99 ? "99+" : unreadCount}</span> : null}
              </Link>
            ) : null}
            <form action={logoutAction}>
              <button className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-white/15 bg-white/10 px-3 text-sm font-black text-white hover:bg-white/15" type="submit"><LogOutIcon className="size-4" />Log ud</button>
            </form>
          </nav>

          <Link className="relative grid size-11 place-items-center rounded-lg border border-white/15 bg-white/10 text-white sm:hidden" href="/app/mere" aria-label="Mere">•••</Link>
        </div>
      </header>
      <SbrFireNavigation active={activeModule} desktop={false} />
    </>
  );
}
