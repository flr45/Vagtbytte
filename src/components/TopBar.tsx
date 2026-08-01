import { logoutAction } from "@/lib/actions";
import { getCurrentUser, roleHome } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BellIcon, HomeIcon, LogOutIcon } from "./Icons";

export async function TopBar({ title }: { title: string }) {
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

  return (
    <header className="border-b border-brand-line bg-white pt-[env(safe-area-inset-top)]">
      <div className="mx-auto grid w-full max-w-5xl gap-3 px-[max(1rem,env(safe-area-inset-left))] py-3 pr-[max(1rem,env(safe-area-inset-right))] sm:min-h-16 sm:grid-cols-[1fr_auto] sm:items-center">
        <p className="min-w-0 break-words text-lg font-bold">{title}</p>
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {user ? (
            <a className="app-button-secondary min-h-11 px-3 text-sm" href={roleHome[user.role]}>
              <HomeIcon className="size-4" />
              Forside
            </a>
          ) : null}
          {user?.role === "BRANDFIGHTER" ? (
            <a className="app-button-secondary min-h-11 px-3 text-sm" href="/brandmand/alarmer">
              <span aria-hidden="true">🚨</span>
              Alarmfeed
            </a>
          ) : null}
          {user?.hasAdminAccess && user.role !== "ADMIN" ? (
            <a className="app-button-secondary min-h-11 px-3 text-sm" href="/admin">
              Administration
            </a>
          ) : null}
          {user?.role !== "ADMIN" ? (
            <a
              className="app-button-secondary relative min-h-11 min-w-11 px-3 text-sm"
              href={notificationPath}
              aria-label="Notifikationer"
            >
              <BellIcon className="size-4" />
              <span className="sr-only">Notifikationer</span>
              {unreadCount > 0 ? (
                <span className="ml-1 rounded-full bg-brand-red px-2 py-0.5 text-xs text-white">{unreadCount}</span>
              ) : null}
            </a>
          ) : null}
          <form action={logoutAction}>
            <button className="app-button-secondary min-h-11 px-3 text-sm">
              <LogOutIcon className="size-4" />
              Log ud
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
