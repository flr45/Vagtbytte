import bcrypt from "bcryptjs";
import { z } from "zod";
import { PASSWORD_REQUIREMENTS } from "./password-policy";

export const passwordSchema = PASSWORD_REQUIREMENTS.reduce(
  (schema, requirement) => schema.refine(requirement.test, requirement.label),
  z.string()
);

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}
