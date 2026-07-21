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
        <Link className="focus-ring w-fit rounded-md px-2 py-2 text-sm font-semibold text-zinc-700" href="/brandmand">
          Tilbage
        </Link>
        <TransferCreateForm defaultEmployeeNumber={user.employeeNumber ?? ""} />
      </main>
    </>
  );
}
