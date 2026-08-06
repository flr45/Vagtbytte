import { prisma } from "./prisma";

export const OPERATIONAL_DOCUMENT_CATEGORIES = [
  "Instruks",
  "Manual",
  "SOP",
  "Kontrolskema",
  "Pakkeliste",
  "Billede",
  "Andet"
] as const;

export const OPERATIONAL_VIDEO_CATEGORIES = [
  "Køretøj",
  "Udstyr",
  "Procedure",
  "Sikkerhed",
  "Vedligehold"
] as const;

export type OperationalVehicleOption = { id: string; name: string };
export type OperationalPlaceOption = {
  id: string;
  name: string;
  vehicleId: string;
  vehicleName: string;
};
export type OperationalItemOption = {
  id: string;
  name: string;
  placeId: string;
  placeName: string;
  vehicleId: string;
  vehicleName: string;
};

export type OperationalTargets = {
  vehicleId: string | null;
  placeId: string | null;
  itemId: string | null;
};

export type ManagedOperationalDocument = {
  id: string;
  vehicleId: string | null;
  vehicleName: string | null;
  placeId: string | null;
  placeName: string | null;
  itemId: string | null;
  itemName: string | null;
  title: string;
  description: string;
  category: string;
  originalName: string;
  storageName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: Date;
  updatedAt: Date;
};

export type ManagedOperationalVideo = {
  id: string;
  vehicleId: string | null;
  vehicleName: string | null;
  placeId: string | null;
  placeName: string | null;
  itemId: string | null;
  itemName: string | null;
  title: string;
  description: string;
  category: string;
  youtubeUrl: string;
  youtubeId: string;
  sortOrder: number;
  createdAt: Date;
};

export async function resolveOperationalTargets(input: {
  vehicleId?: string | null;
  placeId?: string | null;
  itemId?: string | null;
}): Promise<OperationalTargets | null> {
  if (input.itemId) {
    const rows = await prisma.$queryRaw<OperationalTargets[]>`
      SELECT v.id AS "vehicleId", p.id AS "placeId", i.id AS "itemId"
      FROM operational_item i
      INNER JOIN operational_place p ON p.id = i.place_id
      INNER JOIN operational_vehicle v ON v.id = p.vehicle_id
      WHERE i.id = ${input.itemId}
    `;
    return rows[0] ?? null;
  }

  if (input.placeId) {
    const rows = await prisma.$queryRaw<OperationalTargets[]>`
      SELECT v.id AS "vehicleId", p.id AS "placeId", NULL::text AS "itemId"
      FROM operational_place p
      INNER JOIN operational_vehicle v ON v.id = p.vehicle_id
      WHERE p.id = ${input.placeId}
    `;
    return rows[0] ?? null;
  }

  if (input.vehicleId) {
    const rows = await prisma.$queryRaw<OperationalTargets[]>`
      SELECT id AS "vehicleId", NULL::text AS "placeId", NULL::text AS "itemId"
      FROM operational_vehicle
      WHERE id = ${input.vehicleId}
    `;
    return rows[0] ?? null;
  }

  return { vehicleId: null, placeId: null, itemId: null };
}

export async function listOperationalContentOptions() {
  const [vehicles, places, items] = await Promise.all([
    prisma.$queryRaw<OperationalVehicleOption[]>`
      SELECT id, name FROM operational_vehicle ORDER BY sort_order, name
    `,
    prisma.$queryRaw<OperationalPlaceOption[]>`
      SELECT p.id, p.name, v.id AS "vehicleId", v.name AS "vehicleName"
      FROM operational_place p
      INNER JOIN operational_vehicle v ON v.id = p.vehicle_id
      ORDER BY v.sort_order, v.name, p.sort_order, p.name
    `,
    prisma.$queryRaw<OperationalItemOption[]>`
      SELECT i.id, i.name, p.id AS "placeId", p.name AS "placeName",
             v.id AS "vehicleId", v.name AS "vehicleName"
      FROM operational_item i
      INNER JOIN operational_place p ON p.id = i.place_id
      INNER JOIN operational_vehicle v ON v.id = p.vehicle_id
      ORDER BY v.sort_order, v.name, p.sort_order, p.name, i.sort_order, i.name
    `
  ]);
  return { vehicles, places, items };
}

export async function listManagedOperationalDocuments(): Promise<ManagedOperationalDocument[]> {
  return prisma.$queryRaw<ManagedOperationalDocument[]>`
    SELECT d.id, d.vehicle_id AS "vehicleId", v.name AS "vehicleName",
           d.place_id AS "placeId", p.name AS "placeName",
           d.item_id AS "itemId", i.name AS "itemName", d.title,
           COALESCE(d.description, '') AS description, d.category,
           d.original_name AS "originalName", d.storage_name AS "storageName",
           d.mime_type AS "mimeType", d.size_bytes AS "sizeBytes",
           d.created_at AS "createdAt", d.updated_at AS "updatedAt"
    FROM operational_document d
    LEFT JOIN operational_vehicle v ON v.id = d.vehicle_id
    LEFT JOIN operational_place p ON p.id = d.place_id
    LEFT JOIN operational_item i ON i.id = d.item_id
    ORDER BY d.created_at DESC
  `;
}

export async function getManagedOperationalDocument(id: string) {
  const rows = await prisma.$queryRaw<ManagedOperationalDocument[]>`
    SELECT d.id, d.vehicle_id AS "vehicleId", v.name AS "vehicleName",
           d.place_id AS "placeId", p.name AS "placeName",
           d.item_id AS "itemId", i.name AS "itemName", d.title,
           COALESCE(d.description, '') AS description, d.category,
           d.original_name AS "originalName", d.storage_name AS "storageName",
           d.mime_type AS "mimeType", d.size_bytes AS "sizeBytes",
           d.created_at AS "createdAt", d.updated_at AS "updatedAt"
    FROM operational_document d
    LEFT JOIN operational_vehicle v ON v.id = d.vehicle_id
    LEFT JOIN operational_place p ON p.id = d.place_id
    LEFT JOIN operational_item i ON i.id = d.item_id
    WHERE d.id = ${id}
  `;
  return rows[0] ?? null;
}

export async function listManagedOperationalVideos(): Promise<ManagedOperationalVideo[]> {
  return prisma.$queryRaw<ManagedOperationalVideo[]>`
    SELECT video.id, video.vehicle_id AS "vehicleId", v.name AS "vehicleName",
           video.place_id AS "placeId", p.name AS "placeName",
           video.item_id AS "itemId", i.name AS "itemName", video.title,
           COALESCE(video.description, '') AS description, video.category,
           video.youtube_url AS "youtubeUrl", video.youtube_id AS "youtubeId",
           video.sort_order AS "sortOrder", video.created_at AS "createdAt"
    FROM operational_video video
    LEFT JOIN operational_vehicle v ON v.id = video.vehicle_id
    LEFT JOIN operational_place p ON p.id = video.place_id
    LEFT JOIN operational_item i ON i.id = video.item_id
    ORDER BY video.sort_order, video.created_at DESC
  `;
}

export function contentLocationLabel(input: {
  vehicleName?: string | null;
  placeName?: string | null;
  itemName?: string | null;
}) {
  return [input.vehicleName, input.placeName, input.itemName].filter(Boolean).join(" · ") || "Generelt";
}
