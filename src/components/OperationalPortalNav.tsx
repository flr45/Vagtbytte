import type { ReactNode } from "react";
import Link from "next/link";

const links = [
  { href: "/admin/operativ-portal", label: "Hjem", icon: "⌂" },
  { href: "/admin/operativ-portal/koeretoejer", label: "Køretøjer", icon: "🚒" },
  { href: "/admin/operativ-portal/videoer", label: "Video", icon: "▶" },
  { href: "/admin/operativ-portal/dokumenter", label: "Viden", icon: "▤" },
  { href: "/admin/operativ-portal/soeg", label: "Søg", icon: "⌕" }
];

export function OperationalPageFrame({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-[calc(100vh-4rem)] bg-[radial-gradient(circle_at_top,#17253b_0,#08111f_38%,#050a12_100%)] pb-28 text-white md:pb-10">
      <div className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-5 sm:px-6 sm:py-7">
        {children}
      </div>
    </main>
  );
}

export function OperationalPortalNav({ isEditor = false }: { isEditor?: boolean }) {
  return (
    <>
      <nav
        aria-label="Operativ Portal"
        className="hidden items-center gap-2 rounded-2xl border border-white/10 bg-[#101b2c]/95 p-2 shadow-xl backdrop-blur md:flex"
      >
        {links.map((link) => (
          <Link
            className="focus-ring flex min-h-12 items-center gap-2 rounded-xl px-4 text-sm font-black text-slate-200 transition hover:bg-white/10 hover:text-white"
            href={link.href}
            key={link.href}
          >
            <span aria-hidden="true" className="text-lg">{link.icon}</span>
            {link.label}
          </Link>
        ))}
        {isEditor ? (
          <span className="ml-auto rounded-full border border-red-300/30 bg-red-500/15 px-3 py-2 text-[11px] font-black uppercase tracking-[0.14em] text-red-200">
            Redigering aktiv
          </span>
        ) : (
          <span className="ml-auto rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-2 text-[11px] font-black uppercase tracking-[0.14em] text-emerald-200">
            Læseadgang
          </span>
        )}
      </nav>

      <nav
        aria-label="Operativ mobilnavigation"
        className="fixed inset-x-3 bottom-[max(.75rem,env(safe-area-inset-bottom))] z-50 grid grid-cols-5 overflow-hidden rounded-2xl border border-white/10 bg-[#0c1626]/95 p-1.5 shadow-2xl backdrop-blur md:hidden"
      >
        {links.map((link) => (
          <Link
            className="focus-ring grid min-h-14 place-items-center gap-0.5 rounded-xl px-1 py-1 text-center text-[10px] font-black text-slate-300 hover:bg-white/10 hover:text-white"
            href={link.href}
            key={link.href}
          >
            <span aria-hidden="true" className="text-xl leading-none">{link.icon}</span>
            <span>{link.label}</span>
          </Link>
        ))}
      </nav>
    </>
  );
}

export function OperationalPortalHeader({
  title,
  description,
  isEditor = false,
  eyebrow = "Station Slagelse"
}: {
  title: string;
  description: string;
  isEditor?: boolean;
  eyebrow?: string;
}) {
  return (
    <section className="relative overflow-hidden rounded-[1.75rem] border border-red-400/20 bg-gradient-to-br from-[#c71924] via-[#9d111a] to-[#51070d] p-6 shadow-2xl sm:p-8">
      <div className="absolute -right-16 -top-20 size-64 rounded-full bg-white/10 blur-2xl" />
      <div className="absolute -bottom-24 left-1/3 size-56 rounded-full bg-black/20 blur-3xl" />
      <div className="relative grid gap-5 sm:grid-cols-[72px_minmax(0,1fr)_auto] sm:items-center">
        <div className="grid size-16 place-items-center rounded-2xl border border-white/20 bg-black/20 text-xl font-black tracking-tight shadow-inner sm:size-[72px]">
          SBR
        </div>
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-red-100/80">{eyebrow}</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-5xl">{title}</h1>
          <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-red-50/85 sm:text-base">
            {description}
          </p>
        </div>
        <span className="w-fit rounded-full border border-white/20 bg-black/20 px-3 py-2 text-[11px] font-black uppercase tracking-[0.14em] text-white">
          {isEditor ? "Administrator" : "Operativ adgang"}
        </span>
      </div>
    </section>
  );
}

export function OperationalPanel({
  children,
  className = ""
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-[1.5rem] border border-white/10 bg-[#101b2c]/90 p-5 shadow-xl ${className}`}>
      {children}
    </section>
  );
}
