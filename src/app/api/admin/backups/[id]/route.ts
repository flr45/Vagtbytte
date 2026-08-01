import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user || (user.role !== "ADMIN" && !user.hasAdminAccess)) {
    return NextResponse.json({ error: "Ingen adgang" }, { status: 403 });
  }

  const { id } = await context.params;
  const backup = await prisma.backupSnapshot.findUnique({ where: { id } });
  if (!backup || backup.status !== "READY") {
    return NextResponse.json({ error: "Backupfilen blev ikke fundet" }, { status: 404 });
  }

  if (backup.fileName !== backup.fileName.split(/[\\/]/).at(-1) || !backup.fileName.endsWith(".vagtbackup.gz")) {
    return NextResponse.json({ error: "Ugyldigt backupfilnavn" }, { status: 400 });
  }

  try {
    const directory = process.env.BACKUP_DIRECTORY || "/data/backups";
    const file = await readFile(`${directory}/${backup.fileName}`);
    return new NextResponse(file, {
      status: 200,
      headers: {
        "Content-Type": "application/gzip",
        "Content-Disposition": `attachment; filename="${backup.fileName}"`,
        "Content-Length": String(file.byteLength),
        "Cache-Control": "no-store"
      }
    });
  } catch {
    return NextResponse.json({ error: "Backupfilen findes ikke på disken" }, { status: 404 });
  }
}
