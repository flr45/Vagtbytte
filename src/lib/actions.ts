"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { UserRole, type TransferStatus } from "@prisma/client";
import { prisma } from "./prisma";
import { hashPassword, verifyPassword } from "./passwords";
import {
  changePasswordSchema,
  firefighterCreateSchema,
  firefighterUpdateSchema,
  loginSchema,
  passwordResetSchema,
  transferCreateSchema,
  transferLookupSchema,
  transferResponseSchema,
  vcUpdateSchema
} from "./validation";
import { requirePasswordChangeUser, requireRole, roleHome, signIn, signOut } from "./auth";
import {
  canRespondToTransfer,
  validateTransferParticipants,
  type TransferParticipant
} from "./transfer-rules";

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

  const existing = await prisma.user.findFirst({
    where: { employeeNumber: parsed.data.employeeNumber }
  });

  if (existing) {
    return { ok: false, message: "Medarbejdernummeret er allerede i brug." };
  }

  const user = await prisma.user.create({
    data: {
      name: parsed.data.name,
      role: UserRole.BRANDFIGHTER,
      employeeNumber: parsed.data.employeeNumber,
      loginIdentifier: parsed.data.employeeNumber,
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

  const duplicate = await prisma.user.findFirst({
    where: {
      employeeNumber: parsed.data.employeeNumber,
      id: { not: parsed.data.userId }
    }
  });

  if (duplicate) {
    return { ok: false, message: "Medarbejdernummeret er allerede i brug." };
  }

  await prisma.user.update({
    where: { id: parsed.data.userId },
    data: {
      name: parsed.data.name,
      employeeNumber: parsed.data.employeeNumber,
      loginIdentifier: parsed.data.employeeNumber,
      isActive: parsed.data.isActive
    }
  });

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

  const existingIdentifier = await prisma.user.findFirst({
    where: {
      loginIdentifier: parsed.data.loginIdentifier,
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
          loginIdentifier: parsed.data.loginIdentifier,
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
          loginIdentifier: parsed.data.loginIdentifier,
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
      expectedEndAt: parsed.data.expectedEndAt,
      comment: optionalText(parsed.data.comment),
      status: "AWAITING_RECEIVER"
    }
  });

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

  await prisma.shiftTransfer.update({
    where: { id: transfer.id },
    data: {
      status: input.status,
      receiverRespondedAt: new Date(),
      receiverResponseComment: optionalText(input.responseComment)
    }
  });

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
