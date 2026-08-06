import Link from "next/link";

const links = [
  { href: "/admin/operativ-portal", label: "Overblik" },
  { href: "/admin/operativ-portal/koeretoejer", label: "Køretøjer" },
  { href: "/admin/operativ-portal/videoer", label: "Videoakademi" },
  { href: "/admin/operativ-portal/dokumenter", label: "Dokumenter" },
  { href: "/admin/operativ-portal/soeg", label: "Søg" }
];

export function OperationalPortalNav() {
  return (
    <nav aria-label="Operativ Portal" className="flex gap-2 overflow-x-auto pb-1">
      {links.map((link) => (
        <Link
          className="focus-ring whitespace-nowrap rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm font-black text-zinc-800 shadow-sm hover:border-red-300 hover:bg-red-50"
          href={link.href}
          key={link.href}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}

export function OperationalPortalHeader({
  title,
  description
}: {
  title: string;
  description: string;
}) {
  return (
    <section className="overflow-hidden rounded-2xl bg-zinc-950 p-5 text-white shadow-sm sm:p-7">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-red-400">
        SBR Portal · Kun administratorer
      </p>
      <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">{title}</h1>
      <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-zinc-300 sm:text-base">
        {description}
      </p>
    </section>
  );
}
