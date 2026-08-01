import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

const execFileAsync = promisify(execFile);
const MAX_BACKUP_SIZE = 100 * 1024 * 1024;

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || (user.role !== "ADMIN" && !user.hasAdminAccess)) {
    return NextResponse.json({ error: "Ingen adgang" }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get("backup");
  const confirmed = formData.get("confirmed") === "yes";

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Vælg en backupfil" }, { status: 400 });
  }
  if (!confirmed) {
    return NextResponse.json({ error: "Gendannelsen skal bekræftes" }, { status: 400 });
  }
  if (file.size <= 0 || file.size > MAX_BACKUP_SIZE) {
    return NextResponse.json({ error: "Backupfilen er tom eller større end 100 MB" }, { status: 400 });
  }

  const directory = process.env.BACKUP_DIRECTORY || "/data/backups";
  await mkdir(directory, { recursive: true });
  const temporaryPath = path.join(directory, `restore-upload-${randomUUID()}.vagtbackup.upload`);

  try {
    await writeFile(temporaryPath, Buffer.from(await file.arrayBuffer()), { mode: 0o600 });
    const script = path.join(process.cwd(), "scripts", "backup-cli.mjs");
    const { stdout } = await execFileAsync(
      process.execPath,
      [script, "restore", temporaryPath, user.id, user.role, user.name],
      {
        cwd: process.cwd(),
        timeout: 240000,
        maxBuffer: 2 * 1024 * 1024
      }
    );
    const result = parseLastJsonLine(stdout);
    return NextResponse.json({
      ok: true,
      message: result?.encrypted
        ? "Den krypterede backup er gendannet. Du skal logge ind igen."
        : "Den ældre ukrypterede backup er gendannet. Du skal logge ind igen.",
      result
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: `Gendannelsen fejlede: ${extractProcessError(error)}`
      },
      { status: 500 }
    );
  } finally {
    await rm(temporaryPath, { force: true }).catch(() => null);
  }
}

function parseLastJsonLine(value: string) {
  const lines = value.trim().split(/\r?\n/).filter(Boolean);
  const last = lines.at(-1);
  if (!last) return null;
  try {
    return JSON.parse(last) as { encrypted?: boolean };
  } catch {
    return null;
  }
}

function extractProcessError(error: unknown) {
  if (typeof error === "object" && error) {
    const processError = error as { stdout?: string; stderr?: string; message?: string };
    const structured = parseLastJsonLine(processError.stdout ?? "") as { error?: string } | null;
    if (structured?.error) return structured.error;
    const stderrLine = processError.stderr?.trim().split(/\r?\n/).filter(Boolean).at(-1);
    if (stderrLine) return stderrLine;
    if (processError.message) return processError.message;
  }
  return error instanceof Error ? error.message : "Ukendt fejl";
}
