import type { ReactNode } from "react";
import Link from "next/link";
import { canAccessOperationalPortal, getCurrentUser } from "@/lib/auth";

export type SbrFireModule = "home" | "alarm" | "vagt" | "operativ" | "more";

type NavItem = {
  key: SbrFireModule;
  href: string;
  label: string;
  icon: string;
};

function vagtHref(role: string) {
  if (role === "BRANDFIGHTER") return "/brandmand";
  if (role === "VC") return "/vagtcentral";
  return "/admin";
}

function navigationFor(user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>) {
  const items: NavItem[] = [
    { key: "home", href: "/app", label: "Hjem", icon: "⌂" }
  ];

  if (user.role === "BRANDFIGHTER") {
    items.push({ key: "alarm", href: "/brandmand/alarmer", label: "Alarmer", icon: "🚨" });
  }

  items.push({
    key: "vagt",
    href: vagtHref(user.role),
    label: user.role === "VC" ? "Vagtcentral" : user.role === "ADMIN" ? "Admin" : "Vagt",
    icon: user.role === "VC" ? "◉" : user.role === "ADMIN" ? "⚙" : "↔"
  });

  if (canAccessOperationalPortal(user)) {
    items.push({ key: "operativ", href: "/admin/operativ-portal", label: "Operativ", icon: "🚒" });
  }

  items.push({ key: "more", href: "/app/mere", label: "Mere", icon: "•••" });
  return items;
}

export async function SbrFireNavigation({ active, desktop = true }: { active: SbrFireModule; desktop?: boolean }) {
  const user = await getCurrentUser();
  if (!user) return null;
  const items = navigationFor(user);

  return (
    <>
      {desktop ? (
        <nav aria-label="SBR Fire App" className="hidden items-center gap-1 rounded-xl border border-white/10 bg-[#0d1317] p-1.5 md:flex">
          {items.map((item) => (
            <Link
              className={`inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm font-black transition ${active === item.key ? "bg-red-600 text-white" : "text-slate-400 hover:bg-white/10 hover:text-white"}`}
              href={item.href}
              key={item.key}
            >
              <span aria-hidden="true">{item.icon}</span>
              {item.label}
            </Link>
          ))}
          <span className="ml-auto hidden rounded-lg bg-white/5 px-3 py-2 text-xs font-bold text-slate-500 lg:block">{user.name}</span>
        </nav>
      ) : null}

      <nav
        aria-label="SBR Fire mobilnavigation"
        className="fixed inset-x-0 bottom-0 z-50 grid border-t border-white/10 bg-[#090e11]/98 pb-[env(safe-area-inset-bottom)] shadow-[0_-12px_32px_rgba(0,0,0,.45)] backdrop-blur md:hidden"
        style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
      >
        {items.map((item) => (
          <Link
            aria-current={active === item.key ? "page" : undefined}
            className={`grid min-h-16 place-items-center content-center gap-1 px-1 py-2 text-center text-[10px] font-black ${active === item.key ? "text-red-500" : "text-slate-400"}`}
            href={item.href}
            key={item.key}
          >
            <span aria-hidden="true" className="text-xl leading-none">{item.icon}</span>
            <span className="truncate">{item.label}</span>
          </Link>
        ))}
      </nav>
    </>
  );
}

export function SbrFireHeader({
  title,
  backHref,
  right,
  eyebrow = "SBR Fire App"
}: {
  title: string;
  backHref?: string;
  right?: ReactNode;
  eyebrow?: string;
}) {
  return (
    <header className="sticky top-0 z-30 -mx-3 -mt-3 border-b border-red-950 bg-[#b70f18] px-3 py-2 text-white shadow-lg sm:-mx-5 sm:-mt-5">
      <div className="grid min-h-12 grid-cols-[48px_minmax(0,1fr)_48px] items-center">
        <div>
          {backHref ? (
            <Link aria-label="Tilbage" className="grid size-11 place-items-center text-3xl font-light" href={backHref}>‹</Link>
          ) : (
            <Link aria-label="SBR Fire App hjem" className="grid size-11 place-items-center text-xl" href="/app">☰</Link>
          )}
        </div>
        <div className="min-w-0 text-center">
          <p className="text-[9px] font-black uppercase tracking-[0.16em] text-red-100/70">{eyebrow}</p>
          <h1 className="truncate text-base font-black sm:text-lg">{title}</h1>
        </div>
        <div className="grid size-11 place-items-center justify-self-end text-xl">{right ?? null}</div>
      </div>
    </header>
  );
}

export function SbrFirePageFrame({
  children,
  title,
  active,
  backHref,
  right,
  eyebrow
}: {
  children: ReactNode;
  title: string;
  active: SbrFireModule;
  backHref?: string;
  right?: ReactNode;
  eyebrow?: string;
}) {
  return (
    <main className="sbr-fire-skin min-h-screen bg-[#070b0e] pb-24 text-white md:pb-8">
      <div className="mx-auto grid w-full max-w-5xl gap-4 px-3 py-3 sm:px-5 sm:py-5">
        <SbrFireHeader backHref={backHref} eyebrow={eyebrow} right={right} title={title} />
        <SbrFireNavigation active={active} />
        {children}
      </div>
    </main>
  );
}
