import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { resolveOperationalTargets } from "@/lib/operativ-portal-content";
import {
  ALLOWED_OPERATIONAL_IMAGE_TYPES,
  MAX_OPERATIONAL_IMAGE_BYTES,
  OPERATIONAL_IMAGE_DIRECTORY,
  imageExtensionForMimeType,
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
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value) ? value : undefined;
}

async function hasTargetImage(targets: { vehicleId: string | null; placeId: string | null; itemId: string | null }) {
  if (targets.itemId) {
    const rows = await prisma.$queryRaw<Array<{ exists: boolean }>>`SELECT EXISTS(SELECT 1 FROM operational_image WHERE item_id = ${targets.itemId}) AS exists`;
    return rows[0]?.exists ?? false;
  }
  if (targets.placeId) {
    const rows = await prisma.$queryRaw<Array<{ exists: boolean }>>`SELECT EXISTS(SELECT 1 FROM operational_image WHERE place_id = ${targets.placeId} AND item_id IS NULL) AS exists`;
    return rows[0]?.exists ?? false;
  }
  const rows = await prisma.$queryRaw<Array<{ exists: boolean }>>`SELECT EXISTS(SELECT 1 FROM operational_image WHERE vehicle_id = ${targets.vehicleId} AND place_id IS NULL AND item_id IS NULL) AS exists`;
  return rows[0]?.exists ?? false;
}

export async function POST(request: Request) {
  const admin = await getCurrentUser();
  if (!isAdmin(admin)) return NextResponse.json({ error: "Kun administratorer har adgang." }, { status: admin ? 403 : 401 });

  const formData = await request.formData();
  const file = formData.get("file");
  const vehicleId = optionalUuid(formData, "vehicleId");
  const placeId = optionalUuid(formData, "placeId");
  const itemId = optionalUuid(formData, "itemId");
  const requestedCover = String(formData.get("isCover") ?? "") === "true";
  const suppliedTitle = String(formData.get("title") ?? "").trim();
  const suppliedAltText = String(formData.get("altText") ?? "").trim();

  if (vehicleId === undefined || placeId === undefined || itemId === undefined || !vehicleId) return NextResponse.json({ error: "Den valgte placering er ugyldig." }, { status: 400 });
  if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: "Vælg et billede." }, { status: 400 });
  if (file.size > MAX_OPERATIONAL_IMAGE_BYTES) return NextResponse.json({ error: "Billedet må højst fylde 12 MB." }, { status: 413 });
  if (!ALLOWED_OPERATIONAL_IMAGE_TYPES.has(file.type)) return NextResponse.json({ error: "Brug JPEG, PNG eller WebP." }, { status: 415 });
  if (suppliedTitle.length > 180 || suppliedAltText.length > 300) return NextResponse.json({ error: "Titel eller alternativ tekst er for lang." }, { status: 400 });

  const targets = await resolveOperationalTargets({ vehicleId, placeId, itemId });
  if (!targets?.vehicleId) return NextResponse.json({ error: "Køretøjet, rummet eller udstyret blev ikke fundet." }, { status: 404 });

  const originalName = safeOriginalFileName(file.name);
  const defaultTitle = path.basename(originalName, path.extname(originalName)).slice(0, 180) || "Billede";
  const title = suppliedTitle || defaultTitle;
  const altText = suppliedAltText || title;
  const extension = imageExtensionForMimeType(file.type);
  if (!extension) return NextResponse.json({ error: "Billedformatet er ikke understøttet." }, { status: 415 });

  const imageId = randomUUID();
  const storageName = `${randomUUID()}${extension}`;
  const filePath = path.join(OPERATIONAL_IMAGE_DIRECTORY, storageName);
  const makeCover = requestedCover || !(await hasTargetImage(targets));

  await mkdir(OPERATIONAL_IMAGE_DIRECTORY, { recursive: true });
  await writeFile(filePath, Buffer.from(await file.arrayBuffer()), { flag: "wx" });

  try {
    await prisma.$transaction(async (tx) => {
      if (makeCover) {
        if (targets.itemId) await tx.$executeRaw`UPDATE operational_image SET is_cover = false WHERE item_id = ${targets.itemId}`;
        else if (targets.placeId) await tx.$executeRaw`UPDATE operational_image SET is_cover = false WHERE place_id = ${targets.placeId} AND item_id IS NULL`;
        else await tx.$executeRaw`UPDATE operational_image SET is_cover = false WHERE vehicle_id = ${targets.vehicleId} AND place_id IS NULL AND item_id IS NULL`;
      }
      await tx.$executeRaw`
        INSERT INTO operational_image
          (id, vehicle_id, place_id, item_id, title, alt_text, original_name, storage_name, mime_type, size_bytes, is_cover)
        VALUES
          (${imageId}, ${targets.vehicleId}, ${targets.placeId}, ${targets.itemId}, ${title}, ${altText},
           ${originalName}, ${storageName}, ${file.type}, ${file.size}, ${makeCover})
      `;
    });
    await prisma.auditLog.create({ data: { actorUserId: admin!.id, actorRole: admin!.role, action: "OPERATIONAL_IMAGE_CREATED", description: `Billedet ${title} blev uploadet til Operativ Portal` } });
  } catch (error) {
    await unlink(filePath).catch(() => undefined);
    throw error;
  }

  return NextResponse.json({ ok: true, imageId }, { status: 201 });
}
