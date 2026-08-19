"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { UserRole } from "@prisma/client";
import { z } from "zod";
import { requireRole } from "./auth";
import { normalizeLoginIdentifier } from "./login-identifiers";
import { setOperationalPortalGrant } from "./operativ-portal-access";
import { hashPassword, passwordSchema } from "./passwords";
import { prisma } from "./prisma";
import {
  STATION_CODE_VALUES,
  normalizeStationCodes
} from "./stations";

export type AdminUserActionState = {
  ok?: boolean;
  message?: string;
};

const ANONYMIZED_NAME = "Slettet bruger";
const ANONYMIZED_EMPLOYEE_NUMBER = "ANONYMISERET";

const optionalEmailSchema = z
  .string()
  .trim()
  .refine(
    (value) => value.length === 0 || z.string().email().safeParse(value).success,
    "Mailadressen er ugyldig"
  )
  .transform((value) => (value.length > 0 ? value.toLowerCase() : null));

const baseUserSchema = z.object({
  name: z.string().trim().min(1, "Navn skal udfyldes"),
  employeeNumber: z.string().trim().min(1, "Medarbejdernummer skal udfyldes"),
  email: optionalEmailSchema,
  stationCode: z.enum(STATION_CODE_VALUES, { required_error: "Vælg en station" }),
  isActive: z.boolean(),
  hasAdminAccess: z.boolean(),
  hasOperationalPortalAccess: z.boolean(),
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
  const alarmStations = normalizeStationCodes(formData.getAll("alarmStations"));

  return {
    name: formData.get("name"),
    employeeNumber: formData.get("employeeNumber"),
    email: String(formData.get("email") ?? ""),
    stationCode,
    isActive: boolFromForm(formData, "isActive"),
    hasAdminAccess: boolFromForm(formData, "hasAdminAccess"),
    hasOperationalPortalAccess: boolFromForm(formData, "hasOperationalPortalAccess"),
    receiveAlarmFollowUps: boolFromForm(formData, "receiveAlarmFollowUps"),
    alarmStations
  };
}

function duplicateWhere(userId: string | null, loginIdentifier: string, email: string | null) {
  return {
    ...(userId ? { id: { not: userId } } : {}),
    OR: [
      { employeeNumber: loginIdentifier },
      { loginIdentifier },
      ...(email ? [{ email }] : [])
    ]
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
    where: duplicateWhere(null, loginIdentifier, parsed.data.email),
    select: { id: true }
  });

  if (existing) {
    return { ok: false, message: "Medarbejdernummer, login eller mailadresse er allerede i brug." };
  }

  const user = await prisma.user.create({
    data: {
      name: parsed.data.name,
      role: UserRole.BRANDFIGHTER,
      employeeNumber: loginIdentifier,
      loginIdentifier,
      email: parsed.data.email,
      passwordHash: await hashPassword(parsed.data.temporaryPassword),
      isActive: parsed.data.isActive,
      mustChangePassword: true,
      stationCode: parsed.data.stationCode,
      alarmStations: parsed.data.alarmStations,
      receiveAlarmFollowUps: parsed.data.receiveAlarmFollowUps,
      hasAdminAccess: parsed.data.hasAdminAccess
    }
  });

  await setOperationalPortalGrant(user.id, parsed.data.hasOperationalPortalAccess);

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
  revalidatePath("/admin/brugere");
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
    where: duplicateWhere(parsed.data.userId, loginIdentifier, parsed.data.email),
    select: { id: true }
  });

  if (duplicate) {
    return { ok: false, message: "Medarbejdernummer, login eller mailadresse er allerede i brug." };
  }

  await prisma.user.update({
    where: { id: parsed.data.userId },
    data: {
      name: parsed.data.name,
      employeeNumber: loginIdentifier,
      loginIdentifier,
      email: parsed.data.email,
      isActive: parsed.data.isActive,
      stationCode: parsed.data.stationCode,
      alarmStations: parsed.data.alarmStations,
      receiveAlarmFollowUps: parsed.data.receiveAlarmFollowUps,
      hasAdminAccess: parsed.data.hasAdminAccess
    }
  });

  await setOperationalPortalGrant(parsed.data.userId, parsed.data.hasOperationalPortalAccess);

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
  revalidatePath("/admin/brugere");
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

  const passwordHash = await hashPassword(parsed.data.temporaryPassword);
  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, mustChangePassword: true }
    }),
    prisma.session.deleteMany({ where: { userId: user.id } }),
    prisma.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() }
    }),
    prisma.auditLog.create({
      data: {
        actorUserId: admin.id,
        actorRole: admin.role,
        action: "PASSWORD_RESET",
        targetUserId: user.id,
        description: `Adgangskoden blev nulstillet for ${user.name}`
      }
    })
  ]);

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
        name: ANONYMIZED_NAME,
        role: UserRole.BRANDFIGHTER,
        employeeNumber: null,
        loginIdentifier: "__deleted_user__",
        email: null,
        passwordHash: placeholderPassword,
        isActive: false,
        mustChangePassword: false,
        stationCode: null,
        alarmStations: [],
        receiveAlarmFollowUps: false,
        hasAdminAccess: false
      }
    });

    const transfers = await tx.shiftTransfer.findMany({
      where: { OR: [{ giverUserId: target.id }, { receiverUserId: target.id }] },
      select: { id: true }
    });
    const returns = await tx.returnRequest.findMany({
      where: {
        OR: [
          { createdByUserId: target.id },
          { originalUserId: target.id },
          { currentHolderUserId: target.id }
        ]
      },
      select: { id: true }
    });

    const transferIds = transfers.map((entry) => entry.id);
    const returnIds = returns.map((entry) => entry.id);
    if (transferIds.length > 0 || returnIds.length > 0) {
      await tx.notification.deleteMany({
        where: {
          OR: [
            ...(transferIds.length > 0 ? [{ shiftTransferId: { in: transferIds } }] : []),
            ...(returnIds.length > 0 ? [{ returnRequestId: { in: returnIds } }] : [])
          ]
        }
      });
    }

    await tx.shiftTransfer.updateMany({
      where: { giverUserId: target.id },
      data: {
        giverUserId: placeholder.id,
        giverNameSnapshot: ANONYMIZED_NAME,
        giverEmployeeNumberSnapshot: ANONYMIZED_EMPLOYEE_NUMBER
      }
    });
    await tx.shiftTransfer.updateMany({
      where: { receiverUserId: target.id },
      data: {
        receiverUserId: placeholder.id,
        receiverNameSnapshot: ANONYMIZED_NAME,
        receiverEmployeeNumberSnapshot: ANONYMIZED_EMPLOYEE_NUMBER
      }
    });
    await tx.shiftTransfer.updateMany({
      where: { activationConfirmedByUserId: target.id },
      data: { activationConfirmedByUserId: null }
    });
    await tx.shiftTransfer.updateMany({
      where: { returnExecutionConfirmedByUserId: target.id },
      data: { returnExecutionConfirmedByUserId: null }
    });
    await tx.shiftTransfer.updateMany({
      where: { cancelledByUserId: target.id },
      data: { cancelledByUserId: null }
    });

    await tx.returnRequest.updateMany({
      where: { createdByUserId: target.id },
      data: { createdByUserId: placeholder.id }
    });
    await tx.returnRequest.updateMany({
      where: { originalUserId: target.id },
      data: {
        originalUserId: placeholder.id,
        originalNameSnapshot: ANONYMIZED_NAME,
        originalEmployeeNumberSnapshot: ANONYMIZED_EMPLOYEE_NUMBER
      }
    });
    await tx.returnRequest.updateMany({
      where: { currentHolderUserId: target.id },
      data: {
        currentHolderUserId: placeholder.id,
        currentHolderNameSnapshot: ANONYMIZED_NAME,
        currentHolderEmployeeNumberSnapshot: ANONYMIZED_EMPLOYEE_NUMBER
      }
    });
    await tx.returnRequest.updateMany({
      where: { returnExecutionConfirmedByUserId: target.id },
      data: { returnExecutionConfirmedByUserId: null }
    });

    await tx.auditLog.updateMany({
      where: { OR: [{ actorUserId: target.id }, { targetUserId: target.id }] },
      data: { description: "Historisk hændelse vedrørende anonymiseret bruger" }
    });
    await tx.loginAttempt.deleteMany({
      where: {
        identifier: {
          in: Array.from(
            new Set([target.loginIdentifier, target.employeeNumber].filter((value): value is string => Boolean(value)))
          )
        }
      }
    });

    await tx.user.delete({ where: { id: target.id } });
    await tx.auditLog.create({
      data: {
        actorUserId: admin.id,
        actorRole: admin.role,
        action: "USER_DELETED",
        description: "En bruger blev slettet og personhenførbare snapshots blev anonymiseret"
      }
    });
  });

  revalidatePath("/admin");
  revalidatePath("/admin/brugere");
  revalidatePath("/vagtcentral");
  return { ok: true, message: "Brugeren er slettet og historiske personhenførbare felter er anonymiseret." };
}
