import { UserRole } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TopBar } from "@/components/TopBar";
import { VcTransferList } from "@/components/VcTransferList";

export default async function VagtcentralPage() {
  await requireRole(UserRole.VC);
  const [awaitingApproval, activeTransfers, returnApprovals, recentlyHandled] = await Promise.all([
    prisma.shiftTransfer.findMany({
      where: { status: "RECEIVER_ACCEPTED_AWAITING_VC" },
      orderBy: { receiverRespondedAt: "asc" }
    }),
    prisma.shiftTransfer.findMany({
      where: { status: { in: ["VC_APPROVED_ACTIVE", "RETURN_AWAITING_ORIGINAL"] } },
      orderBy: { activatedAt: "desc" }
    }),
    prisma.shiftTransfer.findMany({
      where: { status: "RETURN_ACCEPTED_AWAITING_VC" },
      orderBy: { updatedAt: "asc" }
    }),
    prisma.shiftTransfer.findMany({
      where: { status: { in: ["VC_REJECTED", "RECEIVER_REJECTED", "COMPLETED"] } },
      orderBy: { updatedAt: "desc" },
      take: 10
    })
  ]);

  return (
    <>
      <TopBar title="Vagtcentral" />
      <main className="mx-auto grid w-full max-w-4xl gap-6 px-4 py-6">
        <section className="rounded-lg border border-brand-line bg-white p-5 shadow-sm">
          <h1 className="text-3xl font-bold">Vagtcentral</h1>
          <p className="mt-3 text-base text-zinc-700">
            {awaitingApproval.length} sag(er) afventer VC-godkendelse.
          </p>
          <p className="mt-3 rounded-md bg-amber-50 p-3 text-sm font-semibold text-amber-950">
            Forventet sluttid medfører ikke automatisk tilbagelevering.
          </p>
        </section>
        <VcTransferList
          emptyText="Ingen sager afventer godkendelse."
          title="Afventer godkendelse"
          transfers={awaitingApproval}
        />
        <VcTransferList
          emptyText="Ingen aktive vagtoverdragelser."
          title="Aktive vagtoverdragelser"
          transfers={activeTransfers}
        />
        <VcTransferList
          emptyText="Ingen tilbageleveringer afventer godkendelse."
          title="Tilbageleveringer til godkendelse"
          transfers={returnApprovals}
        />
        <VcTransferList
          emptyText="Ingen behandlede sager endnu."
          title="Senest behandlede"
          transfers={recentlyHandled}
        />
      </main>
    </>
  );
}
