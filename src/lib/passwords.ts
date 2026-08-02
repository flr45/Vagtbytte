import bcrypt from "bcryptjs";
import { z } from "zod";
import { PASSWORD_REQUIREMENTS } from "./password-policy";

export const passwordSchema = z.string().superRefine((value, context) => {
  for (const requirement of PASSWORD_REQUIREMENTS) {
    if (!requirement.test(value)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: requirement.label
      });
    }
  }
});

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}
