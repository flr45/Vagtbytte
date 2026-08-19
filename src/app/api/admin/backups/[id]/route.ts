import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user || (user.role !== "ADMIN" && !user.hasAdminAccess)) {
    return NextResponse.json({ error: "Ingen adgang" }, { status: user ? 403 : 401 });
  }

  const { id } = await context.params;
  const backup = await prisma.backupSnapshot.findUnique({ where: { id } });
  if (!backup || backup.status !== "READY") {
    return NextResponse.json({ error: "Backupfilen blev ikke fundet" }, { status: 404 });
  }

  const validExtension =
    backup.fileName.endsWith(".vagtbackup.enc") || backup.fileName.endsWith(".vagtbackup.gz");
  if (path.basename(backup.fileName) !== backup.fileName || !validExtension) {
    return NextResponse.json({ error: "Ugyldigt backupfilnavn" }, { status: 400 });
  }

  try {
    const directory = process.env.BACKUP_DIRECTORY || "/data/backups";
    const filePath = path.join(directory, backup.fileName);
    const fileStats = await stat(filePath);
    if (!fileStats.isFile()) throw new Error("Ikke en fil");

    const nodeStream = createReadStream(filePath);
    const webStream = Readable.toWeb(nodeStream);
    return new Response(webStream as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": backup.fileName.endsWith(".enc") ? "application/octet-stream" : "application/gzip",
        "Content-Disposition": `attachment; filename="${backup.fileName}"`,
        "Content-Length": String(fileStats.size),
        "Cache-Control": "private, no-store, max-age=0",
        Pragma: "no-cache",
        "X-Content-Type-Options": "nosniff"
      }
    });
  } catch {
    return NextResponse.json({ error: "Backupfilen findes ikke på disken" }, { status: 404 });
  }
}
