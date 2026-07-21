import { UserRole, type AuditLog } from "@prisma/client";
import { canViewTransfer } from "./transfer-rules";

export type CaseHistoryTransferAccess = {
  userId: string;
  role: UserRole;
  giverUserId: string;
  receiverUserId: string;
};

export type CaseHistoryEntry = Pick<AuditLog, "action" | "actorRole" | "createdAt"> & {
  actor?: { name: string; role: UserRole } | null;
};

const actionLabels: Record<string, string> = {
  TRANSFER_CREATED: "Oprettet",
  TRANSFER_ACCEPTED_BY_RECEIVER: "Accepteret",
  TRANSFER_REJECTED_BY_RECEIVER: "Afvist",
  TRANSFER_VC_APPROVED: "VC godkendte",
  TRANSFER_VC_REJECTED: "VC afviste",
  TRANSFER_ACTIVATION_CONFIRMED: "Vagt skiftet",
  TRANSFER_CANCELLED: "Annulleret",
  RETURN_CREATED: "Tilbage oprettet",
  RETURN_ACCEPTED_BY_ORIGINAL: "Tilbage accepteret",
  RETURN_REJECTED_BY_ORIGINAL: "Tilbage afvist",
  RETURN_VC_APPROVED_AWAITING_EXECUTION: "VC godkendte",
  RETURN_VC_REJECTED: "VC afviste",
  RETURN_EXECUTION_CONFIRMED: "Vagten tilbage",
  EXPECTED_RETURN_EXECUTION_CONFIRMED: "Vagten tilbage",
  SHIFT_END_TRANSFER_COMPLETED: "Afsluttet"
};

export function canReadCaseHistory(input: CaseHistoryTransferAccess) {
  if (input.role === UserRole.VC || input.role === UserRole.ADMIN) {
    return true;
  }

  return canViewTransfer({
    userId: input.userId,
    giverUserId: input.giverUserId,
    receiverUserId: input.receiverUserId
  });
}

export function caseHistoryWhere(shiftTransferId: string) {
  return { shiftTransferId };
}

export function formatCaseHistoryAction(action: string) {
  return actionLabels[action] ?? null;
}

export function actorLabel(entry: Pick<CaseHistoryEntry, "actor" | "actorRole">) {
  if (entry.actor?.name) {
    return entry.actor.name;
  }
  if (entry.actorRole === UserRole.VC) {
    return "Vagtcentralen";
  }
  if (entry.actorRole === UserRole.ADMIN) {
    return "Administrator";
  }
  if (entry.actorRole === UserRole.BRANDFIGHTER) {
    return "Brandmand";
  }
  return null;
}

export function visibleCaseHistoryEntries(entries: CaseHistoryEntry[]) {
  return entries
    .map((entry) => ({
      at: entry.createdAt,
      action: formatCaseHistoryAction(entry.action),
      actor: actorLabel(entry)
    }))
    .filter((entry): entry is { at: Date; action: string; actor: string | null } => Boolean(entry.action))
    .sort((a, b) => a.at.getTime() - b.at.getTime());
}
