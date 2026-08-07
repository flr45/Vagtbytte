import {
  OperationalPageFrame,
  OperationalPortalNav,
  OperationalScreenHeader
} from "@/components/OperationalPortalNav";
import { OperationalQrScanner } from "@/components/OperationalQrScanner";
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
      <OperationalQrScanner />
    </OperationalPageFrame>
  );
}
