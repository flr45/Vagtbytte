"use server";

import { unlink } from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { UserRole } from "@prisma/client";
import { z } from "zod";
import { requireRole } from "./auth";
import {
  OPERATIONAL_IMAGE_DIRECTORY,
  getOperationalImage,
  type OperationalImage
} from "./operativ-portal";
import { prisma } from "./prisma";

const uuidSchema = z.string().uuid();
const metadataSchema = z.object({
  imageId: uuidSchema,
  title: z.string().trim().min(1).max(180),
  altText: z.string().trim().max(300)
});

function revalidateImageTarget(image: OperationalImage) {
  revalidatePath("/admin/operativ-portal");
  revalidatePath("/admin/operativ-portal/koeretoejer");
  revalidatePath(`/admin/operativ-portal/koeretoejer/${image.vehicleId}`);
  if (image.placeId) revalidatePath(`/admin/operativ-portal/rum/${image.placeId}`);
  if (image.itemId) revalidatePath(`/admin/operativ-portal/udstyr/${image.itemId}`);
}

async function audit(admin: Awaited<ReturnType<typeof requireRole>>, action: string, description: string) {
  await prisma.auditLog.create({
    data: { actorUserId: admin.id, actorRole: admin.role, action, description }
  });
}

export async function updateOperationalImageMetadataAction(formData: FormData) {
  const admin = await requireRole(UserRole.ADMIN);
  const parsed = metadataSchema.safeParse({
    imageId: formData.get("imageId"),
    title: formData.get("title"),
    altText: String(formData.get("altText") ?? "")
  });
  if (!parsed.success) return;
  const image = await getOperationalImage(parsed.data.imageId);
  if (!image) return;

  await prisma.$executeRaw`
    UPDATE operational_image SET title = ${parsed.data.title}, alt_text = ${parsed.data.altText},
      updated_at = CURRENT_TIMESTAMP WHERE id = ${parsed.data.imageId}
  `;
  await audit(admin, "OPERATIONAL_IMAGE_UPDATED", `Billedet ${parsed.data.title} blev opdateret`);
  revalidateImageTarget(image);
}

export async function setOperationalImageCoverAction(formData: FormData) {
  const admin = await requireRole(UserRole.ADMIN);
  const parsed = uuidSchema.safeParse(formData.get("imageId"));
  if (!parsed.success) return;
  const image = await getOperationalImage(parsed.data);
  if (!image) return;

  await prisma.$transaction(async (tx) => {
    if (image.itemId) {
      await tx.$executeRaw`UPDATE operational_image SET is_cover = false WHERE item_id = ${image.itemId}`;
    } else if (image.placeId) {
      await tx.$executeRaw`UPDATE operational_image SET is_cover = false WHERE place_id = ${image.placeId} AND item_id IS NULL`;
    } else {
      await tx.$executeRaw`UPDATE operational_image SET is_cover = false WHERE vehicle_id = ${image.vehicleId} AND place_id IS NULL AND item_id IS NULL`;
    }
    await tx.$executeRaw`UPDATE operational_image SET is_cover = true, updated_at = CURRENT_TIMESTAMP WHERE id = ${image.id}`;
  });

  await audit(admin, "OPERATIONAL_IMAGE_COVER_SET", `Billedet ${image.title} blev valgt som forsidebillede`);
  revalidateImageTarget(image);
}

export async function deleteOperationalImageAction(formData: FormData) {
  const admin = await requireRole(UserRole.ADMIN);
  const parsed = uuidSchema.safeParse(formData.get("imageId"));
  if (!parsed.success) return;
  const image = await getOperationalImage(parsed.data);
  if (!image) return;

  await prisma.$executeRaw`DELETE FROM operational_image WHERE id = ${image.id}`;
  await unlink(path.join(OPERATIONAL_IMAGE_DIRECTORY, image.storageName)).catch(() => undefined);

  if (image.isCover) {
    if (image.itemId) {
      await prisma.$executeRaw`
        UPDATE operational_image SET is_cover = true, updated_at = CURRENT_TIMESTAMP
        WHERE id = (SELECT id FROM operational_image WHERE item_id = ${image.itemId}
          ORDER BY sort_order, created_at LIMIT 1)
      `;
    } else if (image.placeId) {
      await prisma.$executeRaw`
        UPDATE operational_image SET is_cover = true, updated_at = CURRENT_TIMESTAMP
        WHERE id = (SELECT id FROM operational_image WHERE place_id = ${image.placeId} AND item_id IS NULL
          ORDER BY sort_order, created_at LIMIT 1)
      `;
    } else {
      await prisma.$executeRaw`
        UPDATE operational_image SET is_cover = true, updated_at = CURRENT_TIMESTAMP
        WHERE id = (SELECT id FROM operational_image WHERE vehicle_id = ${image.vehicleId}
          AND place_id IS NULL AND item_id IS NULL ORDER BY sort_order, created_at LIMIT 1)
      `;
    }
  }

  await audit(admin, "OPERATIONAL_IMAGE_DELETED", `Billedet ${image.title} blev slettet`);
  revalidateImageTarget(image);
}
