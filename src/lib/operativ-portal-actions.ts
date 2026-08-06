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
  OPERATIONAL_DOCUMENT_DIRECTORY,
  extractYouTubeId,
  getOperationalDocument
} from "./operativ-portal";
import { prisma } from "./prisma";

const nameSchema = z.string().trim().min(1).max(180);

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
  return admin;
}

export async function createOperationalVehicleAction(formData: FormData) {
  await requireRole(UserRole.ADMIN);
  const parsed = z
    .object({
      name: nameSchema,
      description: z.string().trim().max(3000).default("")
    })
    .safeParse({
      name: formData.get("name"),
      description: String(formData.get("description") ?? "")
    });

  if (!parsed.success) {
    redirect("/admin/operativ-portal/koeretoejer?fejl=Udfyld+navnet+korrekt");
  }

  const id = randomUUID();
  try {
    await prisma.$executeRaw`
      INSERT INTO operational_vehicle (id, name, description)
      VALUES (${id}, ${parsed.data.name}, ${parsed.data.description})
    `;
  } catch {
    redirect("/admin/operativ-portal/koeretoejer?fejl=Køretøjet+findes+allerede");
  }

  await audit("OPERATIONAL_VEHICLE_CREATED", `Køretøjet ${parsed.data.name} blev oprettet i Operativ Portal`);
  revalidatePath("/admin/operativ-portal");
  revalidatePath("/admin/operativ-portal/koeretoejer");
  redirect(`/admin/operativ-portal/koeretoejer/${id}`);
}

export async function updateOperationalVehicleAction(formData: FormData) {
  await requireRole(UserRole.ADMIN);
  const parsed = z
    .object({
      vehicleId: z.string().uuid(),
      name: nameSchema,
      description: z.string().trim().max(3000).default("")
    })
    .safeParse({
      vehicleId: formData.get("vehicleId"),
      name: formData.get("name"),
      description: String(formData.get("description") ?? "")
    });

  if (!parsed.success) return;
  await prisma.$executeRaw`
    UPDATE operational_vehicle
    SET name = ${parsed.data.name}, description = ${parsed.data.description}, updated_at = CURRENT_TIMESTAMP
    WHERE id = ${parsed.data.vehicleId}
  `;
  await audit("OPERATIONAL_VEHICLE_UPDATED", `Køretøjet ${parsed.data.name} blev opdateret`);
  revalidatePath("/admin/operativ-portal");
  revalidatePath("/admin/operativ-portal/koeretoejer");
  revalidatePath(`/admin/operativ-portal/koeretoejer/${parsed.data.vehicleId}`);
}

export async function createOperationalPlaceAction(formData: FormData) {
  await requireRole(UserRole.ADMIN);
  const parsed = z
    .object({ vehicleId: z.string().uuid(), name: nameSchema })
    .safeParse({ vehicleId: formData.get("vehicleId"), name: formData.get("name") });
  if (!parsed.success) return;

  const id = randomUUID();
  await prisma.$executeRaw`
    INSERT INTO operational_place (id, vehicle_id, name)
    VALUES (${id}, ${parsed.data.vehicleId}, ${parsed.data.name})
  `;
  await audit("OPERATIONAL_PLACE_CREATED", `Rummet ${parsed.data.name} blev oprettet`);
  revalidatePath(`/admin/operativ-portal/koeretoejer/${parsed.data.vehicleId}`);
  redirect(`/admin/operativ-portal/rum/${id}`);
}

export async function createOperationalItemAction(formData: FormData) {
  await requireRole(UserRole.ADMIN);
  const parsed = z
    .object({
      placeId: z.string().uuid(),
      name: nameSchema,
      quantity: z.coerce.number().int().min(1).max(999),
      note: z.string().trim().max(1000).default("")
    })
    .safeParse({
      placeId: formData.get("placeId"),
      name: formData.get("name"),
      quantity: formData.get("quantity"),
      note: String(formData.get("note") ?? "")
    });
  if (!parsed.success) return;

  const id = randomUUID();
  await prisma.$executeRaw`
    INSERT INTO operational_item (id, place_id, name, quantity, note)
    VALUES (${id}, ${parsed.data.placeId}, ${parsed.data.name}, ${parsed.data.quantity}, ${parsed.data.note})
  `;
  await audit("OPERATIONAL_ITEM_CREATED", `Udstyret ${parsed.data.name} blev oprettet`);
  revalidatePath(`/admin/operativ-portal/rum/${parsed.data.placeId}`);
  redirect(`/admin/operativ-portal/udstyr/${id}`);
}

export async function createOperationalVideoAction(formData: FormData) {
  await requireRole(UserRole.ADMIN);
  const parsed = z
    .object({
      title: nameSchema,
      description: z.string().trim().max(3000).default(""),
      category: z.string().trim().min(1).max(80),
      youtubeUrl: z.string().trim().min(1).max(500),
      vehicleId: z.string().trim().optional(),
      itemId: z.string().trim().optional()
    })
    .safeParse({
      title: formData.get("title"),
      description: String(formData.get("description") ?? ""),
      category: String(formData.get("category") ?? "Udstyr"),
      youtubeUrl: formData.get("youtubeUrl"),
      vehicleId: String(formData.get("vehicleId") ?? ""),
      itemId: String(formData.get("itemId") ?? "")
    });

  if (!parsed.success) {
    redirect("/admin/operativ-portal/videoer?fejl=Videoen+kunne+ikke+oprettes");
  }

  const youtubeId = extractYouTubeId(parsed.data.youtubeUrl);
  if (!youtubeId) {
    redirect("/admin/operativ-portal/videoer?fejl=YouTube-linket+er+ugyldigt");
  }

  const vehicleId = parsed.data.vehicleId && z.string().uuid().safeParse(parsed.data.vehicleId).success
    ? parsed.data.vehicleId
    : null;
  const itemId = parsed.data.itemId && z.string().uuid().safeParse(parsed.data.itemId).success
    ? parsed.data.itemId
    : null;

  const id = randomUUID();
  await prisma.$executeRaw`
    INSERT INTO operational_video
      (id, vehicle_id, item_id, title, description, category, youtube_url, youtube_id)
    VALUES
      (${id}, ${vehicleId}, ${itemId}, ${parsed.data.title}, ${parsed.data.description},
       ${parsed.data.category}, ${parsed.data.youtubeUrl}, ${youtubeId})
  `;
  await audit("OPERATIONAL_VIDEO_CREATED", `Videoen ${parsed.data.title} blev oprettet`);
  revalidatePath("/admin/operativ-portal");
  revalidatePath("/admin/operativ-portal/videoer");
  if (vehicleId) revalidatePath(`/admin/operativ-portal/koeretoejer/${vehicleId}`);
  if (itemId) revalidatePath(`/admin/operativ-portal/udstyr/${itemId}`);
  redirect(`/admin/operativ-portal/videoer#video-${id}`);
}

export async function deleteOperationalVideoAction(formData: FormData) {
  await requireRole(UserRole.ADMIN);
  const parsed = z.string().uuid().safeParse(formData.get("videoId"));
  if (!parsed.success) return;
  const rows = await prisma.$queryRaw<Array<{ title: string }>>`
    DELETE FROM operational_video WHERE id = ${parsed.data} RETURNING title
  `;
  if (rows[0]) {
    await audit("OPERATIONAL_VIDEO_DELETED", `Videoen ${rows[0].title} blev slettet`);
  }
  revalidatePath("/admin/operativ-portal");
  revalidatePath("/admin/operativ-portal/videoer");
}

export async function deleteOperationalDocumentAction(formData: FormData) {
  await requireRole(UserRole.ADMIN);
  const parsed = z.string().uuid().safeParse(formData.get("documentId"));
  if (!parsed.success) return;
  const document = await getOperationalDocument(parsed.data);
  if (!document) return;

  await prisma.$executeRaw`DELETE FROM operational_document WHERE id = ${parsed.data}`;
  const filePath = path.join(OPERATIONAL_DOCUMENT_DIRECTORY, document.storageName);
  await unlink(filePath).catch(() => undefined);
  await audit("OPERATIONAL_DOCUMENT_DELETED", `Dokumentet ${document.title} blev slettet`);
  revalidatePath("/admin/operativ-portal");
  revalidatePath("/admin/operativ-portal/dokumenter");
  if (document.vehicleId) {
    revalidatePath(`/admin/operativ-portal/koeretoejer/${document.vehicleId}`);
  }
}
