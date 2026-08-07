"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "./auth";
import { hashPassword, passwordSchema, verifyPassword } from "./passwords";
import { prisma } from "./prisma";

export type ProfileActionState = {
  ok?: boolean;
  message?: string;
};

const profileSchema = z.object({
  name: z.string().trim().min(2, "Navnet skal være mindst 2 tegn").max(120, "Navnet er for langt"),
  email: z
    .string()
    .trim()
    .max(200, "Mailadressen er for lang")
    .refine((value) => value === "" || z.string().email().safeParse(value).success, "Mailadressen er ugyldig")
});

const passwordChangeSchema = z
  .object({
    currentPassword: z.string().min(1, "Indtast din nuværende adgangskode"),
    newPassword: passwordSchema,
    confirmPassword: z.string().min(1, "Gentag den nye adgangskode")
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "De nye adgangskoder er ikke ens",
    path: ["confirmPassword"]
  });

function firstError(error: z.ZodError) {
  return error.issues[0]?.message ?? "Oplysningerne kunne ikke gemmes.";
}

export async function updateOwnProfileAction(
  _state: ProfileActionState,
  formData: FormData
): Promise<ProfileActionState> {
  const user = await requireUser();
  const parsed = profileSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email")
  });

  if (!parsed.success) return { ok: false, message: firstError(parsed.error) };

  const email = parsed.data.email ? parsed.data.email.toLowerCase() : null;
  if (email) {
    const duplicate = await prisma.user.findFirst({
      where: { id: { not: user.id }, email },
      select: { id: true }
    });
    if (duplicate) return { ok: false, message: "Mailadressen bruges allerede af en anden bruger." };
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { name: parsed.data.name, email }
    }),
    prisma.auditLog.create({
      data: {
        actorUserId: user.id,
        actorRole: user.role,
        action: "PROFILE_UPDATED",
        targetUserId: user.id,
        description: "Brugeren opdaterede navn eller mailadresse"
      }
    })
  ]);

  revalidatePath("/app");
  revalidatePath("/app/mere");
  revalidatePath("/app/profil");
  return { ok: true, message: "Dine oplysninger er gemt." };
}

export async function changeOwnPasswordAction(
  _state: ProfileActionState,
  formData: FormData
): Promise<ProfileActionState> {
  const user = await requireUser();
  const parsed = passwordChangeSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword")
  });

  if (!parsed.success) return { ok: false, message: firstError(parsed.error) };
  if (!(await verifyPassword(parsed.data.currentPassword, user.passwordHash))) {
    return { ok: false, message: "Den nuværende adgangskode er forkert." };
  }
  if (await verifyPassword(parsed.data.newPassword, user.passwordHash)) {
    return { ok: false, message: "Den nye adgangskode skal være forskellig fra den nuværende." };
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(parsed.data.newPassword), mustChangePassword: false }
    }),
    prisma.auditLog.create({
      data: {
        actorUserId: user.id,
        actorRole: user.role,
        action: "PASSWORD_CHANGED",
        targetUserId: user.id,
        description: "Brugeren skiftede adgangskode fra profilsiden"
      }
    })
  ]);

  return { ok: true, message: "Din adgangskode er ændret." };
}
