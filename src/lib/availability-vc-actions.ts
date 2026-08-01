"use server";

import { revalidatePath } from "next/cache";
import { AvailabilityStatus, UserRole } from "@prisma/client";
import { z } from "zod";
import { requireRole } from "./auth";
import { calculateAssignedShiftWindow } from "./availability";
import { createNotification } from "./notifications";
import { prisma } from "./prisma";

export type AvailabilityVcActionState = {
  ok?: boolean;
  message?: string;
};

const availabilityIdSchema = z.object({ availabilityId: z.string().min(1) });

export async function assignAvailabilityDirectlyByVcAction(
  _state: AvailabilityVcActionState,
  formData: FormData
): Promise<AvailabilityVcActionState> {
  const vc = await requireRole(UserRole.VC);
  const parsed = availabilityIdSchema.safeParse({
    availabilityId: formData.get("availabilityId")
  });

  if (!parsed.success) {
    return { ok: false, message: "Tilgængeligheden kunne ikke identificeres." };
  }

  const now = new Date();
  const assignedShift = calculateAssignedShiftWindow(now);
  const assigned = await prisma.$transaction(async (tx) => {
    const claimed = await tx.availability.updateMany({
      where: { id: parsed.data.availabilityId, status: AvailabilityStatus.AVAILABLE },
      data: {
        status: AvailabilityStatus.ACKNOWLEDGED,
        assignedBy: vc.id,
        assignedAt: now,
        assignedShiftStart: assignedShift.start,
        assignedShiftEnd: assignedShift.end,
        acknowledgedAt: now,
        cancelledAt: null,
        expiredAt: null
      }
    });

    if (claimed.count !== 1) {
      return null;
    }

    const current = await tx.availability.findUnique({
      where: { id: parsed.data.availabilityId },
      include: { user: true }
    });
    if (!current) {
      return null;
    }

    await tx.auditLog.create({
      data: {
        actorUserId: vc.id,
        actorRole: vc.role,
        action: "AVAILABILITY_ASSIGNED",
        targetUserId: current.userId,
        availabilityId: current.id,
        description: `Vagtcentralen tildelte en vagt til ${current.user.name}`
      }
    });

    return current;
  });

  if (!assigned) {
    revalidatePath("/vagtcentral");
    return { ok: false, message: "Tilgængeligheden er allerede behandlet." };
  }

  await createNotification(prisma, {
    recipientUserId: assigned.userId,
    availabilityId: assigned.id,
    type: "AVAILABILITY_ASSIGNED",
    title: "Du er tildelt en vagt",
    body: "Vagtcentralen har tildelt dig en vagt. Du skal ikke bekræfte tildelingen.",
    link: `/brandmand/til-raadighed/${assigned.id}`,
    uniqueKey: `availability:${assigned.id}:assigned`
  });

  revalidatePath("/vagtcentral");
  revalidatePath("/brandmand");
  revalidatePath(`/brandmand/til-raadighed/${assigned.id}`);
  return { ok: true, message: "Vagten er tildelt." };
}

export async function removeAvailabilityAssignmentByVcAction(
  _state: AvailabilityVcActionState,
  formData: FormData
): Promise<AvailabilityVcActionState> {
  const vc = await requireRole(UserRole.VC);
  const parsed = availabilityIdSchema.safeParse({
    availabilityId: formData.get("availabilityId")
  });

  if (!parsed.success) {
    return { ok: false, message: "Tildelingen kunne ikke identificeres." };
  }

  const now = new Date();
  const availability = await prisma.availability.findUnique({
    where: { id: parsed.data.availabilityId },
    include: { user: true }
  });

  if (
    !availability ||
    (availability.status !== AvailabilityStatus.ASSIGNED &&
      availability.status !== AvailabilityStatus.ACKNOWLEDGED)
  ) {
    return { ok: false, message: "Tildelingen findes ikke længere." };
  }

  const nextStatus =
    availability.availableUntil > now ? AvailabilityStatus.AVAILABLE : AvailabilityStatus.EXPIRED;

  const removed = await prisma.$transaction(async (tx) => {
    const claimed = await tx.availability.updateMany({
      where: {
        id: availability.id,
        status: { in: [AvailabilityStatus.ASSIGNED, AvailabilityStatus.ACKNOWLEDGED] }
      },
      data: {
        status: nextStatus,
        assignedBy: null,
        assignedAt: null,
        assignedShiftStart: null,
        assignedShiftEnd: null,
        acknowledgedAt: null,
        expiredAt: nextStatus === AvailabilityStatus.EXPIRED ? now : null
      }
    });

    if (claimed.count !== 1) {
      return false;
    }

    await tx.auditLog.create({
      data: {
        actorUserId: vc.id,
        actorRole: vc.role,
        action: "AVAILABILITY_ASSIGNMENT_REMOVED",
        targetUserId: availability.userId,
        availabilityId: availability.id,
        description: `Vagtcentralen fjernede vagttildelingen fra ${availability.user.name}`
      }
    });

    return true;
  });

  if (!removed) {
    return { ok: false, message: "Tildelingen er allerede blevet ændret." };
  }

  await createNotification(prisma, {
    recipientUserId: availability.userId,
    availabilityId: availability.id,
    type: "AVAILABILITY_ASSIGNED",
    title: "Din vagttildeling er fjernet",
    body:
      nextStatus === AvailabilityStatus.AVAILABLE
        ? "Vagtcentralen har fjernet tildelingen. Du står igen som til rådighed."
        : "Vagtcentralen har fjernet tildelingen.",
    link: "/brandmand",
    uniqueKey: `availability:${availability.id}:assignment-removed:${now.getTime()}`
  });

  revalidatePath("/vagtcentral");
  revalidatePath("/brandmand");
  revalidatePath(`/brandmand/til-raadighed/${availability.id}`);
  return { ok: true, message: "Tildelingen er fjernet." };
}
