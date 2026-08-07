import type { ReactNode } from "react";
import Link from "next/link";
import { AppIcon } from "@/components/AppIcon";
import { OperationalContextTools } from "@/components/OperationalEntityTools";
import { OperationalPwaManager } from "@/components/OperationalPwaManager";
import { SbrFireNavigation } from "@/components/SbrFireApp";

export function OperationalPageFrame({ children }: { children: ReactNode }) {
  return (
    <main className="sbr-fire-skin min-h-[calc(100vh-4rem)] bg-[#070b0e] pb-24 text-white md:pb-10">
      <div className="mx-auto grid w-full max-w-5xl gap-4 px-3 py-3 sm:px-5 sm:py-5">
        {children}
      </div>
      <OperationalPwaManager />
      <OperationalContextTools />
    </main>
  );
}

export function OperationalPortalNav({ isEditor = false }: { isEditor?: boolean }) {
  return (
    <>
      <nav aria-label="Operativ Portal" className="hidden items-center gap-1 rounded-xl border border-white/10 bg-[#0d1317] p-1.5 md:flex">
        <Link className="operativ-nav-link" href="/admin/operativ-portal">Forside</Link>
        <Link className="operativ-nav-link" href="/admin/operativ-portal/koeretoejer">Køretøjer</Link>
        <Link className="operativ-nav-link" href="/admin/operativ-portal/favoritter">Favoritter</Link>
        <Link className="operativ-nav-link" href="/admin/operativ-portal/videoer">Videoakademi</Link>
        <Link className="operativ-nav-link" href="/admin/operativ-portal/dokumenter">Videnbank</Link>
        <Link className="operativ-nav-link" href="/admin/operativ-portal/soeg">Søg</Link>
        <Link className="operativ-nav-link ml-auto" href="/app">SBR Fire App</Link>
        <span className="rounded-md bg-[#171d21] px-2.5 py-2 text-[10px] font-black uppercase tracking-[0.13em] text-slate-400">
          {isEditor ? "Admin" : "Læseadgang"}
        </span>
      </nav>
      <SbrFireNavigation active="operativ" desktop={false} />
    </>
  );
}

export function OperationalScreenHeader({
  title,
  backHref,
  right
}: {
  title: string;
  backHref?: string;
  right?: ReactNode;
}) {
  return (
    <header className="sticky top-0 z-30 -mx-3 -mt-3 grid min-h-14 grid-cols-[52px_minmax(0,1fr)_52px] items-center border-b border-red-950 bg-[#b70f18] px-2 text-white shadow-lg sm:-mx-5 sm:-mt-5">
      <div>
        {backHref ? (
          <Link aria-label="Tilbage" className="grid size-11 place-items-center rounded-lg transition hover:bg-white/10" href={backHref}><AppIcon className="size-6" name="back" /></Link>
        ) : (
          <Link aria-label="SBR Fire App" className="grid size-11 place-items-center rounded-lg transition hover:bg-white/10" href="/app"><AppIcon className="size-6" name="menu" /></Link>
        )}
      </div>
      <h1 className="truncate text-center text-base font-bold sm:text-lg">{title}</h1>
      <span className="grid size-11 place-items-center justify-self-end text-slate-100">{right ?? <AppIcon className="size-5" name="star" />}</span>
    </header>
  );
}

export function OperationalPortalHeader({
  title,
  description,
  isEditor = false,
  eyebrow = "Slagelse Brand og Redning"
}: {
  title: string;
  description: string;
  isEditor?: boolean;
  eyebrow?: string;
}) {
  return (
    <section className="rounded-xl border border-white/10 bg-[#0d1317] p-5 shadow-xl">
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-red-500">{eyebrow}</p>
      <h1 className="mt-2 text-3xl font-black tracking-tight">{title}</h1>
      <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-slate-400">{description}</p>
      {isEditor ? <span className="mt-3 inline-flex rounded bg-red-600/15 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-red-400">Administrator</span> : null}
    </section>
  );
}

export function OperationalPanel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-xl border border-white/10 bg-[#0d1317] p-4 shadow-lg ${className}`}>{children}</section>;
}

export function OperationalTabs({
  items
}: {
  items: Array<{ href: string; label: string; active?: boolean }>;
}) {
  return (
    <nav className="flex overflow-x-auto border-b border-white/10 bg-[#0a0f12] px-1">
      {items.map((item) => (
        <a className={`whitespace-nowrap border-b-2 px-3 py-3 text-xs font-bold ${item.active ? "border-red-500 text-red-500" : "border-transparent text-slate-400"}`} href={item.href} key={item.label}>{item.label}</a>
      ))}
    </nav>
  );
}
