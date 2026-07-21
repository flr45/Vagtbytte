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

const transferBaseSchema = z
  .object({
    giverEmployeeNumber: z.string().trim().min(1, "Medarbejdernummer A skal udfyldes"),
    receiverEmployeeNumber: z.string().trim().min(1, "Medarbejdernummer B skal udfyldes"),
    requestedStartAt: z.coerce.date({ invalid_type_error: "Starttidspunkt skal udfyldes" }),
    expectedEndAt: z
      .union([z.coerce.date(), z.literal("")])
      .optional()
      .transform((value) => (value === "" || value === undefined ? null : value)),
    comment: z.string().trim().max(500, "Kommentaren må højst være 500 tegn").optional()
  })
  .refine((data) => !data.expectedEndAt || data.expectedEndAt > data.requestedStartAt, {
    message: "Forventet sluttid skal ligge efter starttidspunktet.",
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
  requestedReturnAt: z.coerce.date({ invalid_type_error: "Ønsket tilbageleveringstidspunkt skal udfyldes" }),
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
