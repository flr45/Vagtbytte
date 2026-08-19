import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const execFileAsync = promisify(execFile);

type RouteProps = {
  params: Promise<{ backupId: string }>;
};

export async function POST(_request: Request, { params }: RouteProps) {
  const user = await getCurrentUser();
  if (!user || (user.role !== "ADMIN" && !user.hasAdminAccess)) {
    return NextResponse.json({ error: "Ingen adgang" }, { status: user ? 403 : 401 });
  }

  const { backupId } = await params;
  if (!backupId || backupId.length > 128) {
    return NextResponse.json({ error: "Backupen er ugyldig." }, { status: 400 });
  }

  const backup = await prisma.backupSnapshot.findUnique({ where: { id: backupId } });
  if (!backup || backup.status !== "READY") {
    return NextResponse.json({ error: "Backupen blev ikke fundet eller er ikke klar." }, { status: 404 });
  }
  if (
    path.basename(backup.fileName) !== backup.fileName ||
    (!backup.fileName.endsWith(".vagtbackup.enc") && !backup.fileName.endsWith(".vagtbackup.gz"))
  ) {
    return NextResponse.json({ error: "Backupens filreference er ugyldig." }, { status: 400 });
  }

  const directory = process.env.BACKUP_DIRECTORY || "/data/backups";
  const filePath = path.join(directory, backup.fileName);
  const script = path.join(process.cwd(), "scripts", "backup-cli.mjs");

  try {
    const { stdout } = await execFileAsync(
      process.execPath,
      [script, "restore", filePath, user.id, user.role, user.name, backup.sha256 ?? ""],
      {
        cwd: process.cwd(),
        timeout: 10 * 60 * 1000,
        maxBuffer: 2 * 1024 * 1024
      }
    );
    const result = parseLastJsonLine(stdout);
    return NextResponse.json({
      ok: true,
      message: result?.operationalPortalIncluded
        ? "Backupen er gendannet inklusive Operativ Portal og filer. Du skal logge ind igen."
        : "Den ældre backup er gendannet. Operativ Portal blev ikke ændret, fordi backupformatet ikke indeholder operative filer. Du skal logge ind igen.",
      result
    });
  } catch (error) {
    return NextResponse.json(
      { error: `Gendannelsen fejlede: ${extractProcessError(error)}` },
      { status: 500 }
    );
  }
}

function parseLastJsonLine(value: string) {
  const lines = value.trim().split(/\r?\n/).filter(Boolean);
  const last = lines.at(-1);
  if (!last) return null;
  try {
    return JSON.parse(last) as { operationalPortalIncluded?: boolean };
  } catch {
    return null;
  }
}

function extractProcessError(error: unknown) {
  if (typeof error === "object" && error) {
    const processError = error as { stdout?: string; stderr?: string; message?: string };
    const stdoutLine = processError.stdout?.trim().split(/\r?\n/).filter(Boolean).at(-1);
    if (stdoutLine) {
      try {
        const parsed = JSON.parse(stdoutLine) as { error?: string };
        if (parsed.error) return parsed.error;
      } catch {
        // Brug stderr/message nedenfor.
      }
    }
    const stderrLine = processError.stderr?.trim().split(/\r?\n/).filter(Boolean).at(-1);
    if (stderrLine) return stderrLine;
    if (processError.message) return processError.message;
  }
  return error instanceof Error ? error.message : "Ukendt fejl";
}
