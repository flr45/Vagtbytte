import Link from "next/link";
import { logoutAction } from "@/lib/actions";
import {
  canAccessOperationalPortal,
  getCurrentUser,
  roleHome
} from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BellIcon, HomeIcon, LogOutIcon } from "./Icons";

type TopBarProps = {
  title: string;
  variant?: "default" | "operational";
};

export async function TopBar({ title, variant = "default" }: TopBarProps) {
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
        : roleHome.ADMIN;
  const hasAdminAccess = Boolean(user && (user.role === "ADMIN" || user.hasAdminAccess));
  const hasOperationalAccess = canAccessOperationalPortal(user);
  const operational = variant === "operational";

  return (
    <header
      className={
        operational
          ? "border-b border-red-950/60 bg-gradient-to-r from-[#8f0d16] via-[#b5121b] to-[#720911] pt-[env(safe-area-inset-top)] text-white shadow-lg"
          : "border-b border-brand-line bg-white/95 pt-[env(safe-area-inset-top)] shadow-sm backdrop-blur"
      }
    >
      <div className="mx-auto grid min-h-16 w-full max-w-6xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-[max(1rem,env(safe-area-inset-left))] py-3 pr-[max(1rem,env(safe-area-inset-right))]">
        <div className="min-w-0">
          <p className={operational ? "text-xs font-black uppercase tracking-[0.16em] text-red-100" : "text-xs font-black uppercase tracking-[0.14em] text-brand-red"}>
            {operational ? "SBR Operativ" : "SBR Portal"}
          </p>
          <p className="mt-0.5 truncate text-lg font-bold">{title}</p>
          {user ? (
            <p className={operational ? "mt-0.5 hidden truncate text-xs font-semibold text-red-100/80 sm:block" : "mt-0.5 hidden truncate text-xs font-semibold text-zinc-500 sm:block"}>
              Logget ind som {user.name}
            </p>
          ) : null}
        </div>

        <MobileNavigation
          hasAdminAccess={hasAdminAccess}
          hasOperationalAccess={hasOperationalAccess}
          notificationPath={notificationPath}
          unreadCount={unreadCount}
          user={user}
        />

        <nav aria-label="Hovednavigation" className="hidden min-w-0 flex-wrap items-center justify-end gap-2 sm:flex">
          {user ? (
            <Link className="app-button-secondary min-h-11 px-3 text-sm" href={roleHome[user.role]}>
              <HomeIcon className="size-4" />
              Forside
            </Link>
          ) : null}
          {user?.role === "BRANDFIGHTER" ? (
            <Link className="app-button-secondary min-h-11 px-3 text-sm" href="/brandmand/alarmer">
              <span aria-hidden="true">🚨</span>
              Alarmfeed
            </Link>
          ) : null}
          {user?.role === "VC" ? (
            <Link className="app-button-secondary min-h-11 px-3 text-sm" href="/vagtcentral/historik">
              Historik
            </Link>
          ) : null}
          {hasOperationalAccess ? (
            <Link className="app-button-secondary min-h-11 px-3 text-sm" href="/admin/operativ-portal">
              Operativ Portal
            </Link>
          ) : null}
          {user?.hasAdminAccess && user.role !== "ADMIN" ? (
            <Link className="app-button-secondary min-h-11 px-3 text-sm" href="/admin">
              Administration
            </Link>
          ) : null}
          {user?.role !== "ADMIN" ? (
            <Link
              aria-label={unreadCount > 0 ? `Notifikationer, ${unreadCount} ulæste` : "Notifikationer"}
              className="app-button-secondary relative min-h-11 min-w-11 px-3 text-sm"
              href={notificationPath}
            >
              <BellIcon className="size-4" />
              <span className="sr-only">Notifikationer</span>
              {unreadCount > 0 ? (
                <span className="ml-1 rounded-full bg-brand-red px-2 py-0.5 text-xs text-white">{unreadCount}</span>
              ) : null}
            </Link>
          ) : null}
          <form action={logoutAction}>
            <button className="app-button-secondary min-h-11 px-3 text-sm" type="submit">
              <LogOutIcon className="size-4" />
              Log ud
            </button>
          </form>
        </nav>
      </div>
    </header>
  );
}

function MobileNavigation({
  user,
  notificationPath,
  unreadCount,
  hasAdminAccess,
  hasOperationalAccess
}: {
  user: Awaited<ReturnType<typeof getCurrentUser>>;
  notificationPath: string;
  unreadCount: number;
  hasAdminAccess: boolean;
  hasOperationalAccess: boolean;
}) {
  if (!user) {
    return null;
  }

  return (
    <nav aria-label="Mobilnavigation" className="flex items-center justify-end gap-2 sm:hidden">
      <Link
        aria-label="Forside"
        className="app-button-secondary min-h-11 min-w-11 px-3"
        href={roleHome[user.role]}
      >
        <HomeIcon className="size-4" />
      </Link>

      {user.role === "BRANDFIGHTER" ? (
        <Link aria-label="Alarmfeed" className="app-button-secondary min-h-11 min-w-11 px-3" href="/brandmand/alarmer">
          <span aria-hidden="true">🚨</span>
        </Link>
      ) : null}

      {user.role !== "ADMIN" ? (
        <Link
          aria-label={unreadCount > 0 ? `Notifikationer, ${unreadCount} ulæste` : "Notifikationer"}
          className="app-button-secondary relative min-h-11 min-w-11 px-3"
          href={notificationPath}
        >
          <BellIcon className="size-4" />
          {unreadCount > 0 ? (
            <span className="absolute -right-1 -top-1 grid min-h-5 min-w-5 place-items-center rounded-full bg-brand-red px-1 text-[11px] font-black text-white">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          ) : null}
        </Link>
      ) : null}

      <details className="relative">
        <summary className="app-button-secondary min-h-11 cursor-pointer list-none px-3 text-sm">Menu</summary>
        <div className="absolute right-0 z-50 mt-2 grid min-w-56 gap-2 rounded-2xl border border-zinc-200 bg-white p-2 text-zinc-950 shadow-xl">
          {user.role === "VC" ? (
            <Link className="app-button-secondary w-full justify-start text-sm" href="/vagtcentral/historik">
              Historik
            </Link>
          ) : null}
          {hasOperationalAccess ? (
            <Link className="app-button-secondary w-full justify-start text-sm" href="/admin/operativ-portal">
              Operativ Portal
            </Link>
          ) : null}
          {hasAdminAccess && user.role !== "ADMIN" ? (
            <Link className="app-button-secondary w-full justify-start text-sm" href="/admin">
              Administration
            </Link>
          ) : null}
          <form action={logoutAction}>
            <button className="app-button-secondary w-full justify-start text-sm" type="submit">
              <LogOutIcon className="size-4" />
              Log ud
            </button>
          </form>
        </div>
      </details>
    </nav>
  );
}
