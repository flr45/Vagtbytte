"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { UserRole } from "@prisma/client";
import { z } from "zod";
import { requireRole } from "./auth";
import { OPERATIONAL_VIEW_CONFIG, OPERATIONAL_VIEW_KEYS } from "./operativ-vehicle-views";
import { prisma } from "./prisma";

const uuidSchema = z.string().uuid();
const viewKeySchema = z.enum(OPERATIONAL_VIEW_KEYS);
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
  revalidatePath(`/admin/operativ-portal/koeretoejer/${vehicleId}`);
  revalidatePath(`/admin/operativ-portal/koeretoejer/${vehicleId}/interaktiv`);
  revalidatePath(`/admin/operativ-portal/koeretoejer/${vehicleId}/administration`);
}

export async function setOperationalVehicleViewAction(formData: FormData) {
  await requireRole(UserRole.ADMIN);
  const parsed = z.object({
    vehicleId: uuidSchema,
    viewKey: viewKeySchema,
    imageId: z.string().trim()
  }).safeParse({
    vehicleId: formData.get("vehicleId"),
    viewKey: formData.get("viewKey"),
    imageId: String(formData.get("imageId") ?? "")
  });
  if (!parsed.success) return;

  const config = OPERATIONAL_VIEW_CONFIG[parsed.data.viewKey];
  if (!parsed.data.imageId) {
    await prisma.$executeRaw`
      DELETE FROM operational_vehicle_view
      WHERE vehicle_id = ${parsed.data.vehicleId} AND view_key = ${parsed.data.viewKey}
    `;
    if (parsed.data.viewKey === "front") {
      await prisma.$executeRaw`
        UPDATE operational_vehicle SET interactive_image_id = NULL, updated_at = CURRENT_TIMESTAMP
        WHERE id = ${parsed.data.vehicleId}
      `;
    }
    await audit("OPERATIONAL_VEHICLE_VIEW_CLEARED", `${config.label} blev fjernet fra den interaktive køretøjsvisning`);
    revalidateVehicle(parsed.data.vehicleId);
    return;
  }

  const imageId = uuidSchema.safeParse(parsed.data.imageId);
  if (!imageId.success) return;
  const imageRows = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM operational_image
    WHERE id = ${imageId.data}
      AND vehicle_id = ${parsed.data.vehicleId}
      AND place_id IS NULL
      AND item_id IS NULL
    LIMIT 1
  `;
  if (!imageRows[0]) return;

  await prisma.$executeRaw`
    INSERT INTO operational_vehicle_view (id, vehicle_id, view_key, label, image_id, sort_order)
    VALUES (${randomUUID()}, ${parsed.data.vehicleId}, ${parsed.data.viewKey}, ${config.label}, ${imageId.data}, ${config.sortOrder})
    ON CONFLICT (vehicle_id, view_key)
    DO UPDATE SET image_id = EXCLUDED.image_id, label = EXCLUDED.label,
      sort_order = EXCLUDED.sort_order, updated_at = CURRENT_TIMESTAMP
  `;
  if (parsed.data.viewKey === "front") {
    await prisma.$executeRaw`
      UPDATE operational_vehicle SET interactive_image_id = ${imageId.data}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ${parsed.data.vehicleId}
    `;
  }
  await audit("OPERATIONAL_VEHICLE_VIEW_SET", `${config.label} blev sat som interaktiv køretøjsvisning`);
  revalidateVehicle(parsed.data.vehicleId);
}

export async function createOperationalVehicleViewHotspotAction(formData: FormData) {
  await requireRole(UserRole.ADMIN);
  const parsed = z.object({
    vehicleId: uuidSchema,
    viewKey: viewKeySchema,
    placeId: uuidSchema,
    label: z.string().trim().max(100),
    xPercent: percentSchema,
    yPercent: percentSchema,
    sizePx: sizeSchema,
    sortOrder: z.coerce.number().int().min(0).max(9999).default(0)
  }).safeParse({
    vehicleId: formData.get("vehicleId"),
    viewKey: formData.get("viewKey"),
    placeId: formData.get("placeId"),
    label: String(formData.get("label") ?? ""),
    xPercent: formData.get("xPercent"),
    yPercent: formData.get("yPercent"),
    sizePx: formData.get("sizePx") ?? 36,
    sortOrder: formData.get("sortOrder") ?? 0
  });
  if (!parsed.success) return;

  const [place, view] = await Promise.all([
    prisma.$queryRaw<Array<{ name: string }>>`
      SELECT name FROM operational_place
      WHERE id = ${parsed.data.placeId} AND vehicle_id = ${parsed.data.vehicleId}
      LIMIT 1
    `,
    prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM operational_vehicle_view
      WHERE vehicle_id = ${parsed.data.vehicleId} AND view_key = ${parsed.data.viewKey}
      LIMIT 1
    `
  ]);
  if (!place[0] || !view[0]) return;

  await prisma.$executeRaw`
    INSERT INTO operational_hotspot
      (id, vehicle_id, place_id, view_key, label, x_percent, y_percent, size_px, sort_order)
    VALUES
      (${randomUUID()}, ${parsed.data.vehicleId}, ${parsed.data.placeId}, ${parsed.data.viewKey},
       ${parsed.data.label}, ${parsed.data.xPercent}, ${parsed.data.yPercent}, ${parsed.data.sizePx}, ${parsed.data.sortOrder})
  `;
  await audit("OPERATIONAL_VIEW_HOTSPOT_CREATED", `Hotspot til ${place[0].name} blev oprettet på ${OPERATIONAL_VIEW_CONFIG[parsed.data.viewKey].label}`);
  revalidateVehicle(parsed.data.vehicleId);
}

export async function updateOperationalVehicleViewHotspotAction(formData: FormData) {
  await requireRole(UserRole.ADMIN);
  const parsed = z.object({
    hotspotId: uuidSchema,
    vehicleId: uuidSchema,
    viewKey: viewKeySchema,
    placeId: uuidSchema,
    label: z.string().trim().max(100),
    xPercent: percentSchema,
    yPercent: percentSchema,
    sizePx: sizeSchema,
    sortOrder: z.coerce.number().int().min(0).max(9999).default(0)
  }).safeParse({
    hotspotId: formData.get("hotspotId"),
    vehicleId: formData.get("vehicleId"),
    viewKey: formData.get("viewKey"),
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
    SET place_id = ${parsed.data.placeId}, view_key = ${parsed.data.viewKey}, label = ${parsed.data.label},
      x_percent = ${parsed.data.xPercent}, y_percent = ${parsed.data.yPercent}, size_px = ${parsed.data.sizePx},
      sort_order = ${parsed.data.sortOrder}, updated_at = CURRENT_TIMESTAMP
    WHERE id = ${parsed.data.hotspotId} AND vehicle_id = ${parsed.data.vehicleId}
  `;
  await audit("OPERATIONAL_VIEW_HOTSPOT_UPDATED", `Hotspot til ${place[0].name} blev opdateret`);
  revalidateVehicle(parsed.data.vehicleId);
}

export async function deleteOperationalVehicleViewHotspotAction(formData: FormData) {
  await requireRole(UserRole.ADMIN);
  const parsed = z.object({ hotspotId: uuidSchema, vehicleId: uuidSchema }).safeParse({
    hotspotId: formData.get("hotspotId"),
    vehicleId: formData.get("vehicleId")
  });
  if (!parsed.success) return;
  await prisma.$executeRaw`
    DELETE FROM operational_hotspot
    WHERE id = ${parsed.data.hotspotId} AND vehicle_id = ${parsed.data.vehicleId}
  `;
  await audit("OPERATIONAL_VIEW_HOTSPOT_DELETED", "Et køretøjshotspot blev slettet");
  revalidateVehicle(parsed.data.vehicleId);
}
