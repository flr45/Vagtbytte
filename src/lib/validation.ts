import { z } from "zod";
import { passwordSchema } from "./passwords";

export const loginSchema = z.object({
  identifier: z.string().trim().min(1, "Udfyld medarbejdernummer eller brugernavn"),
  password: z.string().min(1, "Udfyld adgangskode")
});

export const firefighterCreateSchema = z.object({
  name: z.string().trim().min(1, "Navn skal udfyldes"),
  employeeNumber: z.string().trim().min(1, "Medarbejdernummer skal udfyldes"),
  temporaryPassword: passwordSchema,
  isActive: z.boolean()
});

export const firefighterUpdateSchema = z.object({
  userId: z.string().min(1),
  name: z.string().trim().min(1, "Navn skal udfyldes"),
  employeeNumber: z.string().trim().min(1, "Medarbejdernummer skal udfyldes"),
  isActive: z.boolean()
});

export const passwordResetSchema = z.object({
  userId: z.string().min(1),
  temporaryPassword: passwordSchema
});

export const vcUpdateSchema = z.object({
  loginIdentifier: z.string().trim().min(1, "Brugernavn skal udfyldes"),
  temporaryPassword: passwordSchema.optional().or(z.literal("")),
  isActive: z.boolean()
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Indtast den nuværende adgangskode"),
  newPassword: passwordSchema
});
