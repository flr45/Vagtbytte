import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import {
  ALLOWED_OPERATIONAL_DOCUMENT_TYPES,
  MAX_OPERATIONAL_DOCUMENT_BYTES,
  OPERATIONAL_DOCUMENT_DIRECTORY,
  safeOriginalFileName
} from "@/lib/operativ-portal";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAdmin(user: Awaited<ReturnType<typeof getCurrentUser>>) {
  return Boolean(user && (user.role === UserRole.ADMIN || user.hasAdminAccess));
}

export async function POST(request: Request) {
  const admin = await getCurrentUser();
  if (!isAdmin(admin)) {
    return NextResponse.json({ error: "Kun administratorer har adgang." }, { status: admin ? 403 : 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const title = String(formData.get("title") ?? "").trim();
  const vehicleValue = String(formData.get("vehicleId") ?? "").trim();
  const vehicleId = /^[0-9a-f-]{36}$/i.test(vehicleValue) ? vehicleValue : null;

  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Vælg en fil." }, { status: 400 });
  }
  if (!title || title.length > 180) {
    return NextResponse.json({ error: "Dokumentets titel mangler eller er for lang." }, { status: 400 });
  }
  if (file.size > MAX_OPERATIONAL_DOCUMENT_BYTES) {
    return NextResponse.json({ error: "Filen må højst fylde 25 MB." }, { status: 413 });
  }
  if (!ALLOWED_OPERATIONAL_DOCUMENT_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: "Filtypen er ikke tilladt. Brug PDF, Word, Excel, JPG, PNG eller WebP." },
      { status: 415 }
    );
  }

  if (vehicleId) {
    const vehicles = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM operational_vehicle WHERE id = ${vehicleId}
    `;
    if (!vehicles[0]) {
      return NextResponse.json({ error: "Køretøjet blev ikke fundet." }, { status: 404 });
    }
  }

  const documentId = randomUUID();
  const originalName = safeOriginalFileName(file.name);
  const extension = path.extname(originalName).toLowerCase().slice(0, 12);
  const storageName = `${randomUUID()}${extension}`;
  await mkdir(OPERATIONAL_DOCUMENT_DIRECTORY, { recursive: true });
  await writeFile(path.join(OPERATIONAL_DOCUMENT_DIRECTORY, storageName), Buffer.from(await file.arrayBuffer()), {
    flag: "wx"
  });

  try {
    await prisma.$executeRaw`
      INSERT INTO operational_document
        (id, vehicle_id, title, original_name, storage_name, mime_type, size_bytes)
      VALUES
        (${documentId}, ${vehicleId}, ${title}, ${originalName}, ${storageName}, ${file.type}, ${file.size})
    `;
    await prisma.auditLog.create({
      data: {
        actorUserId: admin!.id,
        actorRole: admin!.role,
        action: "OPERATIONAL_DOCUMENT_CREATED",
        description: `Dokumentet ${title} blev uploadet til Operativ Portal`
      }
    });
  } catch (error) {
    const { unlink } = await import("node:fs/promises");
    await unlink(path.join(OPERATIONAL_DOCUMENT_DIRECTORY, storageName)).catch(() => undefined);
    throw error;
  }

  return NextResponse.json({ ok: true, documentId }, { status: 201 });
}
