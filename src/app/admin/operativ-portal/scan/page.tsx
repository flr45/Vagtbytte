import {
  OperationalPageFrame,
  OperationalPortalNav,
  OperationalScreenHeader
} from "@/components/OperationalPortalNav";
import {
  canManageOperationalPortal,
  requireOperationalPortalAccess
} from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function OperationalScannerPage() {
  const user = await requireOperationalPortalAccess();
  const isEditor = canManageOperationalPortal(user);

  return (
    <OperationalPageFrame>
      <OperationalScreenHeader backHref="/admin/operativ-portal" right="ϟ" title="Scan QR-kode" />
      <OperationalPortalNav isEditor={isEditor} />

      <section className="grid min-h-[65vh] content-center justify-items-center rounded-xl border border-white/10 bg-[#090e11] p-6 text-center">
        <div className="relative grid size-64 place-items-center">
          <span className="absolute left-0 top-0 size-12 border-l-2 border-t-2 border-red-600" />
          <span className="absolute right-0 top-0 size-12 border-r-2 border-t-2 border-red-600" />
          <span className="absolute bottom-0 left-0 size-12 border-b-2 border-l-2 border-red-600" />
          <span className="absolute bottom-0 right-0 size-12 border-b-2 border-r-2 border-red-600" />
          <div className="grid size-40 place-items-center bg-white p-3 text-[#090e11] shadow-2xl">
            <div className="grid grid-cols-7 gap-1 text-[11px] leading-none" aria-hidden="true">
              {Array.from({ length: 49 }, (_, index) => <span className={`size-4 ${[0,1,2,4,5,6,7,9,11,13,14,16,18,20,21,22,23,24,25,26,28,30,32,34,35,36,38,40,41,42,43,44,46,47,48].includes(index) ? "bg-black" : "bg-white"}`} key={index} />)}
            </div>
          </div>
        </div>
        <h1 className="mt-8 text-lg font-black">Scan QR-kode</h1>
        <p className="mt-3 max-w-xs text-sm font-medium leading-6 text-slate-400">Ret kameraet mod en QR-kode for at få hurtig adgang til køretøj, rum eller udstyr.</p>
        <p className="mt-5 rounded-lg bg-[#151b1f] px-4 py-3 text-xs text-slate-500">Kameraaktivering kobles på i næste QR-etape.</p>
      </section>
    </OperationalPageFrame>
  );
}
