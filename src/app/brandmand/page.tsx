import { UserRole } from "@prisma/client";
import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TopBar } from "@/components/TopBar";
import { TransferList } from "@/components/TransferSummary";

export default async function FirefighterPage() {
  const user = await requireRole(UserRole.BRANDFIGHTER);
  const [requestsToMe, myCreatedRequests] = await Promise.all([
    prisma.shiftTransfer.findMany({
      where: { receiverUserId: user.id },
      orderBy: { createdAt: "desc" }
    }),
    prisma.shiftTransfer.findMany({
      where: { giverUserId: user.id },
      orderBy: { createdAt: "desc" }
    })
  ]);

  return (
    <>
      <TopBar title="Vagtoverdragelse" />
      <main className="mx-auto grid w-full max-w-3xl gap-6 px-4 py-6">
        <section className="rounded-lg border border-brand-line bg-white p-5 shadow-sm">
          <h1 className="text-3xl font-bold">Vagtoverdragelse</h1>
          <dl className="mt-5 grid gap-3 rounded-md bg-brand-mist p-4">
            <div>
              <dt className="text-sm font-semibold text-zinc-600">Navn</dt>
              <dd className="mt-1 text-lg font-bold">{user.name}</dd>
            </div>
            <div>
              <dt className="text-sm font-semibold text-zinc-600">Medarbejdernummer</dt>
              <dd className="mt-1 text-lg font-bold">{user.employeeNumber}</dd>
            </div>
          </dl>
          <Link
            className="focus-ring mt-5 inline-flex min-h-14 w-full items-center justify-center rounded-md bg-brand-red px-5 text-lg font-bold text-white sm:w-auto"
            href="/brandmand/ny"
          >
            Opret vagtoverdragelse
          </Link>
        </section>
        <TransferList
          emptyText="Der er ingen anmodninger rettet til dig."
          title="Anmodninger til mig"
          transfers={requestsToMe.map((transfer) => ({
            id: transfer.id,
            transferNumber: transfer.transferNumber,
            status: transfer.status,
            requestedStartAt: transfer.requestedStartAt,
            expectedEndAt: transfer.expectedEndAt,
            comment: transfer.comment,
            receiverResponseComment: transfer.receiverResponseComment,
            vcDecision: transfer.vcDecision,
            vcComment: transfer.vcComment,
            counterpartName: transfer.giverNameSnapshot,
            counterpartEmployeeNumber: transfer.giverEmployeeNumberSnapshot
          }))}
        />
        <TransferList
          emptyText="Du har ikke oprettet nogen anmodninger."
          title="Mine oprettede anmodninger"
          transfers={myCreatedRequests.map((transfer) => ({
            id: transfer.id,
            transferNumber: transfer.transferNumber,
            status: transfer.status,
            requestedStartAt: transfer.requestedStartAt,
            expectedEndAt: transfer.expectedEndAt,
            comment: transfer.comment,
            receiverResponseComment: transfer.receiverResponseComment,
            vcDecision: transfer.vcDecision,
            vcComment: transfer.vcComment,
            counterpartName: transfer.receiverNameSnapshot,
            counterpartEmployeeNumber: transfer.receiverEmployeeNumberSnapshot
          }))}
        />
      </main>
    </>
  );
}
