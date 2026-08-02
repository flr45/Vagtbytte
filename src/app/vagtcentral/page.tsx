import { AvailabilityStatus, UserRole } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { calculateAssignedShiftWindow } from "@/lib/availability";
import { prisma } from "@/lib/prisma";
import { TopBar } from "@/components/TopBar";
import { VcAvailabilityManagement } from "@/components/VcAvailabilityManagement";
import { VcDashboard, type VcDashboardTransfer } from "@/components/VcDashboard";

export default async function VagtcentralPage() {
  await requireRole(UserRole.VC);
  const now = new Date();
  const currentShift = calculateAssignedShiftWindow(now);
  const [
    currentAssignments,
    availableFirefighters,
    previousAvailabilities,
    awaitingApproval,
    activeTransfers,
    returnApprovals,
    recentlyHandled
  ] = await Promise.all([
    prisma.availability.findMany({
      where: {
        status: { in: [AvailabilityStatus.ASSIGNED, AvailabilityStatus.ACKNOWLEDGED] },
        assignedShiftStart: currentShift.start,
        assignedShiftEnd: currentShift.end
      },
      orderBy: [{ assignedAt: "asc" }, { user: { name: "asc" } }],
      include: { user: true }
    }),
    prisma.availability.findMany({
      where: { status: AvailabilityStatus.AVAILABLE },
      orderBy: [{ availableFrom: "asc" }, { user: { name: "asc" } }],
      include: { user: true }
    }),
    prisma.availability.findMany({
      where: {
        status: {
          in: [
            AvailabilityStatus.ASSIGNED,
            AvailabilityStatus.ACKNOWLEDGED,
            AvailabilityStatus.CANCELLED,
            AvailabilityStatus.EXPIRED
          ]
        }
      },
      orderBy: { updatedAt: "desc" },
      take: 20,
      include: { user: true, assignedByUser: true }
    }),
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
        availableFirefighters={[]}
        currentAssignments={[]}
        previousAvailabilities={[]}
        recentlyHandled={recentlyHandled.map(serializeTransfer)}
        returnTransfers={returnApprovals.map(serializeTransfer)}
        serverNow={now.toISOString()}
      >
        <VcAvailabilityManagement
          availableFirefighters={availableFirefighters.map(serializeManagedAvailability)}
          currentAssignments={currentAssignments.map(serializeManagedAvailability)}
          previousAvailabilities={previousAvailabilities.map(serializeManagedAvailability)}
        />
      </VcDashboard>
    </>
  );
}

function serializeManagedAvailability(
  availability: Awaited<ReturnType<typeof prisma.availability.findMany>>[number] & {
    user: { name: string; employeeNumber: string | null };
    assignedByUser?: { name: string } | null;
  }
) {
  return {
    id: availability.id,
    userName: availability.user.name,
    userEmployeeNumber: availability.user.employeeNumber,
    availableFrom: availability.availableFrom.toISOString(),
    availableUntil: availability.availableUntil.toISOString(),
    status: availability.status,
    assignedAt: availability.assignedAt?.toISOString() ?? null,
    acknowledgedAt: availability.acknowledgedAt?.toISOString() ?? null
  };
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
