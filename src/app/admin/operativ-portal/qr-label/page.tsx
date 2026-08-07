import Link from "next/link";
import { notFound } from "next/navigation";
import { OperationalPrintButton } from "@/components/OperationalPrintButton";
import {
  OperationalPageFrame,
  OperationalPortalNav,
  OperationalScreenHeader
} from "@/components/OperationalPortalNav";
import {
  canManageOperationalPortal,
  requireOperationalPortalAccess
} from "@/lib/auth";
import {
  operationalTargetTypeLabel,
  resolveOperationalTarget,
  type OperationalTargetType
} from "@/lib/operativ-portal-personal";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ type?: string | string[]; id?: string | string[] }>;
};

export default async function OperationalQrLabelPage({ searchParams }: PageProps) {
  const user = await requireOperationalPortalAccess();
  const isEditor = canManageOperationalPortal(user);
  const params = await searchParams;
  const typeValue = Array.isArray(params.type) ? params.type[0] : params.type;
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  if (!isTargetType(typeValue) || !id || !/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const target = await resolveOperationalTarget(typeValue, id);
  if (!target) notFound();
  const qrSrc = `/api/admin/operativ-portal/qr?path=${encodeURIComponent(target.href)}`;

  return (
    <OperationalPageFrame>
      <div className="print:hidden">
        <OperationalScreenHeader backHref={target.href} right="" title="QR-label" />
        <OperationalPortalNav isEditor={isEditor} />
      </div>

      <section className="mx-auto grid w-full max-w-md gap-4 rounded-2xl border border-white/10 bg-white p-6 text-center text-black shadow-2xl print:max-w-none print:border-2 print:border-black print:shadow-none">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-red-700">Slagelse Brand og Redning</p>
          <h1 className="mt-2 text-3xl font-black">{target.title}</h1>
          <p className="mt-1 text-sm font-bold text-zinc-600">{target.subtitle}</p>
        </div>

        <img alt={`QR-kode til ${target.title}`} className="mx-auto aspect-square w-full max-w-[320px] bg-white" src={qrSrc} />

        <div className="rounded-xl border-2 border-black px-4 py-3">
          <p className="text-xs font-black uppercase tracking-[0.14em]">{operationalTargetTypeLabel(target.type)}</p>
          <p className="mt-1 text-sm font-bold">Scan for at åbne i SBR Fire App</p>
        </div>

        <OperationalPrintButton />
        <Link className="text-sm font-bold text-red-700 print:hidden" href={target.href}>Tilbage til {target.title}</Link>
      </section>
    </OperationalPageFrame>
  );
}

function isTargetType(value: string | undefined): value is OperationalTargetType {
  return value === "vehicle" || value === "place" || value === "item";
}
