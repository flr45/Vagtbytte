import { logoutAction } from "@/lib/actions";
import { getCurrentUser, roleHome } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
    <header className="border-b border-brand-line bg-white">
      <div className="mx-auto flex min-h-16 w-full max-w-5xl items-center justify-between gap-3 px-4">
        <p className="text-lg font-bold">{title}</p>
        <div className="flex items-center gap-2">
          {user?.role !== "ADMIN" ? (
            <a
              className="focus-ring relative inline-flex min-h-11 min-w-11 items-center justify-center rounded-md border border-zinc-300 px-3 text-sm font-bold text-zinc-900"
              href={notificationPath}
              aria-label="Notifikationer"
            >
              Klokke
              {unreadCount > 0 ? (
                <span className="ml-2 rounded-full bg-brand-red px-2 py-0.5 text-xs text-white">{unreadCount}</span>
              ) : null}
            </a>
          ) : null}
          <form action={logoutAction}>
            <button className="focus-ring min-h-11 rounded-md border border-zinc-300 px-4 text-sm font-semibold text-zinc-900">
              Log ud
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
