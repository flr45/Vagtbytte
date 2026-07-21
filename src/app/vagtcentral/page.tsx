import { UserRole } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TopBar } from "@/components/TopBar";
import { VcDashboard, type VcDashboardTransfer } from "@/components/VcDashboard";

export default async function VagtcentralPage() {
  await requireRole(UserRole.VC);
  const [awaitingApproval, activeTransfers, returnApprovals, recentlyHandled] = await Promise.all([
    prisma.shiftTransfer.findMany({
      where: { status: "RECEIVER_ACCEPTED_AWAITING_VC" },
      orderBy: { receiverRespondedAt: "asc" },
      include: { returnRequests: { orderBy: { createdAt: "desc" } } }
    }),
    prisma.shiftTransfer.findMany({
      where: {
        status: {
          in: [
            "VC_APPROVED_AWAITING_ACTIVATION",
            "VC_APPROVED_ACTIVE",
            "RETURN_AWAITING_ORIGINAL",
            "RETURN_APPROVED_AWAITING_EXECUTION"
          ]
        }
      },
      orderBy: { activatedAt: "desc" },
      include: { returnRequests: { orderBy: { createdAt: "desc" } } }
    }),
    prisma.shiftTransfer.findMany({
      where: { status: "RETURN_ACCEPTED_AWAITING_VC" },
      orderBy: { updatedAt: "asc" },
      include: { returnRequests: { orderBy: { createdAt: "desc" } } }
    }),
    prisma.shiftTransfer.findMany({
      where: { status: { in: ["VC_REJECTED", "RECEIVER_REJECTED", "COMPLETED"] } },
      orderBy: { updatedAt: "desc" },
      take: 10,
      include: { returnRequests: { orderBy: { createdAt: "desc" } } }
    })
  ]);

  return (
    <>
      <TopBar title="Vagtcentral" />
      <VcDashboard
        activeTransfers={activeTransfers.map(serializeTransfer)}
        awaitingTransfers={awaitingApproval.map(serializeTransfer)}
        recentlyHandled={recentlyHandled.map(serializeTransfer)}
        returnTransfers={returnApprovals.map(serializeTransfer)}
        serverNow={new Date().toISOString()}
      />
    </>
  );
}

function serializeTransfer(
  transfer: Awaited<ReturnType<typeof prisma.shiftTransfer.findMany>>[number] & {
    returnRequests: Array<{
      id: string;
      returnNumber: string;
      requestedReturnAt: Date;
      comment: string | null;
      originalRespondedAt: Date | null;
      originalResponseComment: string | null;
      vcDecidedAt: Date | null;
      status: string;
      createdAt: Date;
      updatedAt: Date;
    }>;
  }
): VcDashboardTransfer {
  return {
    id: transfer.id,
    transferNumber: transfer.transferNumber,
    status: transfer.status,
    giverNameSnapshot: transfer.giverNameSnapshot,
    giverEmployeeNumberSnapshot: transfer.giverEmployeeNumberSnapshot,
    receiverNameSnapshot: transfer.receiverNameSnapshot,
    receiverEmployeeNumberSnapshot: transfer.receiverEmployeeNumberSnapshot,
    requestedStartAt: transfer.requestedStartAt.toISOString(),
    expectedEndMode: transfer.expectedEndMode,
    expectedEndAt: transfer.expectedEndAt?.toISOString() ?? null,
    calculatedShiftEndAt: transfer.calculatedShiftEndAt?.toISOString() ?? null,
    comment: transfer.comment,
    receiverRespondedAt: transfer.receiverRespondedAt?.toISOString() ?? null,
    receiverResponseComment: transfer.receiverResponseComment,
    vcDecidedAt: transfer.vcDecidedAt?.toISOString() ?? null,
    activatedAt: transfer.activatedAt?.toISOString() ?? null,
    updatedAt: transfer.updatedAt.toISOString(),
    returnRequests: transfer.returnRequests.map((request) => ({
      id: request.id,
      returnNumber: request.returnNumber,
      requestedReturnAt: request.requestedReturnAt.toISOString(),
      comment: request.comment,
      originalRespondedAt: request.originalRespondedAt?.toISOString() ?? null,
      originalResponseComment: request.originalResponseComment,
      vcDecidedAt: request.vcDecidedAt?.toISOString() ?? null,
      status: request.status,
      createdAt: request.createdAt.toISOString(),
      updatedAt: request.updatedAt.toISOString()
    }))
  };
}
