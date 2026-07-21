"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { UserRole, type TransferStatus } from "@prisma/client";
import { prisma } from "./prisma";
import { hashPassword, verifyPassword } from "./passwords";
import { normalizeLoginIdentifier } from "./login-identifiers";
import {
  changePasswordSchema,
  firefighterCreateSchema,
  firefighterUpdateSchema,
  loginSchema,
  passwordResetSchema,
  notificationIdSchema,
  pushSubscriptionIdSchema,
  pushSubscriptionSchema,
  returnRequestCreateSchema,
  returnRequestResponseSchema,
  transferCancelSchema,
  transferCreateSchema,
  transferLookupSchema,
  transferResponseSchema,
  vcReturnDecisionSchema,
  vcReturnExecutionSchema,
  vcReturnRejectSchema,
  vcTransferActivationSchema,
  vcTransferDecisionSchema,
  vcTransferRejectSchema,
  vcUpdateSchema
} from "./validation";
import { requirePasswordChangeUser, requireRole, requireUser, roleHome, signIn, signOut } from "./auth";
import {
  canRespondToTransfer,
  canCreateReturnRequest,
  canOriginalRespondToReturn,
  canCancelTransfer,
  canVcDecideReturn,
  canVcDecideTransfer,
  canVcConfirmReturnExecution,
  canVcConfirmTransferActivation,
  validateTransferParticipants,
  type TransferParticipant
} from "./transfer-rules";
import { cancelFutureTransferNotifications, createNotification, sendPushForNotification } from "./notifications";
import {
  notifyOriginalReturnResponse,
  notifyReceiverAccepted,
  notifyReceiverRejected,
  notifyReturnCreated,
  notifyTransferCreated,
  notifyVcReturnDecision,
  notifyVcTransferDecision,
  notifyTransferActivated,
  notifyTransferCancelled,
  notifyReturnExecutionCompleted
} from "./notification-events";

export type ActionState = {
  ok?: boolean;
  message?: string;
};

function boolFromForm(formData: FormData, field: string) {
  return formData.get(field) === "on";
}

function firstError(error: unknown) {
  if (typeof error === "object" && error && "issues" in error) {
    const issues = (error as { issues?: Array<{ message: string }> }).issues;
    return issues?.[0]?.message ?? "Formularen er ikke udfyldt korrekt.";
  }
  return "Der opstod en fejl.";
}

function optionalText(value: string | undefined) {
  return value && value.length > 0 ? value : null;
}

async function findFirefighterByEmployeeNumber(employeeNumber: string) {
  return prisma.user.findFirst({
    where: { employeeNumber },
    select: {
      id: true,
      name: true,
      role: true,
      employeeNumber: true,
      isActive: true
    }
  });
}

async function nextTransferNumber() {
  const count = await prisma.shiftTransfer.count();
  return `VO-${String(count + 1).padStart(5, "0")}`;
}

async function nextReturnNumber() {
  const count = await prisma.returnRequest.count();
  return `TL-${String(count + 1).padStart(5, "0")}`;
}

export async function loginAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = loginSchema.safeParse({
    identifier: formData.get("identifier"),
    password: formData.get("password")
  });

  if (!parsed.success) {
    return { ok: false, message: firstError(parsed.error) };
  }

  const result = await signIn(parsed.data.identifier, parsed.data.password);

  if (!result.ok) {
    return { ok: false, message: result.message };
  }

  if (result.user.mustChangePassword) {
    redirect("/skift-adgangskode");
  }

  redirect(roleHome[result.user.role]);
}

export async function logoutAction() {
  await signOut();
  redirect("/login");
}

export async function createFirefighterAction(
  _state: ActionState,
  formData: FormData
): Promise<ActionState> {
  const admin = await requireRole(UserRole.ADMIN);
  const parsed = firefighterCreateSchema.safeParse({
    name: formData.get("name"),
    employeeNumber: formData.get("employeeNumber"),
    temporaryPassword: formData.get("temporaryPassword"),
    isActive: boolFromForm(formData, "isActive")
  });

  if (!parsed.success) {
    return { ok: false, message: firstError(parsed.error) };
  }

  const loginIdentifier = normalizeLoginIdentifier(parsed.data.employeeNumber);
  const existing = await prisma.user.findFirst({
    where: {
      OR: [{ employeeNumber: loginIdentifier }, { loginIdentifier }]
    }
  });

  if (existing) {
    return { ok: false, message: "Medarbejdernummeret eller login er allerede i brug." };
  }

  const user = await prisma.user.create({
    data: {
      name: parsed.data.name,
      role: UserRole.BRANDFIGHTER,
      employeeNumber: loginIdentifier,
      loginIdentifier,
      passwordHash: await hashPassword(parsed.data.temporaryPassword),
      isActive: parsed.data.isActive,
      mustChangePassword: true
    }
  });

  await prisma.auditLog.create({
    data: {
      actorUserId: admin.id,
      actorRole: admin.role,
      action: "USER_CREATED",
      targetUserId: user.id,
      description: `Brandmand ${user.name} blev oprettet`
    }
  });

  revalidatePath("/admin");
  return { ok: true, message: "Brandmanden er oprettet." };
}

export async function updateFirefighterAction(
  _state: ActionState,
  formData: FormData
): Promise<ActionState> {
  const admin = await requireRole(UserRole.ADMIN);
  const parsed = firefighterUpdateSchema.safeParse({
    userId: formData.get("userId"),
    name: formData.get("name"),
    employeeNumber: formData.get("employeeNumber"),
    isActive: boolFromForm(formData, "isActive")
  });

  if (!parsed.success) {
    return { ok: false, message: firstError(parsed.error) };
  }

  const user = await prisma.user.findUnique({ where: { id: parsed.data.userId } });
  if (!user || user.role !== UserRole.BRANDFIGHTER) {
    return { ok: false, message: "Brandmanden blev ikke fundet." };
  }

  const loginIdentifier = normalizeLoginIdentifier(parsed.data.employeeNumber);
  const duplicate = await prisma.user.findFirst({
    where: {
      id: { not: parsed.data.userId },
      OR: [{ employeeNumber: loginIdentifier }, { loginIdentifier }]
    }
  });

  if (duplicate) {
    return { ok: false, message: "Medarbejdernummeret eller login er allerede i brug." };
  }

  await prisma.user.update({
    where: { id: parsed.data.userId },
    data: {
      name: parsed.data.name,
      employeeNumber: loginIdentifier,
      loginIdentifier,
      isActive: parsed.data.isActive
    }
  });
  if (!parsed.data.isActive) {
    await prisma.session.deleteMany({ where: { userId: parsed.data.userId } });
  }

  await prisma.auditLog.create({
    data: {
      actorUserId: admin.id,
      actorRole: admin.role,
      action: "USER_UPDATED",
      targetUserId: parsed.data.userId,
      description: `Brandmand ${parsed.data.name} blev opdateret`
    }
  });

  revalidatePath("/admin");
  return { ok: true, message: "Brandmanden er gemt." };
}

export async function resetPasswordAction(
  _state: ActionState,
  formData: FormData
): Promise<ActionState> {
  const admin = await requireRole(UserRole.ADMIN);
  const parsed = passwordResetSchema.safeParse({
    userId: formData.get("userId"),
    temporaryPassword: formData.get("temporaryPassword")
  });

  if (!parsed.success) {
    return { ok: false, message: firstError(parsed.error) };
  }

  const user = await prisma.user.findUnique({ where: { id: parsed.data.userId } });
  if (!user || user.role !== UserRole.BRANDFIGHTER) {
    return { ok: false, message: "Brandmanden blev ikke fundet." };
  }

  await prisma.user.update({
    where: { id: parsed.data.userId },
    data: {
      passwordHash: await hashPassword(parsed.data.temporaryPassword),
      mustChangePassword: true
    }
  });
  await prisma.session.deleteMany({ where: { userId: parsed.data.userId } });
  await prisma.auditLog.create({
    data: {
      actorUserId: admin.id,
      actorRole: admin.role,
      action: "PASSWORD_RESET",
      targetUserId: parsed.data.userId,
      description: `Adgangskode blev nulstillet for ${user.name}`
    }
  });

  revalidatePath("/admin");
  return { ok: true, message: "Adgangskoden er nulstillet." };
}

export async function updateVcAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireRole(UserRole.ADMIN);
  const parsed = vcUpdateSchema.safeParse({
    loginIdentifier: formData.get("loginIdentifier"),
    temporaryPassword: formData.get("temporaryPassword"),
    isActive: boolFromForm(formData, "isActive")
  });

  if (!parsed.success) {
    return { ok: false, message: firstError(parsed.error) };
  }

  const loginIdentifier = normalizeLoginIdentifier(parsed.data.loginIdentifier);
  const existingIdentifier = await prisma.user.findFirst({
    where: {
      loginIdentifier,
      role: { not: UserRole.VC }
    }
  });

  if (existingIdentifier) {
    return { ok: false, message: "Brugernavnet er allerede i brug." };
  }

  const vc = await prisma.user.findFirst({ where: { role: UserRole.VC } });
  if (!vc && !parsed.data.temporaryPassword) {
    return { ok: false, message: "Angiv en adgangskode, når VC-kontoen oprettes." };
  }

  const passwordData =
    parsed.data.temporaryPassword && parsed.data.temporaryPassword.length > 0
      ? {
          passwordHash: await hashPassword(parsed.data.temporaryPassword),
          mustChangePassword: true
        }
      : {};

  const vcCreatePassword = parsed.data.temporaryPassword;

  const savedVc = vc
    ? await prisma.user.update({
        where: { id: vc.id },
        data: {
          name: "Vagtcentralen",
          loginIdentifier,
          employeeNumber: null,
          isActive: parsed.data.isActive,
          ...passwordData
        }
      })
    : await prisma.user.create({
        data: {
          name: "Vagtcentralen",
          role: UserRole.VC,
          employeeNumber: null,
          loginIdentifier,
          passwordHash: await hashPassword(vcCreatePassword!),
          isActive: parsed.data.isActive,
          mustChangePassword: true
        }
      });

  await prisma.auditLog.create({
    data: {
      actorUserId: admin.id,
      actorRole: admin.role,
      action: "VC_UPDATED",
      targetUserId: savedVc.id,
      description: "Vagtcentralens fælles login blev opdateret"
    }
  });

  revalidatePath("/admin");
  return { ok: true, message: "VC-kontoen er gemt." };
}

export async function changePasswordAction(
  _state: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requirePasswordChangeUser();
  const parsed = changePasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword")
  });

  if (!parsed.success) {
    return { ok: false, message: firstError(parsed.error) };
  }

  const currentIsValid = await verifyPassword(parsed.data.currentPassword, user.passwordHash);
  if (!currentIsValid) {
    return { ok: false, message: "Den nuværende adgangskode er forkert." };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await hashPassword(parsed.data.newPassword),
      mustChangePassword: false
    }
  });
  await prisma.session.deleteMany({ where: { userId: user.id } });

  await prisma.auditLog.create({
    data: {
      actorUserId: user.id,
      actorRole: user.role,
      action: "PASSWORD_CHANGED",
      targetUserId: user.id,
      description: "Brugeren skiftede adgangskode"
    }
  });

  redirect(roleHome[user.role]);
}

export async function lookupTransferParticipantsAction(
  _state: ActionState,
  formData: FormData
): Promise<ActionState & { giver?: TransferParticipant; receiver?: TransferParticipant }> {
  const user = await requireRole(UserRole.BRANDFIGHTER);
  const parsed = transferLookupSchema.safeParse({
    giverEmployeeNumber: formData.get("giverEmployeeNumber"),
    receiverEmployeeNumber: formData.get("receiverEmployeeNumber"),
    requestedStartAt: formData.get("requestedStartAt"),
    expectedEndMode: formData.get("expectedEndMode"),
    expectedEndAt: formData.get("expectedEndAt") ?? "",
    comment: formData.get("comment") ?? "",
    confirmed: false
  });

  if (!parsed.success) {
    return { ok: false, message: firstError(parsed.error) };
  }

  const [giver, receiver] = await Promise.all([
    findFirefighterByEmployeeNumber(parsed.data.giverEmployeeNumber),
    findFirefighterByEmployeeNumber(parsed.data.receiverEmployeeNumber)
  ]);

  const result = validateTransferParticipants({
    currentUserId: user.id,
    giver,
    receiver,
    giverEmployeeNumber: parsed.data.giverEmployeeNumber,
    receiverEmployeeNumber: parsed.data.receiverEmployeeNumber,
    requestedStartAt: parsed.data.requestedStartAt,
    expectedEndMode: parsed.data.expectedEndMode,
    expectedEndAt: parsed.data.expectedEndAt
  });

  if (!result.ok) {
    await prisma.auditLog.create({
      data: {
        actorUserId: user.id,
        actorRole: user.role,
        action: "TRANSFER_VALIDATION_REJECTED",
        description: result.message
      }
    });
    return { ok: false, message: result.message };
  }

  return {
    ok: true,
    message: "Medarbejdernumrene er kontrolleret.",
    giver: result.giver,
    receiver: result.receiver
  };
}

export async function createTransferAction(
  _state: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireRole(UserRole.BRANDFIGHTER);
  const parsed = transferCreateSchema.safeParse({
    giverEmployeeNumber: formData.get("giverEmployeeNumber"),
    receiverEmployeeNumber: formData.get("receiverEmployeeNumber"),
    requestedStartAt: formData.get("requestedStartAt"),
    expectedEndMode: formData.get("expectedEndMode"),
    expectedEndAt: formData.get("expectedEndAt") ?? "",
    comment: formData.get("comment") ?? "",
    confirmed: formData.get("confirmed") === "on"
  });

  if (!parsed.success) {
    return { ok: false, message: firstError(parsed.error) };
  }

  const [giver, receiver] = await Promise.all([
    findFirefighterByEmployeeNumber(parsed.data.giverEmployeeNumber),
    findFirefighterByEmployeeNumber(parsed.data.receiverEmployeeNumber)
  ]);

  const result = validateTransferParticipants({
    currentUserId: user.id,
    giver,
    receiver,
    giverEmployeeNumber: parsed.data.giverEmployeeNumber,
    receiverEmployeeNumber: parsed.data.receiverEmployeeNumber,
    requestedStartAt: parsed.data.requestedStartAt,
    expectedEndMode: parsed.data.expectedEndMode,
    expectedEndAt: parsed.data.expectedEndAt
  });

  if (!result.ok) {
    await prisma.auditLog.create({
      data: {
        actorUserId: user.id,
        actorRole: user.role,
        action: "TRANSFER_CREATE_REJECTED",
        description: result.message
      }
    });
    return { ok: false, message: result.message };
  }

  const transfer = await prisma.shiftTransfer.create({
    data: {
      transferNumber: await nextTransferNumber(),
      giverUserId: result.giver.id,
      receiverUserId: result.receiver.id,
      giverEmployeeNumberSnapshot: result.giver.employeeNumber!,
      receiverEmployeeNumberSnapshot: result.receiver.employeeNumber!,
      giverNameSnapshot: result.giver.name,
      receiverNameSnapshot: result.receiver.name,
      requestedStartAt: parsed.data.requestedStartAt,
      expectedEndMode: parsed.data.expectedEndMode,
      expectedEndAt: parsed.data.expectedEndAt,
      comment: optionalText(parsed.data.comment),
      status: "AWAITING_RECEIVER"
    }
  });
  await notifyTransferCreated(transfer);

  await prisma.auditLog.create({
    data: {
      actorUserId: user.id,
      actorRole: user.role,
      action: "TRANSFER_CREATED",
      targetUserId: result.receiver.id,
      description: `Vagtoverdragelse ${transfer.transferNumber} blev oprettet`
    }
  });

  revalidatePath("/brandmand");
  redirect(`/brandmand/anmodninger/${transfer.id}`);
}

async function respondToTransfer(input: {
  transferId: string;
  status: Extract<
    TransferStatus,
    "RECEIVER_ACCEPTED_AWAITING_VC" | "RECEIVER_REJECTED"
  >;
  responseComment?: string;
}) {
  const user = await requireRole(UserRole.BRANDFIGHTER);
  const transfer = await prisma.shiftTransfer.findUnique({ where: { id: input.transferId } });

  if (!transfer) {
    return { ok: false, message: "Anmodningen blev ikke fundet." };
  }

  const permission = canRespondToTransfer({
    userId: user.id,
    receiverUserId: transfer.receiverUserId,
    status: transfer.status
  });

  if (!permission.ok) {
    await prisma.auditLog.create({
      data: {
        actorUserId: user.id,
        actorRole: user.role,
        action: "TRANSFER_RESPONSE_REJECTED",
        targetUserId: transfer.receiverUserId,
        description: permission.message
      }
    });
    return { ok: false, message: permission.message };
  }

  const updatedTransfer = await prisma.shiftTransfer.update({
    where: { id: transfer.id },
    data: {
      status: input.status,
      receiverRespondedAt: new Date(),
      receiverResponseComment: optionalText(input.responseComment)
    }
  });
  if (input.status === "RECEIVER_ACCEPTED_AWAITING_VC") {
    await notifyReceiverAccepted(updatedTransfer);
  } else {
    await notifyReceiverRejected(updatedTransfer);
  }

  await prisma.auditLog.create({
    data: {
      actorUserId: user.id,
      actorRole: user.role,
      action:
        input.status === "RECEIVER_ACCEPTED_AWAITING_VC"
          ? "TRANSFER_ACCEPTED_BY_RECEIVER"
          : "TRANSFER_REJECTED_BY_RECEIVER",
      targetUserId: transfer.giverUserId,
      description:
        input.status === "RECEIVER_ACCEPTED_AWAITING_VC"
          ? `Vagtoverdragelse ${transfer.transferNumber} blev accepteret af modtager`
          : `Vagtoverdragelse ${transfer.transferNumber} blev afvist af modtager`
    }
  });

  revalidatePath("/brandmand");
  revalidatePath(`/brandmand/anmodninger/${transfer.id}`);
  return {
    ok: true,
    message:
      input.status === "RECEIVER_ACCEPTED_AWAITING_VC"
        ? "Anmodningen er accepteret og afventer vagtcentralen."
        : "Anmodningen er afvist."
  };
}

export async function acceptTransferAction(
  _state: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = transferResponseSchema.safeParse({
    transferId: formData.get("transferId"),
    responseComment: ""
  });

  if (!parsed.success) {
    return { ok: false, message: firstError(parsed.error) };
  }

  return respondToTransfer({
    transferId: parsed.data.transferId,
    status: "RECEIVER_ACCEPTED_AWAITING_VC"
  });
}

export async function rejectTransferAction(
  _state: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = transferResponseSchema.safeParse({
    transferId: formData.get("transferId"),
    responseComment: formData.get("responseComment") ?? ""
  });

  if (!parsed.success) {
    return { ok: false, message: firstError(parsed.error) };
  }

  return respondToTransfer({
    transferId: parsed.data.transferId,
    status: "RECEIVER_REJECTED",
    responseComment: parsed.data.responseComment
  });
}

export async function cancelTransferAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireRole(UserRole.BRANDFIGHTER);
  const parsed = transferCancelSchema.safeParse({
    transferId: formData.get("transferId"),
    cancellationReason: formData.get("cancellationReason") ?? ""
  });

  if (!parsed.success) {
    return { ok: false, message: firstError(parsed.error) };
  }

  const reason = optionalText(parsed.data.cancellationReason);
  const openReturnStatuses = [
    "AWAITING_ORIGINAL",
    "ORIGINAL_ACCEPTED_AWAITING_VC",
    "VC_APPROVED_AWAITING_EXECUTION"
  ] as const;
  const result = await prisma.$transaction(async (tx) => {
    const transfer = await tx.shiftTransfer.findUnique({
      where: { id: parsed.data.transferId },
      include: {
        returnRequests: {
          where: { status: { in: [...openReturnStatuses] } }
        }
      }
    });

    if (!transfer) {
      return { ok: false, message: "Sagen blev ikke fundet." };
    }

    const permission = canCancelTransfer({
      role: user.role,
      userId: user.id,
      giverUserId: transfer.giverUserId,
      status: transfer.status,
      hasOpenReturnRequest: transfer.returnRequests.length > 0,
      reason
    });
    if (!permission.ok) {
      await tx.auditLog.create({
        data: {
          actorUserId: user.id,
          actorRole: user.role,
          action: "TRANSFER_CANCEL_REJECTED",
          targetUserId: transfer.receiverUserId,
          description: permission.message
        }
      });
      return { ok: false, message: permission.message };
    }

    const now = new Date();
    const cancelled = await tx.shiftTransfer.updateMany({
      where: {
        id: transfer.id,
        status: {
          in: ["AWAITING_RECEIVER", "RECEIVER_ACCEPTED_AWAITING_VC", "VC_APPROVED_AWAITING_ACTIVATION"]
        }
      },
      data: {
        status: "CANCELLED",
        cancelledAt: now,
        cancelledByUserId: user.id,
        cancellationReason: reason
      }
    });

    if (cancelled.count !== 1) {
      return { ok: false, message: "Vagtoverdragelsen er allerede behandlet." };
    }

    await cancelFutureTransferNotifications(tx, transfer.id);
    await tx.auditLog.create({
      data: {
        actorUserId: user.id,
        actorRole: user.role,
        action: "TRANSFER_CANCELLED",
        targetUserId: transfer.receiverUserId,
        description: `Vagtoverdragelse ${transfer.transferNumber} blev annulleret`
      }
    });

    return { ok: true, transfer };
  });

  if (!result.ok || !("transfer" in result)) {
    return result;
  }
  const transferToNotify = result.transfer;
  if (!transferToNotify) {
    return { ok: false, message: "Vagtoverdragelsen er allerede behandlet." };
  }

  await notifyTransferCancelled(transferToNotify, reason);
  revalidatePath("/brandmand");
  revalidatePath(`/brandmand/anmodninger/${parsed.data.transferId}`);
  revalidatePath("/vagtcentral");
  revalidatePath(`/vagtcentral/sager/${parsed.data.transferId}`);
  return { ok: true, message: "Vagtoverdragelsen er annulleret" };
}

async function decideTransferByVc(input: {
  transferId: string;
  approve: boolean;
  comment?: string;
}): Promise<ActionState> {
  const vc = await requireRole(UserRole.VC);
  const transfer = await prisma.shiftTransfer.findUnique({ where: { id: input.transferId } });

  if (!transfer) {
    return { ok: false, message: "Sagen blev ikke fundet." };
  }

  const permission = canVcDecideTransfer({ role: vc.role, status: transfer.status });
  if (!permission.ok) {
    await prisma.auditLog.create({
      data: {
        actorUserId: vc.id,
        actorRole: vc.role,
        action: "VC_TRANSFER_DECISION_REJECTED",
        description: permission.message
      }
    });
    return { ok: false, message: permission.message };
  }

  const now = new Date();
  const decision = await prisma.shiftTransfer.updateMany({
    where: { id: transfer.id, status: "RECEIVER_ACCEPTED_AWAITING_VC" },
    data: {
      status: input.approve ? "VC_APPROVED_AWAITING_ACTIVATION" : "VC_REJECTED",
      vcDecidedAt: now,
      vcDecision: input.approve ? "Godkendt af Vagtcentralen" : "Afvist af Vagtcentralen",
      vcComment: optionalText(input.comment),
      activatedAt: null
    }
  });
  if (decision.count !== 1) {
    return { ok: false, message: "Sagen er allerede behandlet." };
  }

  const updatedTransfer = await prisma.shiftTransfer.findUniqueOrThrow({ where: { id: transfer.id } });
  await notifyVcTransferDecision(updatedTransfer, vc, input.approve);

  await prisma.auditLog.create({
    data: {
      actorUserId: vc.id,
      actorRole: vc.role,
      action: input.approve ? "TRANSFER_VC_APPROVED" : "TRANSFER_VC_REJECTED",
      targetUserId: transfer.giverUserId,
      description: input.approve
        ? `Godkendt af Vagtcentralen: ${transfer.transferNumber}`
        : `Afvist af Vagtcentralen: ${transfer.transferNumber}`
    }
  });

  revalidatePath("/vagtcentral");
  revalidatePath(`/vagtcentral/sager/${transfer.id}`);
  revalidatePath("/brandmand");
  revalidatePath(`/brandmand/anmodninger/${transfer.id}`);
  return {
    ok: true,
    message: input.approve ? "Vagtoverdragelsen er godkendt." : "Vagtoverdragelsen er afvist."
  };
}

export async function approveTransferByVcAction(
  _state: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = vcTransferDecisionSchema.safeParse({
    transferId: formData.get("transferId"),
    comment: formData.get("comment") ?? ""
  });

  if (!parsed.success) {
    return { ok: false, message: firstError(parsed.error) };
  }

  return decideTransferByVc({
    transferId: parsed.data.transferId,
    approve: true,
    comment: parsed.data.comment
  });
}

export async function rejectTransferByVcAction(
  _state: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = vcTransferRejectSchema.safeParse({
    transferId: formData.get("transferId"),
    comment: formData.get("comment") ?? ""
  });

  if (!parsed.success) {
    return { ok: false, message: firstError(parsed.error) };
  }

  return decideTransferByVc({
    transferId: parsed.data.transferId,
    approve: false,
    comment: parsed.data.comment
  });
}

export async function createReturnRequestAction(
  _state: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireRole(UserRole.BRANDFIGHTER);
  const parsed = returnRequestCreateSchema.safeParse({
    transferId: formData.get("transferId"),
    requestedReturnAt: formData.get("requestedReturnAt"),
    comment: formData.get("comment") ?? ""
  });

  if (!parsed.success) {
    return { ok: false, message: firstError(parsed.error) };
  }

  const transfer = await prisma.shiftTransfer.findUnique({
    where: { id: parsed.data.transferId },
    include: {
      returnRequests: {
        where: { status: { in: ["AWAITING_ORIGINAL", "ORIGINAL_ACCEPTED_AWAITING_VC"] } }
      }
    }
  });

  if (!transfer) {
    return { ok: false, message: "Sagen blev ikke fundet." };
  }

  const permission = canCreateReturnRequest({
    userId: user.id,
    receiverUserId: transfer.receiverUserId,
    status: transfer.status,
    hasOpenReturnRequest: transfer.returnRequests.length > 0
  });

  if (!permission.ok) {
    await prisma.auditLog.create({
      data: {
        actorUserId: user.id,
        actorRole: user.role,
        action: "RETURN_CREATE_REJECTED",
        description: permission.message
      }
    });
    return { ok: false, message: permission.message };
  }

  const returnRequest = await prisma.returnRequest.create({
    data: {
      returnNumber: await nextReturnNumber(),
      transferId: transfer.id,
      createdByUserId: user.id,
      originalUserId: transfer.giverUserId,
      currentHolderUserId: transfer.receiverUserId,
      originalNameSnapshot: transfer.giverNameSnapshot,
      originalEmployeeNumberSnapshot: transfer.giverEmployeeNumberSnapshot,
      currentHolderNameSnapshot: transfer.receiverNameSnapshot,
      currentHolderEmployeeNumberSnapshot: transfer.receiverEmployeeNumberSnapshot,
      requestedReturnAt: parsed.data.requestedReturnAt,
      comment: optionalText(parsed.data.comment),
      status: "AWAITING_ORIGINAL"
    }
  });

  await prisma.shiftTransfer.update({
    where: { id: transfer.id },
    data: { status: "RETURN_AWAITING_ORIGINAL" }
  });
  await notifyReturnCreated(transfer, returnRequest);

  await prisma.auditLog.create({
    data: {
      actorUserId: user.id,
      actorRole: user.role,
      action: "RETURN_CREATED",
      targetUserId: transfer.giverUserId,
      description: `Tilbagelevering ${returnRequest.returnNumber} blev oprettet`
    }
  });

  revalidatePath("/brandmand");
  revalidatePath(`/brandmand/anmodninger/${transfer.id}`);
  return { ok: true, message: "Tilbageleveringen er oprettet og afventer den oprindelige brandmand." };
}

async function respondToReturnRequest(input: {
  returnRequestId: string;
  accept: boolean;
  responseComment?: string;
}): Promise<ActionState> {
  const user = await requireRole(UserRole.BRANDFIGHTER);
  const returnRequest = await prisma.returnRequest.findUnique({
    where: { id: input.returnRequestId },
    include: { transfer: true }
  });

  if (!returnRequest) {
    return { ok: false, message: "Tilbageleveringen blev ikke fundet." };
  }

  const permission = canOriginalRespondToReturn({
    userId: user.id,
    originalUserId: returnRequest.originalUserId,
    transferStatus: returnRequest.transfer.status,
    returnStatus: returnRequest.status
  });

  if (!permission.ok) {
    await prisma.auditLog.create({
      data: {
        actorUserId: user.id,
        actorRole: user.role,
        action: "RETURN_RESPONSE_REJECTED",
        description: permission.message
      }
    });
    return { ok: false, message: permission.message };
  }

  const now = new Date();
  const updatedReturnRequest = await prisma.returnRequest.update({
    where: { id: returnRequest.id },
    data: {
      status: input.accept ? "ORIGINAL_ACCEPTED_AWAITING_VC" : "ORIGINAL_REJECTED",
      originalRespondedAt: now,
      originalAcceptedAt: input.accept ? now : null,
      originalResponseComment: optionalText(input.responseComment)
    }
  });

  const updatedTransfer = await prisma.shiftTransfer.update({
    where: { id: returnRequest.transferId },
    data: { status: input.accept ? "RETURN_ACCEPTED_AWAITING_VC" : "VC_APPROVED_ACTIVE" }
  });
  await notifyOriginalReturnResponse(updatedTransfer, updatedReturnRequest, input.accept);

  await prisma.auditLog.create({
    data: {
      actorUserId: user.id,
      actorRole: user.role,
      action: input.accept ? "RETURN_ACCEPTED_BY_ORIGINAL" : "RETURN_REJECTED_BY_ORIGINAL",
      targetUserId: returnRequest.currentHolderUserId,
      description: input.accept
        ? `Tilbagelevering ${returnRequest.returnNumber} blev accepteret`
        : `Tilbagelevering ${returnRequest.returnNumber} blev afvist`
    }
  });

  revalidatePath("/brandmand");
  revalidatePath(`/brandmand/anmodninger/${returnRequest.transferId}`);
  revalidatePath("/vagtcentral");
  return {
    ok: true,
    message: input.accept
      ? "Tilbageleveringen er accepteret og afventer vagtcentralen."
      : "Tilbageleveringen er afvist. Vagtoverdragelsen fortsætter."
  };
}

export async function acceptReturnRequestAction(
  _state: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = returnRequestResponseSchema.safeParse({
    returnRequestId: formData.get("returnRequestId"),
    responseComment: ""
  });

  if (!parsed.success) {
    return { ok: false, message: firstError(parsed.error) };
  }

  return respondToReturnRequest({ returnRequestId: parsed.data.returnRequestId, accept: true });
}

export async function rejectReturnRequestAction(
  _state: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = returnRequestResponseSchema.safeParse({
    returnRequestId: formData.get("returnRequestId"),
    responseComment: formData.get("responseComment") ?? ""
  });

  if (!parsed.success) {
    return { ok: false, message: firstError(parsed.error) };
  }

  return respondToReturnRequest({
    returnRequestId: parsed.data.returnRequestId,
    accept: false,
    responseComment: parsed.data.responseComment
  });
}

async function decideReturnByVc(input: {
  returnRequestId: string;
  approve: boolean;
  comment?: string;
}): Promise<ActionState> {
  const vc = await requireRole(UserRole.VC);
  const returnRequest = await prisma.returnRequest.findUnique({
    where: { id: input.returnRequestId },
    include: { transfer: true }
  });

  if (!returnRequest) {
    return { ok: false, message: "Tilbageleveringen blev ikke fundet." };
  }

  const permission = canVcDecideReturn({
    role: vc.role,
    transferStatus: returnRequest.transfer.status,
    returnStatus: returnRequest.status
  });

  if (!permission.ok) {
    await prisma.auditLog.create({
      data: {
        actorUserId: vc.id,
        actorRole: vc.role,
        action: "VC_RETURN_DECISION_REJECTED",
        description: permission.message
      }
    });
    return { ok: false, message: permission.message };
  }

  const now = new Date();
  const decision = await prisma.returnRequest.updateMany({
    where: { id: returnRequest.id, status: "ORIGINAL_ACCEPTED_AWAITING_VC" },
    data: {
      status: input.approve ? "VC_APPROVED_AWAITING_EXECUTION" : "VC_REJECTED",
      vcDecidedAt: now,
      vcDecision: input.approve ? "Godkendt af Vagtcentralen" : "Afvist af Vagtcentralen",
      vcComment: optionalText(input.comment),
      completedAt: null
    }
  });
  if (decision.count !== 1) {
    return { ok: false, message: "Tilbageleveringen er allerede behandlet." };
  }

  const updatedReturnRequest = await prisma.returnRequest.findUniqueOrThrow({ where: { id: returnRequest.id } });

  const updatedTransfer = await prisma.shiftTransfer.update({
    where: { id: returnRequest.transferId },
    data: {
      status: input.approve ? "RETURN_APPROVED_AWAITING_EXECUTION" : "VC_APPROVED_ACTIVE",
      completedAt: null
    }
  });
  await notifyVcReturnDecision(updatedTransfer, updatedReturnRequest, vc, input.approve);

  await prisma.auditLog.create({
    data: {
      actorUserId: vc.id,
      actorRole: vc.role,
      action: input.approve ? "RETURN_VC_APPROVED_AWAITING_EXECUTION" : "RETURN_VC_REJECTED",
      targetUserId: returnRequest.originalUserId,
      description: input.approve
        ? `Tilbagelevering ${returnRequest.returnNumber} blev godkendt og afventer gennemførelse`
        : `Tilbagelevering ${returnRequest.returnNumber} blev afvist af vagtcentralen`
    }
  });

  revalidatePath("/vagtcentral");
  revalidatePath(`/vagtcentral/sager/${returnRequest.transferId}`);
  revalidatePath("/brandmand");
  revalidatePath(`/brandmand/anmodninger/${returnRequest.transferId}`);
  return {
    ok: true,
    message: input.approve
      ? "Tilbageleveringen er godkendt og afventer gennemførelse."
      : "Tilbageleveringen er afvist. Vagtoverdragelsen fortsætter."
  };
}

export async function confirmTransferActivationAction(
  _state: ActionState,
  formData: FormData
): Promise<ActionState> {
  const vc = await requireRole(UserRole.VC);
  const parsed = vcTransferActivationSchema.safeParse({ transferId: formData.get("transferId") });
  if (!parsed.success) {
    return { ok: false, message: firstError(parsed.error) };
  }

  const transfer = await prisma.shiftTransfer.findUnique({ where: { id: parsed.data.transferId } });
  if (!transfer) {
    return { ok: false, message: "Sagen blev ikke fundet." };
  }

  const permission = canVcConfirmTransferActivation({ role: vc.role, status: transfer.status });
  if (!permission.ok) {
    return { ok: false, message: permission.message };
  }

  const now = new Date();
  const confirmed = await prisma.shiftTransfer.updateMany({
    where: { id: transfer.id, status: "VC_APPROVED_AWAITING_ACTIVATION" },
    data: {
      status: "VC_APPROVED_ACTIVE",
      activatedAt: now,
      activationConfirmedAt: now,
      activationConfirmedByUserId: vc.id
    }
  });
  if (confirmed.count !== 1) {
    return { ok: false, message: "Vagtskiftet er allerede bekræftet." };
  }

  const updatedTransfer = await prisma.shiftTransfer.findUniqueOrThrow({ where: { id: transfer.id } });
  await notifyTransferActivated(updatedTransfer);
  await prisma.auditLog.create({
    data: {
      actorUserId: vc.id,
      actorRole: vc.role,
      action: "TRANSFER_ACTIVATION_CONFIRMED",
      targetUserId: transfer.receiverUserId,
      description: `Vagtskifte ${transfer.transferNumber} blev bekræftet udført`
    }
  });

  revalidatePath("/vagtcentral");
  revalidatePath(`/vagtcentral/sager/${transfer.id}`);
  revalidatePath("/brandmand");
  revalidatePath(`/brandmand/anmodninger/${transfer.id}`);
  return { ok: true, message: "Vagtskiftet er bekræftet udført." };
}

export async function confirmReturnExecutionAction(
  _state: ActionState,
  formData: FormData
): Promise<ActionState> {
  const vc = await requireRole(UserRole.VC);
  const parsed = vcReturnExecutionSchema.safeParse({ returnRequestId: formData.get("returnRequestId") });
  if (!parsed.success) {
    return { ok: false, message: firstError(parsed.error) };
  }

  const returnRequest = await prisma.returnRequest.findUnique({
    where: { id: parsed.data.returnRequestId },
    include: { transfer: true }
  });
  if (!returnRequest) {
    return { ok: false, message: "Tilbageleveringen blev ikke fundet." };
  }

  const permission = canVcConfirmReturnExecution({
    role: vc.role,
    transferStatus: returnRequest.transfer.status,
    returnStatus: returnRequest.status
  });
  if (!permission.ok) {
    return { ok: false, message: permission.message };
  }

  const now = new Date();
  const confirmed = await prisma.returnRequest.updateMany({
    where: { id: returnRequest.id, status: "VC_APPROVED_AWAITING_EXECUTION" },
    data: {
      status: "VC_APPROVED_COMPLETED",
      completedAt: now,
      returnExecutionConfirmedAt: now,
      returnExecutionConfirmedByUserId: vc.id
    }
  });
  if (confirmed.count !== 1) {
    return { ok: false, message: "Tilbageleveringen er allerede bekræftet." };
  }

  const updatedTransfer = await prisma.shiftTransfer.update({
    where: { id: returnRequest.transferId },
    data: { status: "COMPLETED", completedAt: now }
  });
  const updatedReturnRequest = await prisma.returnRequest.findUniqueOrThrow({ where: { id: returnRequest.id } });
  await notifyReturnExecutionCompleted(updatedTransfer, updatedReturnRequest);
  await prisma.auditLog.create({
    data: {
      actorUserId: vc.id,
      actorRole: vc.role,
      action: "RETURN_EXECUTION_CONFIRMED",
      targetUserId: returnRequest.originalUserId,
      description: `Tilbagelevering ${returnRequest.returnNumber} blev bekræftet udført`
    }
  });

  revalidatePath("/vagtcentral");
  revalidatePath(`/vagtcentral/sager/${returnRequest.transferId}`);
  revalidatePath("/brandmand");
  revalidatePath(`/brandmand/anmodninger/${returnRequest.transferId}`);
  return { ok: true, message: "Tilbageleveringen er bekræftet udført." };
}

export async function markNotificationReadAction(formData: FormData) {
  const user = await requireUser();
  const parsed = notificationIdSchema.safeParse({
    notificationId: formData.get("notificationId")
  });

  if (!parsed.success) {
    redirect(roleHome[user.role]);
  }

  const notification = await prisma.notification.findUnique({
    where: { id: parsed.data.notificationId }
  });

  if (!notification || notification.recipientUserId !== user.id) {
    redirect("/forbudt");
  }

  await prisma.notification.update({
    where: { id: notification.id },
    data: { readAt: notification.readAt ?? new Date(), openedAt: notification.openedAt ?? new Date() }
  });

  revalidatePath(roleHome[user.role]);
}

export async function openNotificationAction(formData: FormData) {
  const user = await requireUser();
  const parsed = notificationIdSchema.safeParse({
    notificationId: formData.get("notificationId")
  });
  if (!parsed.success) {
    redirect(roleHome[user.role]);
  }

  const notification = await prisma.notification.findUnique({ where: { id: parsed.data.notificationId } });
  if (!notification || notification.recipientUserId !== user.id) {
    redirect("/forbudt");
  }

  await prisma.notification.update({
    where: { id: notification.id },
    data: { readAt: notification.readAt ?? new Date(), openedAt: notification.openedAt ?? new Date() }
  });

  redirect(notification.link || roleHome[user.role]);
}

export async function markAllNotificationsReadAction() {
  const user = await requireUser();
  await prisma.notification.updateMany({
    where: { recipientUserId: user.id, readAt: null },
    data: { readAt: new Date() }
  });
  revalidatePath(roleHome[user.role]);
}

export async function dismissReadNotificationsAction() {
  const user = await requireUser();
  await prisma.notification.updateMany({
    where: {
      recipientUserId: user.id,
      readAt: { not: null },
      dismissedAt: null
    },
    data: { dismissedAt: new Date() }
  });
  revalidatePath(roleHome[user.role]);
}

export async function savePushSubscriptionAction(input: unknown): Promise<ActionState> {
  const user = await requireUser();
  const parsed = pushSubscriptionSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, message: firstError(parsed.error) };
  }

  await prisma.pushSubscription.upsert({
    where: { endpoint: parsed.data.endpoint },
    update: {
      userId: user.id,
      p256dh: parsed.data.p256dh,
      auth: parsed.data.auth,
      userAgent: parsed.data.userAgent,
      deviceName: parsed.data.deviceName,
      revokedAt: null,
      lastUsedAt: new Date()
    },
    create: {
      userId: user.id,
      endpoint: parsed.data.endpoint,
      p256dh: parsed.data.p256dh,
      auth: parsed.data.auth,
      userAgent: parsed.data.userAgent,
      deviceName: parsed.data.deviceName,
      lastUsedAt: new Date()
    }
  });

  await prisma.auditLog.create({
    data: {
      actorUserId: user.id,
      actorRole: user.role,
      action: "PUSH_SUBSCRIPTION_SAVED",
      description: "Push-enhed blev registreret"
    }
  });

  return { ok: true, message: "Push-notifikationer er aktive." };
}

export async function removePushSubscriptionAction(formData: FormData) {
  const user = await requireUser();
  const parsed = pushSubscriptionIdSchema.safeParse({
    subscriptionId: formData.get("subscriptionId")
  });

  if (!parsed.success) {
    redirect(roleHome[user.role]);
  }

  const subscription = await prisma.pushSubscription.findUnique({ where: { id: parsed.data.subscriptionId } });
  if (!subscription || subscription.userId !== user.id) {
    redirect("/forbudt");
  }

  await prisma.pushSubscription.update({
    where: { id: subscription.id },
    data: { revokedAt: new Date() }
  });

  revalidatePath(roleHome[user.role]);
}

export async function sendTestNotificationAction(): Promise<ActionState> {
  const user = await requireUser();
  const recent = await prisma.notification.count({
    where: {
      recipientUserId: user.id,
      type: "TEST",
      createdAt: { gte: new Date(Date.now() - 1000 * 60) }
    }
  });

  if (recent > 0) {
    return { ok: false, message: "Vent lidt, før du sender en ny testnotifikation." };
  }

  const notification = await createNotification(prisma, {
    recipientUserId: user.id,
    type: "TEST",
    title: "Testnotifikation",
    body: "Dette er en testbesked fra Vagtbytte.",
    link: roleHome[user.role],
    uniqueKey: `test:${user.id}:${Date.now()}`,
    publishNow: true
  });
  await sendPushForNotification(prisma, notification.id);

  await prisma.auditLog.create({
    data: {
      actorUserId: user.id,
      actorRole: user.role,
      action: "TEST_NOTIFICATION_SENT",
      description: "Testnotifikation blev oprettet"
    }
  });

  revalidatePath(roleHome[user.role]);
  return { ok: true, message: "Testnotifikationen er oprettet." };
}

export async function sendTestPushToCurrentDeviceAction(endpoint: string): Promise<ActionState> {
  const user = await requireUser();
  const subscription = await prisma.pushSubscription.findUnique({ where: { endpoint } });
  if (!subscription || subscription.userId !== user.id || subscription.revokedAt) {
    return { ok: false, message: "Denne enhed er ikke registreret til push." };
  }

  const notification = await createNotification(prisma, {
    recipientUserId: user.id,
    type: "TEST",
    title: "Testnotifikation",
    body: "Dette er en testbesked fra Vagtbytte.",
    link: roleHome[user.role],
    uniqueKey: `test-device:${subscription.id}:${Date.now()}`,
    publishNow: true
  });
  const result = await sendPushForNotification(prisma, notification.id, { endpoint });

  await prisma.auditLog.create({
    data: {
      actorUserId: user.id,
      actorRole: user.role,
      action: "TEST_PUSH_SENT_TO_DEVICE",
      description: "Testpush blev sendt til aktuel enhed"
    }
  });

  revalidatePath(roleHome[user.role]);
  return result.sent > 0
    ? { ok: true, message: "Testpush er sendt til denne enhed." }
    : { ok: false, message: "Testpush kunne ikke sendes til denne enhed." };
}

export async function approveReturnByVcAction(
  _state: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = vcReturnDecisionSchema.safeParse({
    returnRequestId: formData.get("returnRequestId"),
    comment: formData.get("comment") ?? ""
  });

  if (!parsed.success) {
    return { ok: false, message: firstError(parsed.error) };
  }

  return decideReturnByVc({
    returnRequestId: parsed.data.returnRequestId,
    approve: true,
    comment: parsed.data.comment
  });
}

export async function rejectReturnByVcAction(
  _state: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = vcReturnRejectSchema.safeParse({
    returnRequestId: formData.get("returnRequestId"),
    comment: formData.get("comment") ?? ""
  });

  if (!parsed.success) {
    return { ok: false, message: firstError(parsed.error) };
  }

  return decideReturnByVc({
    returnRequestId: parsed.data.returnRequestId,
    approve: false,
    comment: parsed.data.comment
  });
}
