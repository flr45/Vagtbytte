import { z } from "zod";
import { parseCopenhagenDateTimeLocal } from "./copenhagen-datetime";
import { normalizeLoginIdentifier } from "./login-identifiers";
import { passwordSchema } from "./passwords";

const expectedEndModeSchema = z.enum(["SPECIFIC_TIME", "UNTIL_SHIFT_END"], {
  required_error: "Vælg forventet tilbagelevering"
});

const copenhagenDateTimeLocalSchema = z
  .string({ required_error: "Tidspunkt skal udfyldes" })
  .transform((value, context) => {
    try {
      return parseCopenhagenDateTimeLocal(value);
    } catch (error) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: error instanceof Error ? error.message : "Tidspunkt skal udfyldes korrekt."
      });
      return z.NEVER;
    }
  });

export const loginSchema = z.object({
  identifier: z.string().trim().min(1, "Udfyld medarbejdernummer eller brugernavn"),
  password: z.string().min(1, "Udfyld adgangskode")
});

export const firefighterCreateSchema = z.object({
  name: z.string().trim().min(1, "Navn skal udfyldes"),
  employeeNumber: z.string().trim().min(1, "Medarbejdernummer skal udfyldes").transform(normalizeLoginIdentifier),
  temporaryPassword: passwordSchema,
  isActive: z.boolean()
});

export const firefighterUpdateSchema = z.object({
  userId: z.string().min(1),
  name: z.string().trim().min(1, "Navn skal udfyldes"),
  employeeNumber: z.string().trim().min(1, "Medarbejdernummer skal udfyldes").transform(normalizeLoginIdentifier),
  isActive: z.boolean()
});

export const passwordResetSchema = z.object({
  userId: z.string().min(1),
  temporaryPassword: passwordSchema
});

export const vcUpdateSchema = z.object({
  loginIdentifier: z.string().trim().min(1, "Brugernavn skal udfyldes").transform(normalizeLoginIdentifier),
  temporaryPassword: passwordSchema.optional().or(z.literal("")),
  isActive: z.boolean()
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Indtast den nuværende adgangskode"),
  newPassword: passwordSchema
});

const transferBaseSchema = z
  .object({
    giverEmployeeNumber: z.string().trim().min(1, "Medarbejdernummer A skal udfyldes"),
    receiverEmployeeNumber: z.string().trim().min(1, "Medarbejdernummer B skal udfyldes"),
    requestedStartAt: copenhagenDateTimeLocalSchema,
    expectedEndMode: expectedEndModeSchema,
    expectedEndAt: z
      .union([copenhagenDateTimeLocalSchema, z.literal("")])
      .optional()
      .transform((value) => (value === "" || value === undefined ? null : value)),
    comment: z.string().trim().max(500, "Kommentaren må højst være 500 tegn").optional()
  })
  .refine((data) => data.expectedEndMode !== "SPECIFIC_TIME" || Boolean(data.expectedEndAt), {
    message: "Forventet tilbageleveringstidspunkt skal udfyldes.",
    path: ["expectedEndAt"]
  })
  .refine((data) => data.expectedEndMode !== "UNTIL_SHIFT_END" || data.expectedEndAt === null, {
    message: "Til vagtens slutning må ikke have dato eller klokkeslæt.",
    path: ["expectedEndAt"]
  })
  .refine((data) => !data.expectedEndAt || data.expectedEndAt > data.requestedStartAt, {
    message: "Forventet tilbageleveringstidspunkt skal ligge efter starttidspunktet.",
    path: ["expectedEndAt"]
  });

export const transferCreateSchema = transferBaseSchema
  .and(z.object({ confirmed: z.boolean() }))
  .refine((data) => data.confirmed, {
    message: "Du skal bekræfte, at oplysningerne er korrekte.",
    path: ["confirmed"]
  });

export const transferLookupSchema = transferBaseSchema;

export const transferResponseSchema = z.object({
  transferId: z.string().min(1),
  responseComment: z.string().trim().max(500, "Begrundelsen må højst være 500 tegn").optional()
});

export const vcTransferDecisionSchema = z.object({
  transferId: z.string().min(1),
  comment: z.string().trim().max(500, "Kommentaren må højst være 500 tegn").optional()
});

export const vcTransferRejectSchema = vcTransferDecisionSchema.refine(
  (data) => Boolean(data.comment && data.comment.length > 0),
  {
    message: "Vagtcentralen skal skrive en begrundelse ved afvisning.",
    path: ["comment"]
  }
);

export const returnRequestCreateSchema = z.object({
  transferId: z.string().min(1),
  requestedReturnAt: copenhagenDateTimeLocalSchema,
  comment: z.string().trim().max(500, "Kommentaren må højst være 500 tegn").optional()
});

export const returnRequestResponseSchema = z.object({
  returnRequestId: z.string().min(1),
  responseComment: z.string().trim().max(500, "Kommentaren må højst være 500 tegn").optional()
});

export const vcReturnDecisionSchema = z.object({
  returnRequestId: z.string().min(1),
  comment: z.string().trim().max(500, "Kommentaren må højst være 500 tegn").optional()
});

export const vcReturnRejectSchema = vcReturnDecisionSchema.refine(
  (data) => Boolean(data.comment && data.comment.length > 0),
  {
    message: "Vagtcentralen skal skrive en begrundelse ved afvisning.",
    path: ["comment"]
  }
);

export const vcTransferActivationSchema = z.object({
  transferId: z.string().min(1)
});

export const vcReturnExecutionSchema = z.object({
  returnRequestId: z.string().min(1)
});

export const transferCancelSchema = z.object({
  transferId: z.string().min(1),
  cancellationReason: z.string().trim().max(500, "Begrundelsen må højst være 500 tegn").optional()
});

export const notificationIdSchema = z.object({
  notificationId: z.string().min(1)
});

export const pushSubscriptionSchema = z.object({
  endpoint: z.string().url("Push-endpoint er ugyldigt"),
  p256dh: z.string().min(8, "Push-nøgle mangler"),
  auth: z.string().min(8, "Push-auth mangler"),
  userAgent: z.string().trim().max(300).optional(),
  deviceName: z.string().trim().max(80).optional()
});

export const pushSubscriptionIdSchema = z.object({
  subscriptionId: z.string().min(1)
});
