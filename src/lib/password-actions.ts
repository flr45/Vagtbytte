"use server";

import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getIpAddress, requirePasswordChangeUser, roleHome } from "./auth";
import { normalizeLoginIdentifier } from "./login-identifiers";
import {
  buildPasswordResetUrl,
  createPasswordResetToken,
  hashPasswordResetToken,
  passwordResetTokenIsUsable
} from "./password-reset-core";
import { hashPassword, passwordSchema, verifyPassword } from "./passwords";
import { prisma } from "./prisma";

const execFileAsync = promisify(execFile);
const GENERIC_REQUEST_MESSAGE =
  "Hvis oplysningerne matcher en aktiv bruger med en registreret mailadresse, sender vi et nulstillingslink.";

export type PasswordActionState = {
  ok?: boolean;
  message?: string;
};

const newPasswordSchema = z
  .object({
    newPassword: passwordSchema,
    confirmPassword: z.string().min(1, "Gentag den nye adgangskode")
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Adgangskoderne er ikke ens",
    path: ["confirmPassword"]
  });

const requiredPasswordChangeSchema = newPasswordSchema.extend({
  currentPassword: z.string().min(1, "Indtast den nuværende adgangskode")
});

const requestSchema = z.object({
  identifier: z.string().trim().min(1, "Udfyld medarbejdernummer, brugernavn eller mailadresse").max(200)
});

const resetSchema = newPasswordSchema.extend({
  token: z.string().trim().min(32, "Nulstillingslinket er ugyldigt")
});

function firstError(error: z.ZodError) {
  return error.issues[0]?.message ?? "Formularen er ikke udfyldt korrekt.";
}

export async function changeRequiredPasswordAction(
  _state: PasswordActionState,
  formData: FormData
): Promise<PasswordActionState> {
  const user = await requirePasswordChangeUser();
  const parsed = requiredPasswordChangeSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword")
  });

  if (!parsed.success) {
    return { ok: false, message: firstError(parsed.error) };
  }

  if (!(await verifyPassword(parsed.data.currentPassword, user.passwordHash))) {
    return { ok: false, message: "Den nuværende adgangskode er forkert." };
  }

  if (await verifyPassword(parsed.data.newPassword, user.passwordHash)) {
    return { ok: false, message: "Den nye adgangskode skal være forskellig fra den nuværende." };
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await hashPassword(parsed.data.newPassword),
        mustChangePassword: false
      }
    }),
    prisma.auditLog.create({
      data: {
        actorUserId: user.id,
        actorRole: user.role,
        action: "PASSWORD_CHANGED",
        targetUserId: user.id,
        description: "Brugeren valgte en ny adgangskode"
      }
    })
  ]);

  redirect(roleHome[user.role]);
}

export async function requestPasswordResetAction(
  _state: PasswordActionState,
  formData: FormData
): Promise<PasswordActionState> {
  const parsed = requestSchema.safeParse({ identifier: formData.get("identifier") });
  if (!parsed.success) {
    return { ok: false, message: firstError(parsed.error) };
  }

  const input = parsed.data.identifier;
  const loginIdentifier = normalizeLoginIdentifier(input);
  const email = input.toLowerCase();
  const user = await prisma.user.findFirst({
    where: {
      isActive: true,
      loginIdentifier: { not: "__deleted_user__" },
      OR: [
        { loginIdentifier },
        { employeeNumber: loginIdentifier },
        { email }
      ]
    },
    select: { id: true, name: true, email: true, role: true }
  });

  if (!user?.email || !process.env.SMTP_HOST || !process.env.SMTP_FROM) {
    return { ok: true, message: GENERIC_REQUEST_MESSAGE };
  }

  const now = new Date();
  const recentRequests = await prisma.passwordResetToken.count({
    where: {
      userId: user.id,
      createdAt: { gte: new Date(now.getTime() - 30 * 60 * 1000) }
    }
  });

  if (recentRequests >= 3) {
    return { ok: true, message: GENERIC_REQUEST_MESSAGE };
  }

  const token = createPasswordResetToken(now);
  const ipAddress = await getIpAddress();
  const stored = await prisma.$transaction(async (tx) => {
    await tx.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: now }
    });
    const created = await tx.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: token.tokenHash,
        expiresAt: token.expiresAt,
        requestedIp: ipAddress ?? null
      }
    });
    await tx.auditLog.create({
      data: {
        actorUserId: user.id,
        actorRole: user.role,
        action: "PASSWORD_RESET_REQUESTED",
        targetUserId: user.id,
        description: "Der blev anmodet om et nulstillingslink"
      }
    });
    return created;
  });

  try {
    const script = path.join(process.cwd(), "scripts", "password-reset-email-cli.mjs");
    await execFileAsync(
      process.execPath,
      [script, user.email, user.name, buildPasswordResetUrl(token.rawToken)],
      {
        cwd: process.cwd(),
        timeout: 60000,
        maxBuffer: 1024 * 1024
      }
    );
  } catch (error) {
    await prisma.$transaction([
      prisma.passwordResetToken.update({
        where: { id: stored.id },
        data: { usedAt: new Date() }
      }),
      prisma.auditLog.create({
        data: {
          actorUserId: user.id,
          actorRole: user.role,
          action: "PASSWORD_RESET_EMAIL_FAILED",
          targetUserId: user.id,
          description: `Nulstillingsmailen kunne ikke sendes: ${error instanceof Error ? error.message.slice(0, 300) : "ukendt fejl"}`
        }
      })
    ]);
    console.error("PASSWORD_RESET_EMAIL_FAILED", error);
  }

  return { ok: true, message: GENERIC_REQUEST_MESSAGE };
}

export async function resetForgottenPasswordAction(
  _state: PasswordActionState,
  formData: FormData
): Promise<PasswordActionState> {
  const parsed = resetSchema.safeParse({
    token: formData.get("token"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword")
  });

  if (!parsed.success) {
    return { ok: false, message: firstError(parsed.error) };
  }

  const now = new Date();
  const tokenHash = hashPasswordResetToken(parsed.data.token);
  const resetToken = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    include: { user: true }
  });

  if (!resetToken || !resetToken.user.isActive || !passwordResetTokenIsUsable(resetToken, now)) {
    return {
      ok: false,
      message: "Nulstillingslinket er udløbet eller allerede brugt. Bestil et nyt link."
    };
  }

  const passwordHash = await hashPassword(parsed.data.newPassword);

  try {
    await prisma.$transaction(async (tx) => {
      const claimed = await tx.passwordResetToken.updateMany({
        where: {
          id: resetToken.id,
          usedAt: null,
          expiresAt: { gte: now }
        },
        data: { usedAt: now }
      });
      if (claimed.count !== 1) {
        throw new Error("RESET_TOKEN_ALREADY_USED");
      }

      await tx.user.update({
        where: { id: resetToken.userId },
        data: { passwordHash, mustChangePassword: false }
      });
      await tx.passwordResetToken.updateMany({
        where: { userId: resetToken.userId, usedAt: null },
        data: { usedAt: now }
      });
      await tx.session.deleteMany({ where: { userId: resetToken.userId } });
      await tx.auditLog.create({
        data: {
          actorUserId: resetToken.userId,
          actorRole: resetToken.user.role,
          action: "PASSWORD_RESET_COMPLETED",
          targetUserId: resetToken.userId,
          description: "Brugeren nulstillede sin adgangskode via mail"
        }
      });
    });
  } catch {
    return {
      ok: false,
      message: "Nulstillingslinket er udløbet eller allerede brugt. Bestil et nyt link."
    };
  }

  redirect("/login?reset=1");
}
