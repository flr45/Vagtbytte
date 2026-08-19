"use server";

import { redirect } from "next/navigation";
import { loginSchema } from "./validation";
import {
  beginMfaAwareLogin,
  completeMfaSetup,
  completeMfaVerification
} from "./mfa-auth";

export type MfaActionState = {
  ok?: boolean;
  message?: string;
};

function firstIssue(error: { issues?: Array<{ message: string }> }) {
  return error.issues?.[0]?.message ?? "Formularen er ikke udfyldt korrekt.";
}

export async function mfaLoginAction(
  _state: MfaActionState,
  formData: FormData
): Promise<MfaActionState> {
  const parsed = loginSchema.safeParse({
    identifier: formData.get("identifier"),
    password: formData.get("password")
  });

  if (!parsed.success) {
    return { ok: false, message: firstIssue(parsed.error) };
  }

  const result = await beginMfaAwareLogin(parsed.data.identifier, parsed.data.password);
  if (!result.ok) {
    return { ok: false, message: result.message };
  }

  redirect(result.redirectTo);
}

export async function verifyMfaAction(
  _state: MfaActionState,
  formData: FormData
): Promise<MfaActionState> {
  const code = String(formData.get("code") ?? "").trim();
  if (!code) {
    return { ok: false, message: "Indtast koden fra din authenticator-app eller en recovery-kode." };
  }
  if (code.length > 64) {
    return { ok: false, message: "MFA-koden er ugyldig." };
  }

  const result = await completeMfaVerification(code);
  if (!result.ok) {
    return { ok: false, message: result.message };
  }

  redirect(result.redirectTo);
}

export async function setupMfaAction(
  _state: MfaActionState,
  formData: FormData
): Promise<MfaActionState> {
  const code = String(formData.get("code") ?? "").trim();
  if (!/^\d{6}$/.test(code)) {
    return { ok: false, message: "Indtast den sekscifrede kode fra din authenticator-app." };
  }

  const result = await completeMfaSetup(code);
  if (!result.ok) {
    return { ok: false, message: result.message };
  }

  redirect(result.redirectTo);
}
