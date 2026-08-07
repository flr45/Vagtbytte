"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { UserRole } from "@prisma/client";
import { z } from "zod";
import { requireRole } from "./auth";
import { prisma } from "./prisma";

const uuidSchema = z.string().uuid();
const optionalUuidSchema = z.union([z.string().uuid(), z.literal("")]).transform((value) => value || null);
const percentSchema = z.coerce.number().min(0).max(100);
const sizeSchema = z.coerce.number().int().min(24).max(96);
const sortSchema = z.coerce.number().int().min(0).max(9999).default(0);

async function audit(action: string, description: string) {
  const admin = await requireRole(UserRole.ADMIN);
  await prisma.auditLog.create({
    data: { actorUserId: admin.id, actorRole: admin.role, action, description }
  });
}

async function getPlaceVehicle(placeId: string) {
  const rows = await prisma.$queryRaw<Array<{ vehicleId: string; placeName: string }>>`
    SELECT vehicle_id AS "vehicleId", name AS "placeName"
    FROM operational_place WHERE id = ${placeId} LIMIT 1
  `;
  return rows[0] ?? null;
}

function revalidateBuilder(placeId: string, vehicleId: string) {
  revalidatePath(`/admin/operativ-portal/rum/${placeId}`);
  revalidatePath(`/admin/operativ-portal/rum/${placeId}/interaktiv`);
  revalidatePath(`/admin/operativ-portal/rum/${placeId}/byg`);
  revalidatePath(`/admin/operativ-portal/koeretoejer/${vehicleId}/administration`);
}

async function validNode(placeId: string, nodeId: string | null) {
  if (!nodeId) return true;
  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM operational_interactive_node
    WHERE id = ${nodeId} AND place_id = ${placeId} LIMIT 1
  `;
  return Boolean(rows[0]);
}

async function validItem(placeId: string, itemId: string) {
  const rows = await prisma.$queryRaw<Array<{ id: string; name: string }>>`
    SELECT id, name FROM operational_item
    WHERE id = ${itemId} AND place_id = ${placeId} LIMIT 1
  `;
  return rows[0] ?? null;
}

type Target = { targetNodeId: string | null; itemId: string | null; targetName: string };

async function resolveTarget(
  placeId: string,
  sourceNodeId: string | null,
  targetType: "item" | "node" | "new-node",
  targetId: string,
  newNodeName: string
): Promise<Target | null> {
  if (targetType === "item") {
    const item = uuidSchema.safeParse(targetId);
    if (!item.success) return null;
    const found = await validItem(placeId, item.data);
    return found ? { targetNodeId: null, itemId: found.id, targetName: found.name } : null;
  }

  if (targetType === "node") {
    const nodeId = uuidSchema.safeParse(targetId);
    if (!nodeId.success || nodeId.data === sourceNodeId) return null;
    const rows = await prisma.$queryRaw<Array<{ id: string; name: string }>>`
      SELECT id, name FROM operational_interactive_node
      WHERE id = ${nodeId.data}
        AND place_id = ${placeId}
        AND parent_node_id IS NOT DISTINCT FROM ${sourceNodeId}
      LIMIT 1
    `;
    return rows[0] ? { targetNodeId: rows[0].id, itemId: null, targetName: rows[0].name } : null;
  }

  const name = newNodeName.trim().slice(0, 120);
  if (!name) return null;
  const id = randomUUID();
  await prisma.$executeRaw`
    INSERT INTO operational_interactive_node (id, place_id, parent_node_id, name, description, sort_order)
    VALUES (${id}, ${placeId}, ${sourceNodeId}, ${name}, '', 0)
  `;
  return { targetNodeId: id, itemId: null, targetName: name };
}

export async function setOperationalInteractiveContextImageAction(formData: FormData) {
  await requireRole(UserRole.ADMIN);
  const parsed = z.object({
    placeId: uuidSchema,
    nodeId: optionalUuidSchema,
    imageId: optionalUuidSchema
  }).safeParse({
    placeId: formData.get("placeId"),
    nodeId: String(formData.get("nodeId") ?? ""),
    imageId: String(formData.get("imageId") ?? "")
  });
  if (!parsed.success) return { ok: false as const, error: "Ugyldig placering." };
  const place = await getPlaceVehicle(parsed.data.placeId);
  if (!place || !(await validNode(parsed.data.placeId, parsed.data.nodeId))) {
    return { ok: false as const, error: "Placeringen findes ikke." };
  }

  if (parsed.data.imageId) {
    const images = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM operational_image
      WHERE id = ${parsed.data.imageId} AND place_id = ${parsed.data.placeId} AND item_id IS NULL
      LIMIT 1
    `;
    if (!images[0]) return { ok: false as const, error: "Billedet hører ikke til rummet." };
  }

  if (parsed.data.nodeId) {
    await prisma.$executeRaw`
      UPDATE operational_interactive_node
      SET image_id = ${parsed.data.imageId}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ${parsed.data.nodeId} AND place_id = ${parsed.data.placeId}
    `;
  } else {
    await prisma.$executeRaw`
      UPDATE operational_place
      SET interactive_image_id = ${parsed.data.imageId}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ${parsed.data.placeId}
    `;
  }

  await audit("OPERATIONAL_INTERACTIVE_IMAGE_SET", `Interaktivt billede blev opdateret i ${place.placeName}`);
  revalidateBuilder(parsed.data.placeId, place.vehicleId);
  return { ok: true as const };
}

export async function createOperationalInteractiveNodeAction(formData: FormData) {
  await requireRole(UserRole.ADMIN);
  const parsed = z.object({
    placeId: uuidSchema,
    parentNodeId: optionalUuidSchema,
    name: z.string().trim().min(1).max(120),
    description: z.string().trim().max(500),
    sortOrder: sortSchema
  }).safeParse({
    placeId: formData.get("placeId"),
    parentNodeId: String(formData.get("parentNodeId") ?? ""),
    name: formData.get("name"),
    description: String(formData.get("description") ?? ""),
    sortOrder: formData.get("sortOrder") ?? 0
  });
  if (!parsed.success) return { ok: false as const, error: "Kontrollér navn og placering." };
  const place = await getPlaceVehicle(parsed.data.placeId);
  if (!place || !(await validNode(parsed.data.placeId, parsed.data.parentNodeId))) {
    return { ok: false as const, error: "Placeringen findes ikke." };
  }

  const id = randomUUID();
  await prisma.$executeRaw`
    INSERT INTO operational_interactive_node
      (id, place_id, parent_node_id, name, description, sort_order)
    VALUES
      (${id}, ${parsed.data.placeId}, ${parsed.data.parentNodeId}, ${parsed.data.name}, ${parsed.data.description}, ${parsed.data.sortOrder})
  `;
  await audit("OPERATIONAL_INTERACTIVE_NODE_CREATED", `Underområdet ${parsed.data.name} blev oprettet i ${place.placeName}`);
  revalidateBuilder(parsed.data.placeId, place.vehicleId);
  return { ok: true as const, id };
}

export async function updateOperationalInteractiveNodeAction(formData: FormData) {
  await requireRole(UserRole.ADMIN);
  const parsed = z.object({
    placeId: uuidSchema,
    nodeId: uuidSchema,
    name: z.string().trim().min(1).max(120),
    description: z.string().trim().max(500),
    sortOrder: sortSchema
  }).safeParse({
    placeId: formData.get("placeId"),
    nodeId: formData.get("nodeId"),
    name: formData.get("name"),
    description: String(formData.get("description") ?? ""),
    sortOrder: formData.get("sortOrder") ?? 0
  });
  if (!parsed.success) return { ok: false as const, error: "Kontrollér felterne." };
  const place = await getPlaceVehicle(parsed.data.placeId);
  if (!place || !(await validNode(parsed.data.placeId, parsed.data.nodeId))) {
    return { ok: false as const, error: "Underområdet findes ikke." };
  }

  await prisma.$executeRaw`
    UPDATE operational_interactive_node
    SET name = ${parsed.data.name}, description = ${parsed.data.description},
      sort_order = ${parsed.data.sortOrder}, updated_at = CURRENT_TIMESTAMP
    WHERE id = ${parsed.data.nodeId} AND place_id = ${parsed.data.placeId}
  `;
  await audit("OPERATIONAL_INTERACTIVE_NODE_UPDATED", `Underområdet ${parsed.data.name} blev opdateret`);
  revalidateBuilder(parsed.data.placeId, place.vehicleId);
  return { ok: true as const };
}

export async function createOperationalInteractiveLinkAction(formData: FormData) {
  await requireRole(UserRole.ADMIN);
  const parsed = z.object({
    placeId: uuidSchema,
    sourceNodeId: optionalUuidSchema,
    targetType: z.enum(["item", "node", "new-node"]),
    targetId: z.string().trim(),
    newNodeName: z.string().trim().max(120),
    label: z.string().trim().max(100),
    xPercent: percentSchema,
    yPercent: percentSchema,
    sizePx: sizeSchema,
    sortOrder: sortSchema
  }).safeParse({
    placeId: formData.get("placeId"),
    sourceNodeId: String(formData.get("sourceNodeId") ?? ""),
    targetType: formData.get("targetType"),
    targetId: String(formData.get("targetId") ?? ""),
    newNodeName: String(formData.get("newNodeName") ?? ""),
    label: String(formData.get("label") ?? ""),
    xPercent: formData.get("xPercent"),
    yPercent: formData.get("yPercent"),
    sizePx: formData.get("sizePx"),
    sortOrder: formData.get("sortOrder") ?? 0
  });
  if (!parsed.success) return { ok: false as const, error: "Kontrollér pluspunktets felter." };
  const place = await getPlaceVehicle(parsed.data.placeId);
  if (!place || !(await validNode(parsed.data.placeId, parsed.data.sourceNodeId))) {
    return { ok: false as const, error: "Placeringen findes ikke." };
  }

  const target = await resolveTarget(
    parsed.data.placeId,
    parsed.data.sourceNodeId,
    parsed.data.targetType,
    parsed.data.targetId,
    parsed.data.newNodeName
  );
  if (!target) return { ok: false as const, error: "Vælg et gyldigt mål." };

  const id = randomUUID();
  await prisma.$executeRaw`
    INSERT INTO operational_interactive_link
      (id, place_id, source_node_id, target_node_id, item_id, label, x_percent, y_percent, size_px, sort_order)
    VALUES
      (${id}, ${parsed.data.placeId}, ${parsed.data.sourceNodeId}, ${target.targetNodeId}, ${target.itemId},
       ${parsed.data.label}, ${parsed.data.xPercent}, ${parsed.data.yPercent}, ${parsed.data.sizePx}, ${parsed.data.sortOrder})
  `;
  await audit("OPERATIONAL_INTERACTIVE_LINK_CREATED", `Pluspunkt til ${target.targetName} blev oprettet i ${place.placeName}`);
  revalidateBuilder(parsed.data.placeId, place.vehicleId);
  return { ok: true as const, id, targetNodeId: target.targetNodeId };
}

export async function updateOperationalInteractiveLinkAction(formData: FormData) {
  await requireRole(UserRole.ADMIN);
  const parsed = z.object({
    linkId: uuidSchema,
    placeId: uuidSchema,
    targetType: z.enum(["item", "node"]),
    targetId: uuidSchema,
    label: z.string().trim().max(100),
    xPercent: percentSchema,
    yPercent: percentSchema,
    sizePx: sizeSchema,
    sortOrder: sortSchema
  }).safeParse({
    linkId: formData.get("linkId"),
    placeId: formData.get("placeId"),
    targetType: formData.get("targetType"),
    targetId: formData.get("targetId"),
    label: String(formData.get("label") ?? ""),
    xPercent: formData.get("xPercent"),
    yPercent: formData.get("yPercent"),
    sizePx: formData.get("sizePx"),
    sortOrder: formData.get("sortOrder") ?? 0
  });
  if (!parsed.success) return { ok: false as const, error: "Kontrollér pluspunktets felter." };
  const place = await getPlaceVehicle(parsed.data.placeId);
  if (!place) return { ok: false as const, error: "Rummet findes ikke." };

  const linkRows = await prisma.$queryRaw<Array<{ sourceNodeId: string | null }>>`
    SELECT source_node_id AS "sourceNodeId"
    FROM operational_interactive_link
    WHERE id = ${parsed.data.linkId} AND place_id = ${parsed.data.placeId} AND deleted_at IS NULL
    LIMIT 1
  `;
  const link = linkRows[0];
  if (!link) return { ok: false as const, error: "Pluspunktet findes ikke længere." };

  const target = await resolveTarget(
    parsed.data.placeId,
    link.sourceNodeId,
    parsed.data.targetType,
    parsed.data.targetId,
    ""
  );
  if (!target) return { ok: false as const, error: "Vælg et mål på det aktuelle niveau." };

  await prisma.$executeRaw`
    UPDATE operational_interactive_link
    SET target_node_id = ${target.targetNodeId}, item_id = ${target.itemId},
      label = ${parsed.data.label}, x_percent = ${parsed.data.xPercent}, y_percent = ${parsed.data.yPercent},
      size_px = ${parsed.data.sizePx}, sort_order = ${parsed.data.sortOrder}, updated_at = CURRENT_TIMESTAMP
    WHERE id = ${parsed.data.linkId} AND place_id = ${parsed.data.placeId} AND deleted_at IS NULL
  `;
  await audit("OPERATIONAL_INTERACTIVE_LINK_UPDATED", `Et pluspunkt blev opdateret til ${target.targetName} i ${place.placeName}`);
  revalidateBuilder(parsed.data.placeId, place.vehicleId);
  return { ok: true as const };
}

export async function moveOperationalInteractiveLinkAction(formData: FormData) {
  await requireRole(UserRole.ADMIN);
  const parsed = z.object({
    linkId: uuidSchema,
    placeId: uuidSchema,
    xPercent: percentSchema,
    yPercent: percentSchema
  }).safeParse({
    linkId: formData.get("linkId"),
    placeId: formData.get("placeId"),
    xPercent: formData.get("xPercent"),
    yPercent: formData.get("yPercent")
  });
  if (!parsed.success) return { ok: false as const, error: "Ugyldig placering." };
  const place = await getPlaceVehicle(parsed.data.placeId);
  if (!place) return { ok: false as const, error: "Rummet findes ikke." };

  await prisma.$executeRaw`
    UPDATE operational_interactive_link
    SET x_percent = ${parsed.data.xPercent}, y_percent = ${parsed.data.yPercent}, updated_at = CURRENT_TIMESTAMP
    WHERE id = ${parsed.data.linkId} AND place_id = ${parsed.data.placeId} AND deleted_at IS NULL
  `;
  revalidateBuilder(parsed.data.placeId, place.vehicleId);
  return { ok: true as const, xPercent: parsed.data.xPercent, yPercent: parsed.data.yPercent };
}

export async function deleteOperationalInteractiveLinkAction(formData: FormData) {
  await requireRole(UserRole.ADMIN);
  const parsed = z.object({ linkId: uuidSchema, placeId: uuidSchema }).safeParse({
    linkId: formData.get("linkId"),
    placeId: formData.get("placeId")
  });
  if (!parsed.success) return { ok: false as const };
  const place = await getPlaceVehicle(parsed.data.placeId);
  if (!place) return { ok: false as const };
  await prisma.$executeRaw`
    UPDATE operational_interactive_link SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
    WHERE id = ${parsed.data.linkId} AND place_id = ${parsed.data.placeId}
  `;
  await audit("OPERATIONAL_INTERACTIVE_LINK_DELETED", `Et pluspunkt blev fjernet fra ${place.placeName}`);
  revalidateBuilder(parsed.data.placeId, place.vehicleId);
  return { ok: true as const };
}

export async function restoreOperationalInteractiveLinkAction(formData: FormData) {
  await requireRole(UserRole.ADMIN);
  const parsed = z.object({ linkId: uuidSchema, placeId: uuidSchema }).safeParse({
    linkId: formData.get("linkId"),
    placeId: formData.get("placeId")
  });
  if (!parsed.success) return { ok: false as const };
  const place = await getPlaceVehicle(parsed.data.placeId);
  if (!place) return { ok: false as const };
  await prisma.$executeRaw`
    UPDATE operational_interactive_link SET deleted_at = NULL, updated_at = CURRENT_TIMESTAMP
    WHERE id = ${parsed.data.linkId} AND place_id = ${parsed.data.placeId}
  `;
  await audit("OPERATIONAL_INTERACTIVE_LINK_RESTORED", `Et pluspunkt blev gendannet i ${place.placeName}`);
  revalidateBuilder(parsed.data.placeId, place.vehicleId);
  return { ok: true as const };
}

export async function cloneOperationalInteractiveNodeAction(formData: FormData) {
  await requireRole(UserRole.ADMIN);
  const parsed = z.object({ placeId: uuidSchema, nodeId: uuidSchema }).safeParse({
    placeId: formData.get("placeId"),
    nodeId: formData.get("nodeId")
  });
  if (!parsed.success) return { ok: false as const, error: "Ugyldigt underområde." };
  const place = await getPlaceVehicle(parsed.data.placeId);
  if (!place) return { ok: false as const, error: "Rummet findes ikke." };

  const nodes = await prisma.$queryRaw<Array<{
    id: string;
    parentNodeId: string | null;
    name: string;
    description: string;
    imageId: string | null;
    sortOrder: number;
  }>>`
    WITH RECURSIVE subtree AS (
      SELECT id, parent_node_id, name, description, image_id, sort_order, created_at
      FROM operational_interactive_node
      WHERE id = ${parsed.data.nodeId} AND place_id = ${parsed.data.placeId}
      UNION ALL
      SELECT child.id, child.parent_node_id, child.name, child.description, child.image_id, child.sort_order, child.created_at
      FROM operational_interactive_node child
      INNER JOIN subtree parent ON child.parent_node_id = parent.id
      WHERE child.place_id = ${parsed.data.placeId}
    )
    SELECT id, parent_node_id AS "parentNodeId", name, COALESCE(description, '') AS description,
      image_id AS "imageId", sort_order AS "sortOrder"
    FROM subtree ORDER BY created_at
  `;
  const sourceRoot = nodes.find((node) => node.id === parsed.data.nodeId);
  if (!sourceRoot) return { ok: false as const, error: "Underområdet findes ikke." };

  const links = await prisma.$queryRaw<Array<{
    id: string;
    sourceNodeId: string;
    targetNodeId: string | null;
    itemId: string | null;
    label: string;
    xPercent: number;
    yPercent: number;
    sizePx: number;
    sortOrder: number;
  }>>`
    WITH RECURSIVE subtree AS (
      SELECT id FROM operational_interactive_node
      WHERE id = ${parsed.data.nodeId} AND place_id = ${parsed.data.placeId}
      UNION ALL
      SELECT child.id
      FROM operational_interactive_node child
      INNER JOIN subtree parent ON child.parent_node_id = parent.id
      WHERE child.place_id = ${parsed.data.placeId}
    )
    SELECT l.id, l.source_node_id AS "sourceNodeId", l.target_node_id AS "targetNodeId", l.item_id AS "itemId",
      COALESCE(l.label, '') AS label, l.x_percent::float8 AS "xPercent", l.y_percent::float8 AS "yPercent",
      l.size_px AS "sizePx", l.sort_order AS "sortOrder"
    FROM operational_interactive_link l
    INNER JOIN subtree source ON source.id = l.source_node_id
    WHERE l.place_id = ${parsed.data.placeId} AND l.deleted_at IS NULL
    ORDER BY l.sort_order, l.created_at
  `;

  const ids = new Map(nodes.map((node) => [node.id, randomUUID()]));
  await prisma.$transaction(async (tx) => {
    for (const node of nodes) {
      const newId = ids.get(node.id)!;
      const parentId = node.id === sourceRoot.id
        ? sourceRoot.parentNodeId
        : node.parentNodeId ? (ids.get(node.parentNodeId) ?? node.parentNodeId) : null;
      const name = node.id === sourceRoot.id ? `Kopi af ${node.name}`.slice(0, 120) : node.name;
      await tx.$executeRaw`
        INSERT INTO operational_interactive_node
          (id, place_id, parent_node_id, name, description, image_id, sort_order)
        VALUES
          (${newId}, ${parsed.data.placeId}, ${parentId}, ${name}, ${node.description}, ${node.imageId},
           ${node.sortOrder + (node.id === sourceRoot.id ? 1 : 0)})
      `;
    }

    for (const link of links) {
      const sourceId = ids.get(link.sourceNodeId);
      if (!sourceId) continue;
      const targetNodeId = link.targetNodeId ? (ids.get(link.targetNodeId) ?? link.targetNodeId) : null;
      await tx.$executeRaw`
        INSERT INTO operational_interactive_link
          (id, place_id, source_node_id, target_node_id, item_id, label, x_percent, y_percent, size_px, sort_order)
        VALUES
          (${randomUUID()}, ${parsed.data.placeId}, ${sourceId}, ${targetNodeId}, ${link.itemId}, ${link.label},
           ${link.xPercent}, ${link.yPercent}, ${link.sizePx}, ${link.sortOrder})
      `;
    }
  });

  const newRootId = ids.get(sourceRoot.id)!;
  await audit("OPERATIONAL_INTERACTIVE_NODE_CLONED", `Underområdet ${sourceRoot.name} og dets interaktive struktur blev klonet`);
  revalidateBuilder(parsed.data.placeId, place.vehicleId);
  return { ok: true as const, id: newRootId };
}
