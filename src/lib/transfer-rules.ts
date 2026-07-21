import { UserRole, type ReturnRequestStatus, type TransferStatus } from "@prisma/client";

export type TransferParticipant = {
  id: string;
  name: string;
  role: UserRole;
  employeeNumber: string | null;
  isActive: boolean;
};

export type TransferCreateInput = {
  giverEmployeeNumber: string;
  receiverEmployeeNumber: string;
  requestedStartAt: Date;
  expectedEndAt?: Date | null;
};

export type TransferValidationResult =
  | {
      ok: true;
      giver: TransferParticipant;
      receiver: TransferParticipant;
    }
  | { ok: false; message: string };

export function statusLabel(status: TransferStatus) {
  const labels: Record<TransferStatus, string> = {
    AWAITING_RECEIVER: "Afventer modtager",
    RECEIVER_ACCEPTED_AWAITING_VC: "Accepteret - afventer vagtcentralen",
    RECEIVER_REJECTED: "Afvist af modtager",
    VC_REJECTED: "Afvist af vagtcentralen",
    VC_APPROVED_ACTIVE: "Aktiv vagtoverdragelse",
    RETURN_AWAITING_ORIGINAL: "Tilbagelevering afventer oprindelig brandmand",
    RETURN_ACCEPTED_AWAITING_VC: "Tilbagelevering accepteret - afventer vagtcentralen",
    COMPLETED: "Afsluttet",
    CANCELLED: "Annulleret"
  };

  return labels[status];
}

export function validateTransferParticipants(input: {
  currentUserId: string;
  giver: TransferParticipant | null;
  receiver: TransferParticipant | null;
  giverEmployeeNumber: string;
  receiverEmployeeNumber: string;
  requestedStartAt: Date;
  expectedEndAt?: Date | null;
}): TransferValidationResult {
  if (!input.giverEmployeeNumber.trim() || !input.receiverEmployeeNumber.trim()) {
    return { ok: false, message: "Begge medarbejdernumre skal udfyldes." };
  }

  if (!input.giver || input.giver.role !== UserRole.BRANDFIGHTER || !input.giver.isActive) {
    return { ok: false, message: "Afgiver skal være en aktiv brandmand." };
  }

  if (!input.receiver || input.receiver.role !== UserRole.BRANDFIGHTER || !input.receiver.isActive) {
    return { ok: false, message: "Overtager skal være en aktiv brandmand." };
  }

  if (input.giver.id !== input.currentUserId) {
    return { ok: false, message: "Du kan kun oprette en overdragelse med dig selv som afgiver." };
  }

  if (input.giver.id === input.receiver.id) {
    return { ok: false, message: "Afgiver og overtager må ikke være samme brandmand." };
  }

  if (Number.isNaN(input.requestedStartAt.getTime())) {
    return { ok: false, message: "Starttidspunkt skal udfyldes korrekt." };
  }

  if (input.expectedEndAt && input.expectedEndAt <= input.requestedStartAt) {
    return { ok: false, message: "Forventet sluttid skal ligge efter starttidspunktet." };
  }

  return { ok: true, giver: input.giver, receiver: input.receiver };
}

export function canViewTransfer(input: {
  userId: string;
  giverUserId: string;
  receiverUserId: string;
}) {
  return input.userId === input.giverUserId || input.userId === input.receiverUserId;
}

export function canRespondToTransfer(input: {
  userId: string;
  receiverUserId: string;
  status: TransferStatus;
}) {
  if (input.userId !== input.receiverUserId) {
    return { ok: false, message: "Kun modtageren kan besvare anmodningen." };
  }

  if (input.status !== "AWAITING_RECEIVER") {
    return { ok: false, message: "Anmodningen er allerede besvaret." };
  }

  return { ok: true, message: "Anmodningen kan besvares." };
}

export function canVcDecideTransfer(input: { role: UserRole; status: TransferStatus }) {
  if (input.role !== UserRole.VC) {
    return { ok: false, message: "Kun vagtcentralen kan behandle sagen." };
  }

  if (input.status !== "RECEIVER_ACCEPTED_AWAITING_VC") {
    return { ok: false, message: "Sagen kan først behandles, når modtager har accepteret." };
  }

  return { ok: true, message: "Sagen kan behandles af vagtcentralen." };
}

export function canCreateReturnRequest(input: {
  userId: string;
  receiverUserId: string;
  status: TransferStatus;
  hasOpenReturnRequest: boolean;
}) {
  if (input.status === "COMPLETED") {
    return { ok: false, message: "Afsluttede sager kan ikke ændres." };
  }

  if (input.userId !== input.receiverUserId) {
    return { ok: false, message: "Kun brandmanden, der har overtaget vagten, kan oprette tilbagelevering." };
  }

  if (input.status !== "VC_APPROVED_ACTIVE") {
    return { ok: false, message: "Tilbagelevering kan kun oprettes på en aktiv vagtoverdragelse." };
  }

  if (input.hasOpenReturnRequest) {
    return { ok: false, message: "Der findes allerede en åben tilbagelevering." };
  }

  return { ok: true, message: "Tilbagelevering kan oprettes." };
}

export function canOriginalRespondToReturn(input: {
  userId: string;
  originalUserId: string;
  transferStatus: TransferStatus;
  returnStatus: ReturnRequestStatus;
}) {
  if (input.transferStatus === "COMPLETED") {
    return { ok: false, message: "Afsluttede sager kan ikke ændres." };
  }

  if (input.userId !== input.originalUserId) {
    return { ok: false, message: "Kun den oprindelige brandmand kan besvare tilbageleveringen." };
  }

  if (input.transferStatus !== "RETURN_AWAITING_ORIGINAL" || input.returnStatus !== "AWAITING_ORIGINAL") {
    return { ok: false, message: "Tilbageleveringen er allerede besvaret." };
  }

  return { ok: true, message: "Tilbageleveringen kan besvares." };
}

export function canVcDecideReturn(input: {
  role: UserRole;
  transferStatus: TransferStatus;
  returnStatus: ReturnRequestStatus;
}) {
  if (input.role !== UserRole.VC) {
    return { ok: false, message: "Kun vagtcentralen kan behandle tilbageleveringen." };
  }

  if (
    input.transferStatus !== "RETURN_ACCEPTED_AWAITING_VC" ||
    input.returnStatus !== "ORIGINAL_ACCEPTED_AWAITING_VC"
  ) {
    return { ok: false, message: "Tilbageleveringen kan først behandles, når den oprindelige brandmand har accepteret." };
  }

  return { ok: true, message: "Tilbageleveringen kan behandles af vagtcentralen." };
}

export function isExpectedEndOverdue(expectedEndAt: Date | null, now = new Date()) {
  return Boolean(expectedEndAt && expectedEndAt < now);
}
