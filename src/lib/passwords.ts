import bcrypt from "bcryptjs";
import { z } from "zod";

export const passwordSchema = z
  .string()
  .min(10, "Adgangskoden skal være mindst 10 tegn")
  .regex(/[A-ZÆØÅ]/, "Adgangskoden skal indeholde et stort bogstav")
  .regex(/[a-zæøå]/, "Adgangskoden skal indeholde et lille bogstav")
  .regex(/[0-9]/, "Adgangskoden skal indeholde et tal");

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}
