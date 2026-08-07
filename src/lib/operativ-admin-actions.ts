"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { UserRole } from "@prisma/client";
import { z } from "zod";
import { requireRole } from "./auth";
import { copyName, hasExactIdSet } from "./operativ-admin-utils";
import { prisma } from "./prisma";

const uuidSchema = z.string().uuid();
const uuidArraySchema = z.array(uuidSchema).min(1).max(500);

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
  revalidatePath(`/admin/operativ-portal/koeretoejer/${vehicleId}/administration`);
  revalidatePath(`/admin/operativ-portal/koeretoejer/${vehicleId}/interaktiv`);
  revalidatePath("/admin/operativ-portal/soeg");
}

export async function saveOperationalRoomOrderAction(vehicleIdInput: string, orderedIdsInput: string[]) {
  await requireRole(UserRole.ADMIN);
  const vehicleId = uuidSchema.safeParse(vehicleIdInput);
  const orderedIds = uuidArraySchema.safeParse(orderedIdsInput);
  if (!vehicleId.success || !orderedIds.success) return { ok: false, error: "Rækkefølgen er ugyldig." };

  const rooms = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM operational_place
    WHERE vehicle_id = ${vehicleId.data}
    ORDER BY sort_order, name
  `;
  const currentIds = rooms.map((room) => room.id);
  if (!hasExactIdSet(currentIds, orderedIds.data)) {
    return { ok: false, error: "Rumlisten er ændret. Genindlæs siden og prøv igen." };
  }

  await prisma.$transaction(async (tx) => {
    for (const [index, id] of orderedIds.data.entries()) {
      await tx.$executeRaw`
        UPDATE operational_place
        SET sort_order = ${index}, updated_at = CURRENT_TIMESTAMP
        WHERE id = ${id} AND vehicle_id = ${vehicleId.data}
      `;
    }
  });
  await audit("OPERATIONAL_ROOMS_REORDERED", `Rækkefølgen på ${orderedIds.data.length} rum blev ændret`);
  revalidateVehicle(vehicleId.data);
  return { ok: true };
}

export async function saveOperationalItemOrderAction(placeIdInput: string, orderedIdsInput: string[]) {
  await requireRole(UserRole.ADMIN);
  const placeId = uuidSchema.safeParse(placeIdInput);
  const orderedIds = uuidArraySchema.safeParse(orderedIdsInput);
  if (!placeId.success || !orderedIds.success) return { ok: false, error: "Rækkefølgen er ugyldig." };

  const placeRows = await prisma.$queryRaw<Array<{ vehicleId: string }>>`
    SELECT vehicle_id AS "vehicleId" FROM operational_place WHERE id = ${placeId.data} LIMIT 1
  `;
  const place = placeRows[0];
  if (!place) return { ok: false, error: "Rummet blev ikke fundet." };

  const items = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM operational_item
    WHERE place_id = ${placeId.data}
    ORDER BY sort_order, name
  `;
  const currentIds = items.map((item) => item.id);
  if (!hasExactIdSet(currentIds, orderedIds.data)) {
    return { ok: false, error: "Udstyrslisten er ændret. Genindlæs siden og prøv igen." };
  }

  await prisma.$transaction(async (tx) => {
    for (const [index, id] of orderedIds.data.entries()) {
      await tx.$executeRaw`
        UPDATE operational_item
        SET sort_order = ${index}, updated_at = CURRENT_TIMESTAMP
        WHERE id = ${id} AND place_id = ${placeId.data}
      `;
    }
  });
  await audit("OPERATIONAL_ITEMS_REORDERED", `Rækkefølgen på ${orderedIds.data.length} udstyrsposter blev ændret`);
  revalidatePath(`/admin/operativ-portal/rum/${placeId.data}`);
  revalidatePath(`/admin/operativ-portal/rum/${placeId.data}/interaktiv`);
  revalidateVehicle(place.vehicleId);
  return { ok: true };
}

export async function moveOperationalItemsAction(itemIdsInput: string[], targetPlaceIdInput: string) {
  await requireRole(UserRole.ADMIN);
  const itemIds = uuidArraySchema.safeParse(itemIdsInput);
  const targetPlaceId = uuidSchema.safeParse(targetPlaceIdInput);
  if (!itemIds.success || !targetPlaceId.success) return { ok: false, error: "Flytningen er ugyldig." };
  if (new Set(itemIds.data).size !== itemIds.data.length) return { ok: false, error: "Udstyrslisten indeholder dubletter." };

  const targetRows = await prisma.$queryRaw<Array<{ vehicleId: string; name: string }>>`
    SELECT vehicle_id AS "vehicleId", name FROM operational_place
    WHERE id = ${targetPlaceId.data}
    LIMIT 1
  `;
  const target = targetRows[0];
  if (!target) return { ok: false, error: "Målrummet blev ikke fundet." };

  const sourceItems = await prisma.$queryRaw<Array<{ id: string; placeId: string; vehicleId: string }>>`
    SELECT i.id, i.place_id AS "placeId", p.vehicle_id AS "vehicleId"
    FROM operational_item i
    INNER JOIN operational_place p ON p.id = i.place_id
    WHERE i.id = ANY(${itemIds.data}::text[])
  `;
  if (sourceItems.length !== itemIds.data.length || sourceItems.some((item) => item.vehicleId !== target.vehicleId)) {
    return { ok: false, error: "Udstyr kan kun flyttes mellem rum på samme køretøj." };
  }

  const countRows = await prisma.$queryRaw<Array<{ count: number }>>`
    SELECT COUNT(*)::int AS count FROM operational_item WHERE place_id = ${targetPlaceId.data}
  `;
  let nextSort = countRows[0]?.count ?? 0;
  const sourcePlaceIds = [...new Set(sourceItems.map((item) => item.placeId))];

  await prisma.$transaction(async (tx) => {
    for (const itemId of itemIds.data) {
      await tx.$executeRaw`DELETE FROM operational_place_hotspot WHERE item_id = ${itemId}`;
      await tx.$executeRaw`
        UPDATE operational_item
        SET place_id = ${targetPlaceId.data}, sort_order = ${nextSort++}, updated_at = CURRENT_TIMESTAMP
        WHERE id = ${itemId}
      `;
    }
  });

  await audit("OPERATIONAL_ITEMS_MOVED", `${itemIds.data.length} udstyrsposter blev flyttet til ${target.name}`);
  for (const sourcePlaceId of sourcePlaceIds) {
    revalidatePath(`/admin/operativ-portal/rum/${sourcePlaceId}`);
    revalidatePath(`/admin/operativ-portal/rum/${sourcePlaceId}/interaktiv`);
  }
  revalidatePath(`/admin/operativ-portal/rum/${targetPlaceId.data}`);
  revalidatePath(`/admin/operativ-portal/rum/${targetPlaceId.data}/interaktiv`);
  revalidateVehicle(target.vehicleId);
  return { ok: true };
}

export async function cloneOperationalItemAction(itemIdInput: string) {
  await requireRole(UserRole.ADMIN);
  const itemId = uuidSchema.safeParse(itemIdInput);
  if (!itemId.success) return { ok: false, error: "Udstyret er ugyldigt." };

  const rows = await prisma.$queryRaw<Array<{
    id: string;
    placeId: string;
    vehicleId: string;
    name: string;
    quantity: number;
    note: string;
    specifications: string;
  }>>`
    SELECT i.id, i.place_id AS "placeId", p.vehicle_id AS "vehicleId", i.name, i.quantity,
      COALESCE(i.note, '') AS note, COALESCE(i.specifications, '') AS specifications
    FROM operational_item i
    INNER JOIN operational_place p ON p.id = i.place_id
    WHERE i.id = ${itemId.data}
    LIMIT 1
  `;
  const item = rows[0];
  if (!item) return { ok: false, error: "Udstyret blev ikke fundet." };

  const orderRows = await prisma.$queryRaw<Array<{ nextOrder: number }>>`
    SELECT COALESCE(MAX(sort_order), -1)::int + 1 AS "nextOrder"
    FROM operational_item WHERE place_id = ${item.placeId}
  `;
  const newId = randomUUID();
  const newName = copyName(item.name);
  await prisma.$executeRaw`
    INSERT INTO operational_item (id, place_id, name, quantity, note, specifications, sort_order)
    VALUES (${newId}, ${item.placeId}, ${newName}, ${item.quantity}, ${item.note}, ${item.specifications}, ${orderRows[0]?.nextOrder ?? 0})
  `;
  await audit("OPERATIONAL_ITEM_CLONED", `Udstyret ${item.name} blev kopieret som ${newName}`);
  revalidatePath(`/admin/operativ-portal/rum/${item.placeId}`);
  revalidateVehicle(item.vehicleId);
  return { ok: true, newId };
}

export async function cloneOperationalRoomAction(roomIdInput: string, includeItems = true) {
  await requireRole(UserRole.ADMIN);
  const roomId = uuidSchema.safeParse(roomIdInput);
  if (!roomId.success) return { ok: false, error: "Rummet er ugyldigt." };

  const rows = await prisma.$queryRaw<Array<{
    id: string;
    vehicleId: string;
    name: string;
    description: string;
  }>>`
    SELECT id, vehicle_id AS "vehicleId", name, COALESCE(description, '') AS description
    FROM operational_place WHERE id = ${roomId.data} LIMIT 1
  `;
  const room = rows[0];
  if (!room) return { ok: false, error: "Rummet blev ikke fundet." };

  const orderRows = await prisma.$queryRaw<Array<{ nextOrder: number }>>`
    SELECT COALESCE(MAX(sort_order), -1)::int + 1 AS "nextOrder"
    FROM operational_place WHERE vehicle_id = ${room.vehicleId}
  `;
  const items = includeItems
    ? await prisma.$queryRaw<Array<{ name: string; quantity: number; note: string; specifications: string; sortOrder: number }>>`
        SELECT name, quantity, COALESCE(note, '') AS note, COALESCE(specifications, '') AS specifications,
          sort_order AS "sortOrder"
        FROM operational_item WHERE place_id = ${room.id}
        ORDER BY sort_order, name
      `
    : [];

  const newRoomId = randomUUID();
  const newName = copyName(room.name);
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      INSERT INTO operational_place (id, vehicle_id, name, description, sort_order)
      VALUES (${newRoomId}, ${room.vehicleId}, ${newName}, ${room.description}, ${orderRows[0]?.nextOrder ?? 0})
    `;
    for (const item of items) {
      await tx.$executeRaw`
        INSERT INTO operational_item (id, place_id, name, quantity, note, specifications, sort_order)
        VALUES (${randomUUID()}, ${newRoomId}, ${item.name}, ${item.quantity}, ${item.note}, ${item.specifications}, ${item.sortOrder})
      `;
    }
  });

  await audit("OPERATIONAL_ROOM_CLONED", `Rummet ${room.name} blev kopieret som ${newName}${includeItems ? " med udstyr" : ""}`);
  revalidateVehicle(room.vehicleId);
  return { ok: true, newId: newRoomId };
}
