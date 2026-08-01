"use server";

import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { revalidatePath } from "next/cache";
import { UserRole } from "@prisma/client";
import { requireRole } from "./auth";

const execFileAsync = promisify(execFile);

export type BackupActionState = {
  ok?: boolean;
  message?: string;
};

export async function createManualBackupAction(
  _state: BackupActionState,
  _formData: FormData
): Promise<BackupActionState> {
  const admin = await requireRole(UserRole.ADMIN);

  try {
    const script = path.join(process.cwd(), "scripts", "backup-cli.mjs");
    const { stdout } = await execFileAsync(
      process.execPath,
      [script, "create", "manual", admin.id, admin.role],
      {
        cwd: process.cwd(),
        timeout: 180000,
        maxBuffer: 1024 * 1024
      }
    );
    const result = parseLastJsonLine(stdout);
    if (result?.error) {
      return { ok: false, message: `Backup fejlede: ${result.error}` };
    }

    revalidatePath("/admin/backups");
    return { ok: true, message: "Den manuelle backup er oprettet." };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? `Backup fejlede: ${error.message}` : "Backup fejlede."
    };
  }
}

function parseLastJsonLine(value: string) {
  const lines = value.trim().split(/\r?\n/).filter(Boolean);
  const last = lines.at(-1);
  if (!last) return null;
  try {
    return JSON.parse(last) as { error?: string };
  } catch {
    return null;
  }
}
