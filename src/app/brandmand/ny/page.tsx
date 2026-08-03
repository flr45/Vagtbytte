import { UserRole } from "@prisma/client";
import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TopBar } from "@/components/TopBar";
import { TransferCreateForm } from "@/components/TransferCreateForm";

export default async function NewTransferPage() {
  const user = await requireRole(UserRole.BRANDFIGHTER);
  const firefighters = await prisma.user.findMany({
    where: {
      role: UserRole.BRANDFIGHTER,
      isActive: true,
      employeeNumber: { not: null },
      loginIdentifier: { not: "__deleted_user__" }
    },
    orderBy: [{ name: "asc" }, { employeeNumber: "asc" }],
    select: {
      id: true,
      name: true,
      employeeNumber: true
    }
  });

  return (
    <>
      <TopBar title="Nyt vagtbytte" />
      <main className="mx-auto grid w-full max-w-2xl gap-4 px-4 py-5">
        <Link className="app-button-secondary w-fit px-4 text-sm" href="/brandmand">
          ← Tilbage
        </Link>
        <TransferCreateForm
          defaultEmployeeNumber={user.employeeNumber ?? ""}
          defaultStartAt={toDateTimeLocalValue(new Date())}
          firefighters={firefighters.flatMap((firefighter) =>
            firefighter.employeeNumber
              ? [{
                  id: firefighter.id,
                  name: firefighter.name,
                  employeeNumber: firefighter.employeeNumber
                }]
              : []
          )}
        />
      </main>
    </>
  );
}

function toDateTimeLocalValue(date: Date) {
  const rounded = new Date(Math.ceil(date.getTime() / (5 * 60 * 1000)) * 5 * 60 * 1000);
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Copenhagen",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    }).formatToParts(rounded).map((part) => [part.type, part.value])
  );

  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}
