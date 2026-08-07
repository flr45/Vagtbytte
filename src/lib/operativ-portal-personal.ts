import { prisma } from "./prisma";

export type OperationalTargetType = "vehicle" | "place" | "item";

export type OperationalPersonalEntry = {
  type: OperationalTargetType;
  id: string;
  title: string;
  subtitle: string;
  href: string;
  coverImageId: string | null;
  timestamp: Date;
};

type StoredTarget = {
  targetType: OperationalTargetType;
  targetId: string;
  timestamp: Date;
};

type ResolvedTarget = Omit<OperationalPersonalEntry, "timestamp">;

export function operationalTargetHref(type: OperationalTargetType, id: string) {
  if (type === "vehicle") return `/admin/operativ-portal/koeretoejer/${id}`;
  if (type === "place") return `/admin/operativ-portal/rum/${id}`;
  return `/admin/operativ-portal/udstyr/${id}`;
}

export function operationalTargetTypeLabel(type: OperationalTargetType) {
  if (type === "vehicle") return "Køretøj";
  if (type === "place") return "Rum";
  return "Udstyr";
}

export async function isOperationalFavorite(userId: string, type: OperationalTargetType, id: string) {
  const rows = await prisma.$queryRaw<Array<{ exists: boolean }>>`
    SELECT EXISTS(
      SELECT 1 FROM operational_favorite
      WHERE user_id = ${userId} AND target_type = ${type} AND target_id = ${id}
    ) AS exists
  `;
  return Boolean(rows[0]?.exists);
}

export async function listOperationalFavorites(userId: string, limit = 50): Promise<OperationalPersonalEntry[]> {
  const rows = await prisma.$queryRaw<StoredTarget[]>`
    SELECT target_type AS "targetType", target_id AS "targetId", created_at AS timestamp
    FROM operational_favorite
    WHERE user_id = ${userId}
    ORDER BY created_at DESC
    LIMIT ${Math.max(1, Math.min(limit, 100))}
  `;
  return resolveStoredTargets(rows);
}

export async function listOperationalRecent(userId: string, limit = 8): Promise<OperationalPersonalEntry[]> {
  const rows = await prisma.$queryRaw<StoredTarget[]>`
    SELECT target_type AS "targetType", target_id AS "targetId", last_viewed_at AS timestamp
    FROM operational_recent
    WHERE user_id = ${userId}
    ORDER BY last_viewed_at DESC
    LIMIT ${Math.max(1, Math.min(limit, 25))}
  `;
  return resolveStoredTargets(rows);
}

export async function resolveOperationalTarget(type: OperationalTargetType, id: string): Promise<ResolvedTarget | null> {
  if (type === "vehicle") {
    const rows = await prisma.$queryRaw<Array<{ id: string; name: string; model: string; code: string; coverImageId: string | null }>>`
      SELECT v.id, v.name, COALESCE(v.model, '') AS model, COALESCE(v.code, '') AS code,
        (SELECT image.id FROM operational_image image
         WHERE image.vehicle_id = v.id AND image.place_id IS NULL AND image.item_id IS NULL
         ORDER BY image.is_cover DESC, image.sort_order, image.created_at LIMIT 1) AS "coverImageId"
      FROM operational_vehicle v WHERE v.id = ${id}
    `;
    const row = rows[0];
    if (!row) return null;
    return {
      type,
      id: row.id,
      title: row.name,
      subtitle: [row.code, row.model].filter(Boolean).join(" · ") || "Køretøj",
      href: operationalTargetHref(type, row.id),
      coverImageId: row.coverImageId
    };
  }

  if (type === "place") {
    const rows = await prisma.$queryRaw<Array<{ id: string; name: string; vehicleName: string; coverImageId: string | null }>>`
      SELECT p.id, p.name, v.name AS "vehicleName",
        (SELECT image.id FROM operational_image image
         WHERE image.place_id = p.id AND image.item_id IS NULL
         ORDER BY image.is_cover DESC, image.sort_order, image.created_at LIMIT 1) AS "coverImageId"
      FROM operational_place p
      INNER JOIN operational_vehicle v ON v.id = p.vehicle_id
      WHERE p.id = ${id}
    `;
    const row = rows[0];
    if (!row) return null;
    return {
      type,
      id: row.id,
      title: row.name,
      subtitle: row.vehicleName,
      href: operationalTargetHref(type, row.id),
      coverImageId: row.coverImageId
    };
  }

  const rows = await prisma.$queryRaw<Array<{ id: string; name: string; placeName: string; vehicleName: string; coverImageId: string | null }>>`
    SELECT i.id, i.name, p.name AS "placeName", v.name AS "vehicleName",
      (SELECT image.id FROM operational_image image
       WHERE image.item_id = i.id
       ORDER BY image.is_cover DESC, image.sort_order, image.created_at LIMIT 1) AS "coverImageId"
    FROM operational_item i
    INNER JOIN operational_place p ON p.id = i.place_id
    INNER JOIN operational_vehicle v ON v.id = p.vehicle_id
    WHERE i.id = ${id}
  `;
  const row = rows[0];
  if (!row) return null;
  return {
    type,
    id: row.id,
    title: row.name,
    subtitle: `${row.vehicleName} · ${row.placeName}`,
    href: operationalTargetHref(type, row.id),
    coverImageId: row.coverImageId
  };
}

async function resolveStoredTargets(rows: StoredTarget[]) {
  const resolved = await Promise.all(rows.map(async (row) => {
    const target = await resolveOperationalTarget(row.targetType, row.targetId);
    return target ? { ...target, timestamp: row.timestamp } : null;
  }));
  return resolved.filter((entry): entry is OperationalPersonalEntry => Boolean(entry));
}
