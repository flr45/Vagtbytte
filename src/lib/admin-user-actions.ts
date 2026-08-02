"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { UserRole } from "@prisma/client";
import { z } from "zod";
import { requireRole } from "./auth";
import { normalizeLoginIdentifier } from "./login-identifiers";
import { hashPassword, passwordSchema } from "./passwords";
import { prisma } from "./prisma";
import {
  STATION_CODE_VALUES,
  isStationCode,
  normalizeStationCodes
} from "./stations";

export type AdminUserActionState = {
  ok?: boolean;
  message?: string;
};

const baseUserSchema = z.object({
  name: z.string().trim().min(1, "Navn skal udfyldes"),
  employeeNumber: z.string().trim().min(1, "Medarbejdernummer skal udfyldes"),
  stationCode: z.enum(STATION_CODE_VALUES, { required_error: "Vælg en station" }),
  isActive: z.boolean(),
  hasAdminAccess: z.boolean(),
  receiveAlarmFollowUps: z.boolean(),
  alarmStations: z.array(z.enum(STATION_CODE_VALUES)).max(STATION_CODE_VALUES.length)
});

const createUserSchema = baseUserSchema.extend({
  temporaryPassword: passwordSchema
});

const updateUserSchema = baseUserSchema.extend({
  userId: z.string().min(1)
});

const resetPasswordSchema = z.object({
  userId: z.string().min(1),
  temporaryPassword: passwordSchema
});

const deleteUserSchema = z.object({ userId: z.string().min(1) });

function boolFromForm(formData: FormData, field: string) {
  return formData.get(field) === "on";
}

function firstError(error: z.ZodError) {
  return error.issues[0]?.message ?? "Formularen er ikke udfyldt korrekt.";
}

function userInput(formData: FormData) {
  const stationCode = String(formData.get("stationCode") ?? "");
  const selectedAlarmStations = normalizeStationCodes(formData.getAll("alarmStations"));
  const alarmStations =
    isStationCode(stationCode) && !selectedAlarmStations.includes(stationCode)
      ? [...selectedAlarmStations, stationCode]
      : selectedAlarmStations;

  return {
    name: formData.get("name"),
    employeeNumber: formData.get("employeeNumber"),
    stationCode,
    isActive: boolFromForm(formData, "isActive"),
    hasAdminAccess: boolFromForm(formData, "hasAdminAccess"),
    receiveAlarmFollowUps: boolFromForm(formData, "receiveAlarmFollowUps"),
    alarmStations
  };
}

export async function createManagedUserAction(
  _state: AdminUserActionState,
  formData: FormData
): Promise<AdminUserActionState> {
  const admin = await requireRole(UserRole.ADMIN);
  const parsed = createUserSchema.safeParse({
    ...userInput(formData),
    temporaryPassword: formData.get("temporaryPassword")
  });

  if (!parsed.success) {
    return { ok: false, message: firstError(parsed.error) };
  }

  const loginIdentifier = normalizeLoginIdentifier(parsed.data.employeeNumber);
  const existing = await prisma.user.findFirst({
    where: { OR: [{ employeeNumber: loginIdentifier }, { loginIdentifier }] },
    select: { id: true }
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
      mustChangePassword: true,
      stationCode: parsed.data.stationCode,
      alarmStations: parsed.data.alarmStations,
      receiveAlarmFollowUps: parsed.data.receiveAlarmFollowUps,
      hasAdminAccess: parsed.data.hasAdminAccess
    }
  });

  await prisma.auditLog.create({
    data: {
      actorUserId: admin.id,
      actorRole: admin.role,
      action: "USER_CREATED",
      targetUserId: user.id,
      description: `${user.name} blev oprettet på station ${user.stationCode}`
    }
  });

  revalidatePath("/admin");
  return { ok: true, message: "Brugeren er oprettet." };
}

export async function updateManagedUserAction(
  _state: AdminUserActionState,
  formData: FormData
): Promise<AdminUserActionState> {
  const admin = await requireRole(UserRole.ADMIN);
  const parsed = updateUserSchema.safeParse({
    ...userInput(formData),
    userId: formData.get("userId")
  });

  if (!parsed.success) {
    return { ok: false, message: firstError(parsed.error) };
  }

  const user = await prisma.user.findUnique({ where: { id: parsed.data.userId } });
  if (!user || user.role !== UserRole.BRANDFIGHTER || user.loginIdentifier === "__deleted_user__") {
    return { ok: false, message: "Brugeren blev ikke fundet." };
  }

  const loginIdentifier = normalizeLoginIdentifier(parsed.data.employeeNumber);
  const duplicate = await prisma.user.findFirst({
    where: {
      id: { not: parsed.data.userId },
      OR: [{ employeeNumber: loginIdentifier }, { loginIdentifier }]
    },
    select: { id: true }
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
      isActive: parsed.data.isActive,
      stationCode: parsed.data.stationCode,
      alarmStations: parsed.data.alarmStations,
      receiveAlarmFollowUps: parsed.data.receiveAlarmFollowUps,
      hasAdminAccess: parsed.data.hasAdminAccess
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
      description: `${parsed.data.name} blev opdateret`
    }
  });

  revalidatePath("/admin");
  return { ok: true, message: "Brugeren er gemt." };
}

export async function resetManagedUserPasswordAction(
  _state: AdminUserActionState,
  formData: FormData
): Promise<AdminUserActionState> {
  const admin = await requireRole(UserRole.ADMIN);
  const parsed = resetPasswordSchema.safeParse({
    userId: formData.get("userId"),
    temporaryPassword: formData.get("temporaryPassword")
  });

  if (!parsed.success) {
    return { ok: false, message: firstError(parsed.error) };
  }

  const user = await prisma.user.findUnique({ where: { id: parsed.data.userId } });
  if (!user || user.role !== UserRole.BRANDFIGHTER || user.loginIdentifier === "__deleted_user__") {
    return { ok: false, message: "Brugeren blev ikke fundet." };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await hashPassword(parsed.data.temporaryPassword),
      mustChangePassword: true
    }
  });
  await prisma.session.deleteMany({ where: { userId: user.id } });
  await prisma.auditLog.create({
    data: {
      actorUserId: admin.id,
      actorRole: admin.role,
      action: "PASSWORD_RESET",
      targetUserId: user.id,
      description: `Adgangskoden blev nulstillet for ${user.name}`
    }
  });

  revalidatePath("/admin");
  return { ok: true, message: "Adgangskoden er nulstillet." };
}

export async function deleteManagedUserAction(
  _state: AdminUserActionState,
  formData: FormData
): Promise<AdminUserActionState> {
  const admin = await requireRole(UserRole.ADMIN);
  const parsed = deleteUserSchema.safeParse({ userId: formData.get("userId") });

  if (!parsed.success) {
    return { ok: false, message: firstError(parsed.error) };
  }
  if (parsed.data.userId === admin.id) {
    return { ok: false, message: "Du kan ikke slette din egen bruger." };
  }

  const target = await prisma.user.findUnique({ where: { id: parsed.data.userId } });
  if (!target || target.role !== UserRole.BRANDFIGHTER || target.loginIdentifier === "__deleted_user__") {
    return { ok: false, message: "Brugeren blev ikke fundet." };
  }

  const placeholderPassword = await hashPassword(randomBytes(32).toString("base64url"));

  await prisma.$transaction(async (tx) => {
    const placeholder = await tx.user.upsert({
      where: { loginIdentifier: "__deleted_user__" },
      update: { isActive: false },
      create: {
        name: "Slettet bruger",
        role: UserRole.BRANDFIGHTER,
        employeeNumber: null,
        loginIdentifier: "__deleted_user__",
        passwordHash: placeholderPassword,
        isActive: false,
        mustChangePassword: false,
        stationCode: null,
        alarmStations: [],
        receiveAlarmFollowUps: false,
        hasAdminAccess: false
      }
    });

    await tx.shiftTransfer.updateMany({
      where: { giverUserId: target.id },
      data: { giverUserId: placeholder.id }
    });
    await tx.shiftTransfer.updateMany({
      where: { receiverUserId: target.id },
      data: { receiverUserId: placeholder.id }
    });
    await tx.returnRequest.updateMany({
      where: { createdByUserId: target.id },
      data: { createdByUserId: placeholder.id }
    });
    await tx.returnRequest.updateMany({
      where: { originalUserId: target.id },
      data: { originalUserId: placeholder.id }
    });
    await tx.returnRequest.updateMany({
      where: { currentHolderUserId: target.id },
      data: { currentHolderUserId: placeholder.id }
    });

    await tx.user.delete({ where: { id: target.id } });
    await tx.auditLog.create({
      data: {
        actorUserId: admin.id,
        actorRole: admin.role,
        action: "USER_DELETED",
        description: `${target.name} (${target.employeeNumber ?? "uden medarbejdernummer"}) blev slettet`
      }
    });
  });

  revalidatePath("/admin");
  revalidatePath("/vagtcentral");
  return { ok: true, message: "Brugeren er slettet." };
}
