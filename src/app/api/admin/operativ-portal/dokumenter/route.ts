import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import {
  OPERATIONAL_DOCUMENT_CATEGORIES,
  resolveOperationalTargets
} from "@/lib/operativ-portal-content";
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

function optionalUuid(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  if (!value) return null;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
    ? value
    : undefined;
}

export async function POST(request: Request) {
  const admin = await getCurrentUser();
  if (!isAdmin(admin)) {
    return NextResponse.json({ error: "Kun administratorer har adgang." }, { status: admin ? 403 : 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const category = String(formData.get("category") ?? "Instruks").trim();
  const vehicleId = optionalUuid(formData, "vehicleId");
  const placeId = optionalUuid(formData, "placeId");
  const itemId = optionalUuid(formData, "itemId");

  if (vehicleId === undefined || placeId === undefined || itemId === undefined) {
    return NextResponse.json({ error: "Den valgte tilknytning er ugyldig." }, { status: 400 });
  }
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Vælg en fil." }, { status: 400 });
  }
  if (!title || title.length > 180) {
    return NextResponse.json({ error: "Dokumentets titel mangler eller er for lang." }, { status: 400 });
  }
  if (description.length > 3000) {
    return NextResponse.json({ error: "Beskrivelsen må højst være 3000 tegn." }, { status: 400 });
  }
  if (!OPERATIONAL_DOCUMENT_CATEGORIES.includes(category as (typeof OPERATIONAL_DOCUMENT_CATEGORIES)[number])) {
    return NextResponse.json({ error: "Dokumentkategorien er ugyldig." }, { status: 400 });
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

  const targets = await resolveOperationalTargets({ vehicleId, placeId, itemId });
  if (!targets) {
    return NextResponse.json({ error: "Det valgte køretøj, rum eller udstyr blev ikke fundet." }, { status: 404 });
  }

  const documentId = randomUUID();
  const originalName = safeOriginalFileName(file.name);
  const extension = path.extname(originalName).toLowerCase().slice(0, 12);
  const storageName = `${randomUUID()}${extension}`;
  const filePath = path.join(OPERATIONAL_DOCUMENT_DIRECTORY, storageName);

  await mkdir(OPERATIONAL_DOCUMENT_DIRECTORY, { recursive: true });
  await writeFile(filePath, Buffer.from(await file.arrayBuffer()), { flag: "wx" });

  try {
    await prisma.$executeRaw`
      INSERT INTO operational_document
        (id, vehicle_id, place_id, item_id, title, description, category,
         original_name, storage_name, mime_type, size_bytes)
      VALUES
        (${documentId}, ${targets.vehicleId}, ${targets.placeId}, ${targets.itemId},
         ${title}, ${description}, ${category}, ${originalName}, ${storageName}, ${file.type}, ${file.size})
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
    await unlink(filePath).catch(() => undefined);
    throw error;
  }

  return NextResponse.json({ ok: true, documentId }, { status: 201 });
}
