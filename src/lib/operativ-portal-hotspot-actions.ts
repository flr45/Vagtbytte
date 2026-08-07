"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { UserRole } from "@prisma/client";
import { z } from "zod";
import { requireRole } from "./auth";
import { prisma } from "./prisma";

const uuidSchema = z.string().uuid();
const percentSchema = z.coerce.number().min(0).max(100);
const sizeSchema = z.coerce.number().int().min(24).max(96).default(36);

async function audit(action: string, description: string) {
  const admin = await requireRole(UserRole.ADMIN);
  await prisma.auditLog.create({
    data: {
      actorUserId: admin.id,
      actorRole: admin.role,
      action,
      description
    }
  });
}

function revalidateVehicle(vehicleId: string) {
  revalidatePath("/admin/operativ-portal");
  revalidatePath("/admin/operativ-portal/koeretoejer");
  revalidatePath(`/admin/operativ-portal/koeretoejer/${vehicleId}`);
  revalidatePath(`/admin/operativ-portal/koeretoejer/${vehicleId}/interaktiv`);
}

function revalidatePlace(placeId: string, vehicleId?: string) {
  revalidatePath(`/admin/operativ-portal/rum/${placeId}`);
  revalidatePath(`/admin/operativ-portal/rum/${placeId}/interaktiv`);
  if (vehicleId) revalidateVehicle(vehicleId);
}

export async function setOperationalInteractiveImageAction(formData: FormData) {
  await requireRole(UserRole.ADMIN);
  const parsed = z.object({
    vehicleId: uuidSchema,
    imageId: z.string().trim()
  }).safeParse({
    vehicleId: formData.get("vehicleId"),
    imageId: String(formData.get("imageId") ?? "")
  });
  if (!parsed.success) return;

  if (!parsed.data.imageId) {
    await prisma.$executeRaw`
      UPDATE operational_vehicle
      SET interactive_image_id = NULL, updated_at = CURRENT_TIMESTAMP
      WHERE id = ${parsed.data.vehicleId}
    `;
    await audit("OPERATIONAL_INTERACTIVE_IMAGE_CLEARED", "Interaktivt køretøjsbillede blev fjernet");
    revalidateVehicle(parsed.data.vehicleId);
    return;
  }

  const imageId = uuidSchema.safeParse(parsed.data.imageId);
  if (!imageId.success) return;
  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM operational_image
    WHERE id = ${imageId.data}
      AND vehicle_id = ${parsed.data.vehicleId}
      AND place_id IS NULL
      AND item_id IS NULL
    LIMIT 1
  `;
  if (!rows[0]) return;

  await prisma.$executeRaw`
    UPDATE operational_vehicle
    SET interactive_image_id = ${imageId.data}, updated_at = CURRENT_TIMESTAMP
    WHERE id = ${parsed.data.vehicleId}
  `;
  await audit("OPERATIONAL_INTERACTIVE_IMAGE_SET", "Interaktivt køretøjsbillede blev valgt");
  revalidateVehicle(parsed.data.vehicleId);
}

export async function setOperationalPlaceInteractiveImageAction(formData: FormData) {
  await requireRole(UserRole.ADMIN);
  const parsed = z.object({
    placeId: uuidSchema,
    vehicleId: uuidSchema,
    imageId: z.string().trim()
  }).safeParse({
    placeId: formData.get("placeId"),
    vehicleId: formData.get("vehicleId"),
    imageId: String(formData.get("imageId") ?? "")
  });
  if (!parsed.success) return;

  if (!parsed.data.imageId) {
    await prisma.$executeRaw`
      UPDATE operational_place SET interactive_image_id = NULL
      WHERE id = ${parsed.data.placeId} AND vehicle_id = ${parsed.data.vehicleId}
    `;
    await audit("OPERATIONAL_PLACE_INTERACTIVE_IMAGE_CLEARED", "Interaktivt rumbillede blev fjernet");
    revalidatePlace(parsed.data.placeId, parsed.data.vehicleId);
    return;
  }

  const imageId = uuidSchema.safeParse(parsed.data.imageId);
  if (!imageId.success) return;
  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM operational_image
    WHERE id = ${imageId.data}
      AND vehicle_id = ${parsed.data.vehicleId}
      AND place_id = ${parsed.data.placeId}
      AND item_id IS NULL
    LIMIT 1
  `;
  if (!rows[0]) return;

  await prisma.$executeRaw`
    UPDATE operational_place SET interactive_image_id = ${imageId.data}
    WHERE id = ${parsed.data.placeId} AND vehicle_id = ${parsed.data.vehicleId}
  `;
  await audit("OPERATIONAL_PLACE_INTERACTIVE_IMAGE_SET", "Interaktivt rumbillede blev valgt");
  revalidatePlace(parsed.data.placeId, parsed.data.vehicleId);
}

export async function createOperationalHotspotAction(formData: FormData) {
  await requireRole(UserRole.ADMIN);
  const parsed = z.object({
    vehicleId: uuidSchema,
    placeId: uuidSchema,
    label: z.string().trim().max(100),
    xPercent: percentSchema,
    yPercent: percentSchema,
    sizePx: sizeSchema,
    sortOrder: z.coerce.number().int().min(0).max(9999).default(0)
  }).safeParse({
    vehicleId: formData.get("vehicleId"),
    placeId: formData.get("placeId"),
    label: String(formData.get("label") ?? ""),
    xPercent: formData.get("xPercent"),
    yPercent: formData.get("yPercent"),
    sizePx: formData.get("sizePx") ?? 36,
    sortOrder: formData.get("sortOrder") ?? 0
  });
  if (!parsed.success) return;

  const place = await prisma.$queryRaw<Array<{ name: string }>>`
    SELECT name FROM operational_place
    WHERE id = ${parsed.data.placeId} AND vehicle_id = ${parsed.data.vehicleId}
    LIMIT 1
  `;
  if (!place[0]) return;

  const id = randomUUID();
  await prisma.$executeRaw`
    INSERT INTO operational_hotspot
      (id, vehicle_id, place_id, label, x_percent, y_percent, size_px, sort_order)
    VALUES
      (${id}, ${parsed.data.vehicleId}, ${parsed.data.placeId}, ${parsed.data.label},
       ${parsed.data.xPercent}, ${parsed.data.yPercent}, ${parsed.data.sizePx}, ${parsed.data.sortOrder})
  `;
  await audit("OPERATIONAL_HOTSPOT_CREATED", `Hotspot til ${place[0].name} blev oprettet`);
  revalidateVehicle(parsed.data.vehicleId);
}

export async function updateOperationalHotspotAction(formData: FormData) {
  await requireRole(UserRole.ADMIN);
  const parsed = z.object({
    hotspotId: uuidSchema,
    vehicleId: uuidSchema,
    placeId: uuidSchema,
    label: z.string().trim().max(100),
    xPercent: percentSchema,
    yPercent: percentSchema,
    sizePx: sizeSchema,
    sortOrder: z.coerce.number().int().min(0).max(9999).default(0)
  }).safeParse({
    hotspotId: formData.get("hotspotId"),
    vehicleId: formData.get("vehicleId"),
    placeId: formData.get("placeId"),
    label: String(formData.get("label") ?? ""),
    xPercent: formData.get("xPercent"),
    yPercent: formData.get("yPercent"),
    sizePx: formData.get("sizePx") ?? 36,
    sortOrder: formData.get("sortOrder") ?? 0
  });
  if (!parsed.success) return;

  const place = await prisma.$queryRaw<Array<{ name: string }>>`
    SELECT name FROM operational_place
    WHERE id = ${parsed.data.placeId} AND vehicle_id = ${parsed.data.vehicleId}
    LIMIT 1
  `;
  if (!place[0]) return;

  await prisma.$executeRaw`
    UPDATE operational_hotspot
    SET place_id = ${parsed.data.placeId}, label = ${parsed.data.label},
        x_percent = ${parsed.data.xPercent}, y_percent = ${parsed.data.yPercent},
        size_px = ${parsed.data.sizePx}, sort_order = ${parsed.data.sortOrder}, updated_at = CURRENT_TIMESTAMP
    WHERE id = ${parsed.data.hotspotId} AND vehicle_id = ${parsed.data.vehicleId}
  `;
  await audit("OPERATIONAL_HOTSPOT_UPDATED", `Hotspot til ${place[0].name} blev opdateret`);
  revalidateVehicle(parsed.data.vehicleId);
}

export async function deleteOperationalHotspotAction(formData: FormData) {
  await requireRole(UserRole.ADMIN);
  const parsed = z.object({ hotspotId: uuidSchema, vehicleId: uuidSchema }).safeParse({
    hotspotId: formData.get("hotspotId"),
    vehicleId: formData.get("vehicleId")
  });
  if (!parsed.success) return;

  const deleted = await prisma.$queryRaw<Array<{ label: string }>>`
    DELETE FROM operational_hotspot
    WHERE id = ${parsed.data.hotspotId} AND vehicle_id = ${parsed.data.vehicleId}
    RETURNING label
  `;
  if (deleted[0]) {
    await audit("OPERATIONAL_HOTSPOT_DELETED", `Hotspot ${deleted[0].label || "uden navn"} blev slettet`);
  }
  revalidateVehicle(parsed.data.vehicleId);
}

export async function createOperationalPlaceHotspotAction(formData: FormData) {
  await requireRole(UserRole.ADMIN);
  const parsed = z.object({
    placeId: uuidSchema,
    vehicleId: uuidSchema,
    itemId: uuidSchema,
    label: z.string().trim().max(100),
    xPercent: percentSchema,
    yPercent: percentSchema,
    sizePx: sizeSchema,
    sortOrder: z.coerce.number().int().min(0).max(9999).default(0)
  }).safeParse({
    placeId: formData.get("placeId"),
    vehicleId: formData.get("vehicleId"),
    itemId: formData.get("itemId"),
    label: String(formData.get("label") ?? ""),
    xPercent: formData.get("xPercent"),
    yPercent: formData.get("yPercent"),
    sizePx: formData.get("sizePx") ?? 36,
    sortOrder: formData.get("sortOrder") ?? 0
  });
  if (!parsed.success) return;

  const item = await prisma.$queryRaw<Array<{ name: string }>>`
    SELECT i.name FROM operational_item i
    INNER JOIN operational_place p ON p.id = i.place_id
    WHERE i.id = ${parsed.data.itemId}
      AND i.place_id = ${parsed.data.placeId}
      AND p.vehicle_id = ${parsed.data.vehicleId}
    LIMIT 1
  `;
  if (!item[0]) return;

  await prisma.$executeRaw`
    INSERT INTO operational_place_hotspot
      (id, place_id, item_id, label, x_percent, y_percent, size_px, sort_order)
    VALUES
      (${randomUUID()}, ${parsed.data.placeId}, ${parsed.data.itemId}, ${parsed.data.label},
       ${parsed.data.xPercent}, ${parsed.data.yPercent}, ${parsed.data.sizePx}, ${parsed.data.sortOrder})
  `;
  await audit("OPERATIONAL_PLACE_HOTSPOT_CREATED", `Hotspot til ${item[0].name} blev oprettet`);
  revalidatePlace(parsed.data.placeId, parsed.data.vehicleId);
}

export async function updateOperationalPlaceHotspotAction(formData: FormData) {
  await requireRole(UserRole.ADMIN);
  const parsed = z.object({
    hotspotId: uuidSchema,
    placeId: uuidSchema,
    vehicleId: uuidSchema,
    itemId: uuidSchema,
    label: z.string().trim().max(100),
    xPercent: percentSchema,
    yPercent: percentSchema,
    sizePx: sizeSchema,
    sortOrder: z.coerce.number().int().min(0).max(9999).default(0)
  }).safeParse({
    hotspotId: formData.get("hotspotId"),
    placeId: formData.get("placeId"),
    vehicleId: formData.get("vehicleId"),
    itemId: formData.get("itemId"),
    label: String(formData.get("label") ?? ""),
    xPercent: formData.get("xPercent"),
    yPercent: formData.get("yPercent"),
    sizePx: formData.get("sizePx") ?? 36,
    sortOrder: formData.get("sortOrder") ?? 0
  });
  if (!parsed.success) return;

  const item = await prisma.$queryRaw<Array<{ name: string }>>`
    SELECT i.name FROM operational_item i
    INNER JOIN operational_place p ON p.id = i.place_id
    WHERE i.id = ${parsed.data.itemId}
      AND i.place_id = ${parsed.data.placeId}
      AND p.vehicle_id = ${parsed.data.vehicleId}
    LIMIT 1
  `;
  if (!item[0]) return;

  await prisma.$executeRaw`
    UPDATE operational_place_hotspot
    SET item_id = ${parsed.data.itemId}, label = ${parsed.data.label},
        x_percent = ${parsed.data.xPercent}, y_percent = ${parsed.data.yPercent},
        size_px = ${parsed.data.sizePx}, sort_order = ${parsed.data.sortOrder}, updated_at = CURRENT_TIMESTAMP
    WHERE id = ${parsed.data.hotspotId} AND place_id = ${parsed.data.placeId}
  `;
  await audit("OPERATIONAL_PLACE_HOTSPOT_UPDATED", `Hotspot til ${item[0].name} blev opdateret`);
  revalidatePlace(parsed.data.placeId, parsed.data.vehicleId);
}

export async function deleteOperationalPlaceHotspotAction(formData: FormData) {
  await requireRole(UserRole.ADMIN);
  const parsed = z.object({ hotspotId: uuidSchema, placeId: uuidSchema, vehicleId: uuidSchema }).safeParse({
    hotspotId: formData.get("hotspotId"),
    placeId: formData.get("placeId"),
    vehicleId: formData.get("vehicleId")
  });
  if (!parsed.success) return;

  const deleted = await prisma.$queryRaw<Array<{ label: string }>>`
    DELETE FROM operational_place_hotspot
    WHERE id = ${parsed.data.hotspotId} AND place_id = ${parsed.data.placeId}
    RETURNING label
  `;
  if (deleted[0]) {
    await audit("OPERATIONAL_PLACE_HOTSPOT_DELETED", `Rum-hotspot ${deleted[0].label || "uden navn"} blev slettet`);
  }
  revalidatePlace(parsed.data.placeId, parsed.data.vehicleId);
}
