"use server";

import { randomUUID } from "node:crypto";
import { unlink } from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { UserRole } from "@prisma/client";
import { z } from "zod";
import { requireRole } from "./auth";
import {
  OPERATIONAL_DOCUMENT_CATEGORIES,
  OPERATIONAL_VIDEO_CATEGORIES,
  getManagedOperationalDocument,
  resolveOperationalTargets,
  type OperationalTargets
} from "./operativ-portal-content";
import {
  OPERATIONAL_DOCUMENT_DIRECTORY,
  extractYouTubeId
} from "./operativ-portal";
import { prisma } from "./prisma";

const titleSchema = z.string().trim().min(1).max(180);
const uuidSchema = z.string().uuid();
const sortSchema = z.coerce.number().int().min(0).max(9999);

function optionalUuid(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  if (!value) return null;
  const parsed = uuidSchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}

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

function revalidateTargets(targets: OperationalTargets) {
  revalidatePath("/admin/operativ-portal");
  revalidatePath("/admin/operativ-portal/videoer");
  revalidatePath("/admin/operativ-portal/dokumenter");
  revalidatePath("/admin/operativ-portal/soeg");
  if (targets.vehicleId) revalidatePath(`/admin/operativ-portal/koeretoejer/${targets.vehicleId}`);
  if (targets.placeId) revalidatePath(`/admin/operativ-portal/rum/${targets.placeId}`);
  if (targets.itemId) revalidatePath(`/admin/operativ-portal/udstyr/${targets.itemId}`);
}

async function targetsFromForm(formData: FormData) {
  const vehicleId = optionalUuid(formData, "vehicleId");
  const placeId = optionalUuid(formData, "placeId");
  const itemId = optionalUuid(formData, "itemId");
  if (vehicleId === undefined || placeId === undefined || itemId === undefined) return null;
  return resolveOperationalTargets({ vehicleId, placeId, itemId });
}

export async function createManagedOperationalVideoAction(formData: FormData) {
  await requireRole(UserRole.ADMIN);
  const parsed = z.object({
    title: titleSchema,
    description: z.string().trim().max(3000),
    category: z.enum(OPERATIONAL_VIDEO_CATEGORIES),
    youtubeUrl: z.string().trim().min(1).max(500)
  }).safeParse({
    title: formData.get("title"),
    description: String(formData.get("description") ?? ""),
    category: String(formData.get("category") ?? "Udstyr"),
    youtubeUrl: formData.get("youtubeUrl")
  });

  if (!parsed.success) {
    redirect("/admin/operativ-portal/videoer?fejl=Videoen+kunne+ikke+oprettes");
  }
  const youtubeId = extractYouTubeId(parsed.data.youtubeUrl);
  if (!youtubeId) {
    redirect("/admin/operativ-portal/videoer?fejl=YouTube-linket+er+ugyldigt");
  }
  const targets = await targetsFromForm(formData);
  if (!targets) {
    redirect("/admin/operativ-portal/videoer?fejl=Den+valgte+tilknytning+findes+ikke");
  }

  const id = randomUUID();
  await prisma.$executeRaw`
    INSERT INTO operational_video
      (id, vehicle_id, place_id, item_id, title, description, category, youtube_url, youtube_id)
    VALUES
      (${id}, ${targets.vehicleId}, ${targets.placeId}, ${targets.itemId}, ${parsed.data.title},
       ${parsed.data.description}, ${parsed.data.category}, ${parsed.data.youtubeUrl}, ${youtubeId})
  `;
  await audit("OPERATIONAL_VIDEO_CREATED", `Videoen ${parsed.data.title} blev oprettet`);
  revalidateTargets(targets);
  redirect(`/admin/operativ-portal/videoer#video-${id}`);
}

export async function updateManagedOperationalVideoAction(formData: FormData) {
  await requireRole(UserRole.ADMIN);
  const parsed = z.object({
    videoId: uuidSchema,
    title: titleSchema,
    description: z.string().trim().max(3000),
    category: z.enum(OPERATIONAL_VIDEO_CATEGORIES),
    youtubeUrl: z.string().trim().min(1).max(500)
  }).safeParse({
    videoId: formData.get("videoId"),
    title: formData.get("title"),
    description: String(formData.get("description") ?? ""),
    category: String(formData.get("category") ?? "Udstyr"),
    youtubeUrl: formData.get("youtubeUrl")
  });
  if (!parsed.success) return;

  const youtubeId = extractYouTubeId(parsed.data.youtubeUrl);
  const targets = await targetsFromForm(formData);
  if (!youtubeId || !targets) return;

  await prisma.$executeRaw`
    UPDATE operational_video
    SET vehicle_id = ${targets.vehicleId}, place_id = ${targets.placeId}, item_id = ${targets.itemId},
        title = ${parsed.data.title}, description = ${parsed.data.description},
        category = ${parsed.data.category}, youtube_url = ${parsed.data.youtubeUrl},
        youtube_id = ${youtubeId}, updated_at = CURRENT_TIMESTAMP
    WHERE id = ${parsed.data.videoId}
  `;
  await audit("OPERATIONAL_VIDEO_UPDATED", `Videoen ${parsed.data.title} blev opdateret`);
  revalidateTargets(targets);
}

export async function deleteManagedOperationalVideoAction(formData: FormData) {
  await requireRole(UserRole.ADMIN);
  const parsed = uuidSchema.safeParse(formData.get("videoId"));
  if (!parsed.success) return;
  const rows = await prisma.$queryRaw<Array<OperationalTargets & { title: string }>>`
    DELETE FROM operational_video
    WHERE id = ${parsed.data}
    RETURNING title, vehicle_id AS "vehicleId", place_id AS "placeId", item_id AS "itemId"
  `;
  const video = rows[0];
  if (!video) return;
  await audit("OPERATIONAL_VIDEO_DELETED", `Videoen ${video.title} blev slettet`);
  revalidateTargets(video);
}

export async function updateManagedOperationalDocumentAction(formData: FormData) {
  await requireRole(UserRole.ADMIN);
  const parsed = z.object({
    documentId: uuidSchema,
    title: titleSchema,
    description: z.string().trim().max(3000),
    category: z.enum(OPERATIONAL_DOCUMENT_CATEGORIES)
  }).safeParse({
    documentId: formData.get("documentId"),
    title: formData.get("title"),
    description: String(formData.get("description") ?? ""),
    category: String(formData.get("category") ?? "Instruks")
  });
  if (!parsed.success) return;

  const targets = await targetsFromForm(formData);
  if (!targets) return;
  await prisma.$executeRaw`
    UPDATE operational_document
    SET vehicle_id = ${targets.vehicleId}, place_id = ${targets.placeId}, item_id = ${targets.itemId},
        title = ${parsed.data.title}, description = ${parsed.data.description},
        category = ${parsed.data.category}, updated_at = CURRENT_TIMESTAMP
    WHERE id = ${parsed.data.documentId}
  `;
  await audit("OPERATIONAL_DOCUMENT_UPDATED", `Dokumentet ${parsed.data.title} blev opdateret`);
  revalidateTargets(targets);
}

export async function deleteManagedOperationalDocumentAction(formData: FormData) {
  await requireRole(UserRole.ADMIN);
  const parsed = uuidSchema.safeParse(formData.get("documentId"));
  if (!parsed.success) return;
  const document = await getManagedOperationalDocument(parsed.data);
  if (!document) return;

  await prisma.$executeRaw`DELETE FROM operational_document WHERE id = ${parsed.data}`;
  await unlink(path.join(OPERATIONAL_DOCUMENT_DIRECTORY, document.storageName)).catch(() => undefined);
  await audit("OPERATIONAL_DOCUMENT_DELETED", `Dokumentet ${document.title} blev slettet`);
  revalidateTargets({
    vehicleId: document.vehicleId,
    placeId: document.placeId,
    itemId: document.itemId
  });
}

export async function updateOperationalPlaceDetailsAction(formData: FormData) {
  await requireRole(UserRole.ADMIN);
  const parsed = z.object({
    placeId: uuidSchema,
    name: titleSchema,
    description: z.string().trim().max(2000),
    sortOrder: sortSchema
  }).safeParse({
    placeId: formData.get("placeId"),
    name: formData.get("name"),
    description: String(formData.get("description") ?? ""),
    sortOrder: formData.get("sortOrder") ?? 0
  });
  if (!parsed.success) return;
  const rows = await prisma.$queryRaw<Array<{ vehicleId: string }>>`
    UPDATE operational_place
    SET name = ${parsed.data.name}, description = ${parsed.data.description},
        sort_order = ${parsed.data.sortOrder}, updated_at = CURRENT_TIMESTAMP
    WHERE id = ${parsed.data.placeId}
    RETURNING vehicle_id AS "vehicleId"
  `;
  await audit("OPERATIONAL_PLACE_UPDATED", `Rummet ${parsed.data.name} blev opdateret`);
  revalidatePath(`/admin/operativ-portal/rum/${parsed.data.placeId}`);
  if (rows[0]?.vehicleId) revalidatePath(`/admin/operativ-portal/koeretoejer/${rows[0].vehicleId}`);
  revalidatePath("/admin/operativ-portal/koeretoejer");
  revalidatePath("/admin/operativ-portal/soeg");
}

export async function updateOperationalItemDetailsAction(formData: FormData) {
  await requireRole(UserRole.ADMIN);
  const parsed = z.object({
    itemId: uuidSchema,
    name: titleSchema,
    quantity: z.coerce.number().int().min(1).max(999),
    note: z.string().trim().max(1000),
    specifications: z.string().trim().max(3000),
    sortOrder: sortSchema
  }).safeParse({
    itemId: formData.get("itemId"),
    name: formData.get("name"),
    quantity: formData.get("quantity"),
    note: String(formData.get("note") ?? ""),
    specifications: String(formData.get("specifications") ?? ""),
    sortOrder: formData.get("sortOrder") ?? 0
  });
  if (!parsed.success) return;
  const rows = await prisma.$queryRaw<Array<{ placeId: string }>>`
    UPDATE operational_item
    SET name = ${parsed.data.name}, quantity = ${parsed.data.quantity}, note = ${parsed.data.note},
        specifications = ${parsed.data.specifications}, sort_order = ${parsed.data.sortOrder},
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ${parsed.data.itemId}
    RETURNING place_id AS "placeId"
  `;
  await audit("OPERATIONAL_ITEM_UPDATED", `Udstyret ${parsed.data.name} blev opdateret`);
  revalidatePath(`/admin/operativ-portal/udstyr/${parsed.data.itemId}`);
  if (rows[0]?.placeId) revalidatePath(`/admin/operativ-portal/rum/${rows[0].placeId}`);
  revalidatePath("/admin/operativ-portal/koeretoejer");
  revalidatePath("/admin/operativ-portal/soeg");
}
