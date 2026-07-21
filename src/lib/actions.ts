"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { UserRole } from "@prisma/client";
import { prisma } from "./prisma";
import { hashPassword, verifyPassword } from "./passwords";
import {
  changePasswordSchema,
  firefighterCreateSchema,
  firefighterUpdateSchema,
  loginSchema,
  passwordResetSchema,
  vcUpdateSchema
} from "./validation";
import { requirePasswordChangeUser, requireRole, roleHome, signIn, signOut } from "./auth";

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
