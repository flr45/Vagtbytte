import type { AvailabilityStatus, UserRole } from "@prisma/client";
import { calculateCopenhagenShiftEnd, calculateCopenhagenShiftWindow } from "./copenhagen-datetime";

export const ACTIVE_AVAILABILITY_STATUSES: AvailabilityStatus[] = ["AVAILABLE"];
export const PREVIOUS_AVAILABILITY_STATUSES: AvailabilityStatus[] = ["ASSIGNED", "ACKNOWLEDGED", "CANCELLED", "EXPIRED"];

export function calculateAvailabilityUntil(availableFrom: Date) {
  return calculateCopenhagenShiftEnd(availableFrom);
}

export function calculateAssignedShiftWindow(assignedAt: Date) {
  return calculateCopenhagenShiftWindow(assignedAt);
}

export function isCurrentAvailabilityAssignment(
  availability: {
    status: AvailabilityStatus;
    availableFrom: Date;
    availableUntil: Date;
    assignedShiftStart?: Date | null;
    assignedShiftEnd?: Date | null;
  },
  now = new Date()
) {
  const startsAt = availability.assignedShiftStart ?? availability.availableFrom;
  const endsAt = availability.assignedShiftEnd ?? availability.availableUntil;
  return (
    ["ASSIGNED", "ACKNOWLEDGED"].includes(availability.status) &&
    startsAt.getTime() <= now.getTime() &&
    endsAt.getTime() > now.getTime()
  );
}

export function canCreateAvailability(input: {
  role: UserRole;
  existingActiveAvailability?: { id: string } | null;
}) {
  if (input.role !== "BRANDFIGHTER") {
    return { ok: false, message: "Kun brandmænd kan stille sig til rådighed." };
  }
  if (input.existingActiveAvailability) {
    return { ok: false, message: "Du er allerede til rådighed." };
  }
  return { ok: true, message: "Du kan stille dig til rådighed." };
}

export function canCancelAvailability(input: {
  role: UserRole;
  currentUserId: string;
  availability: { userId: string; status: AvailabilityStatus } | null;
}) {
  if (input.role !== "BRANDFIGHTER") {
    return { ok: false, message: "Kun brandmanden kan annullere sin tilgængelighed." };
  }
  if (!input.availability) {
    return { ok: false, message: "Tilgængeligheden findes ikke." };
  }
  if (input.availability.userId !== input.currentUserId) {
    return { ok: false, message: "Du kan kun annullere din egen tilgængelighed." };
  }
  if (input.availability.status !== "AVAILABLE") {
    return { ok: false, message: "Tilgængeligheden kan ikke længere annulleres." };
  }
  return { ok: true, message: "Tilgængeligheden kan annulleres." };
}

export function canAssignAvailability(input: {
  role: UserRole;
  availability: { status: AvailabilityStatus } | null;
}) {
  if (input.role !== "VC") {
    return { ok: false, message: "Kun vagtcentralen kan tildele en vagt." };
  }
  if (!input.availability) {
    return { ok: false, message: "Tilgængeligheden findes ikke." };
  }
  if (input.availability.status !== "AVAILABLE") {
    return { ok: false, message: "Tilgængeligheden er allerede behandlet." };
  }
  return { ok: true, message: "Vagten kan tildeles." };
}

export function canAcknowledgeAvailability(input: {
  role: UserRole;
  currentUserId: string;
  availability: { userId: string; status: AvailabilityStatus } | null;
}) {
  if (input.role !== "BRANDFIGHTER") {
    return { ok: false, message: "Kun brandmanden kan bekræfte tildelingen." };
  }
  if (!input.availability) {
    return { ok: false, message: "Tildelingen findes ikke." };
  }
  if (input.availability.userId !== input.currentUserId) {
    return { ok: false, message: "Du kan kun bekræfte din egen tildeling." };
  }
  if (input.availability.status !== "ASSIGNED") {
    return { ok: false, message: "Tildelingen er allerede behandlet." };
  }
  return { ok: true, message: "Tildelingen kan bekræftes." };
}

export function availabilityStatusLabel(status: AvailabilityStatus) {
  const labels: Record<AvailabilityStatus, string> = {
    AVAILABLE: "Til rådighed",
    ASSIGNED: "Tildelt",
    ACKNOWLEDGED: "Tildeling bekræftet",
    CANCELLED: "Annulleret",
    EXPIRED: "Udløbet"
  };
  return labels[status];
}
