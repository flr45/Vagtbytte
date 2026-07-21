import { UserRole } from "@prisma/client";
import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { TopBar } from "@/components/TopBar";
import { TransferCreateForm } from "@/components/TransferCreateForm";

export default async function NewTransferPage() {
  const user = await requireRole(UserRole.BRANDFIGHTER);

  return (
    <>
      <TopBar title="Vagtoverdragelse" />
      <main className="mx-auto grid w-full max-w-2xl gap-4 px-4 py-6">
        <Link className="app-button-secondary w-fit px-4 text-sm" href="/brandmand">
          Tilbage
        </Link>
        <TransferCreateForm defaultEmployeeNumber={user.employeeNumber ?? ""} />
      </main>
    </>
  );
}
