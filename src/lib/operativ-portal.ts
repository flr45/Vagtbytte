import path from "node:path";
import { prisma } from "./prisma";

export type OperationalStats = {
  vehicles: number;
  places: number;
  items: number;
  documents: number;
  videos: number;
  images: number;
};

export type OperationalVehicleSummary = {
  id: string;
  name: string;
  description: string;
  placeCount: number;
  itemCount: number;
  documentCount: number;
  videoCount: number;
  imageCount: number;
  coverImageId: string | null;
};

export type OperationalPlaceSummary = {
  id: string;
  vehicleId: string;
  name: string;
  sortOrder: number;
  itemCount: number;
  imageCount: number;
  coverImageId: string | null;
};

export type OperationalItemSummary = {
  id: string;
  placeId: string;
  name: string;
  quantity: number;
  note: string;
  sortOrder: number;
  imageCount: number;
  coverImageId: string | null;
};

export type OperationalImage = {
  id: string;
  vehicleId: string;
  placeId: string | null;
  itemId: string | null;
  title: string;
  altText: string;
  originalName: string;
  storageName: string;
  mimeType: string;
  sizeBytes: number;
  isCover: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
};

export type OperationalDocument = {
  id: string;
  vehicleId: string | null;
  vehicleName: string | null;
  title: string;
  originalName: string;
  storageName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: Date;
};

export type OperationalVideo = {
  id: string;
  vehicleId: string | null;
  vehicleName: string | null;
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

export type OperationalVehicleDetail = OperationalVehicleSummary & {
  places: OperationalPlaceSummary[];
  documents: OperationalDocument[];
  videos: OperationalVideo[];
  images: OperationalImage[];
};

export type OperationalPlaceDetail = {
  id: string;
  vehicleId: string;
  vehicleName: string;
  name: string;
  coverImageId: string | null;
  images: OperationalImage[];
  items: OperationalItemSummary[];
};

export type OperationalItemDetail = OperationalItemSummary & {
  placeName: string;
  vehicleId: string;
  vehicleName: string;
  videos: OperationalVideo[];
  images: OperationalImage[];
};

export const OPERATIONAL_STORAGE_ROOT =
  process.env.OPERATIV_PORTAL_DATA_DIRECTORY?.trim() || "/data/operativ-portal";
export const OPERATIONAL_DOCUMENT_DIRECTORY = path.join(OPERATIONAL_STORAGE_ROOT, "documents");
export const OPERATIONAL_IMAGE_DIRECTORY = path.join(OPERATIONAL_STORAGE_ROOT, "images");
export const MAX_OPERATIONAL_DOCUMENT_BYTES = 25 * 1024 * 1024;
export const MAX_OPERATIONAL_IMAGE_BYTES = 12 * 1024 * 1024;

export const ALLOWED_OPERATIONAL_DOCUMENT_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/jpeg",
  "image/png",
  "image/webp"
]);

export const ALLOWED_OPERATIONAL_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp"
]);

export function extractYouTubeId(value: string) {
  const input = value.trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(input)) return input;

  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return null;
  }

  const hostname = url.hostname.toLowerCase().replace(/^www\./, "");
  let candidate = "";
  if (hostname === "youtu.be") {
    candidate = url.pathname.split("/").filter(Boolean)[0] ?? "";
  } else if (hostname === "youtube.com" || hostname === "m.youtube.com") {
    if (url.pathname === "/watch") {
      candidate = url.searchParams.get("v") ?? "";
    } else {
      const parts = url.pathname.split("/").filter(Boolean);
      if (["embed", "shorts", "live"].includes(parts[0] ?? "")) candidate = parts[1] ?? "";
    }
  }
  return /^[A-Za-z0-9_-]{11}$/.test(candidate) ? candidate : null;
}

export function youtubeEmbedUrl(youtubeId: string) {
  return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(youtubeId)}`;
}

export function operationalImageUrl(imageId: string) {
  return `/api/admin/operativ-portal/billeder/${encodeURIComponent(imageId)}`;
}

export function safeOriginalFileName(value: string) {
  const normalized = path.basename(value || "dokument").replace(/[\u0000-\u001f\u007f]/g, "").trim();
  return normalized.slice(0, 240) || "dokument";
}

export function imageExtensionForMimeType(mimeType: string) {
  if (mimeType === "image/jpeg") return ".jpg";
  if (mimeType === "image/png") return ".png";
  if (mimeType === "image/webp") return ".webp";
  return null;
}

const imageColumns = `
  image.id, image.vehicle_id AS "vehicleId", image.place_id AS "placeId",
  image.item_id AS "itemId", image.title, image.alt_text AS "altText",
  image.original_name AS "originalName", image.storage_name AS "storageName",
  image.mime_type AS "mimeType", image.size_bytes AS "sizeBytes",
  image.is_cover AS "isCover", image.sort_order AS "sortOrder",
  image.created_at AS "createdAt", image.updated_at AS "updatedAt"
`;

export async function getOperationalStats(): Promise<OperationalStats> {
  const rows = await prisma.$queryRaw<OperationalStats[]>`
    SELECT
      (SELECT COUNT(*)::int FROM operational_vehicle) AS vehicles,
      (SELECT COUNT(*)::int FROM operational_place) AS places,
      (SELECT COUNT(*)::int FROM operational_item) AS items,
      (SELECT COUNT(*)::int FROM operational_document) AS documents,
      (SELECT COUNT(*)::int FROM operational_video) AS videos,
      (SELECT COUNT(*)::int FROM operational_image) AS images
  `;
  return rows[0] ?? { vehicles: 0, places: 0, items: 0, documents: 0, videos: 0, images: 0 };
}

export async function listOperationalVehicles(): Promise<OperationalVehicleSummary[]> {
  return prisma.$queryRaw<OperationalVehicleSummary[]>`
    SELECT v.id, v.name, COALESCE(v.description, '') AS description,
      COUNT(DISTINCT p.id)::int AS "placeCount",
      COUNT(DISTINCT i.id)::int AS "itemCount",
      COUNT(DISTINCT d.id)::int AS "documentCount",
      COUNT(DISTINCT video.id)::int AS "videoCount",
      COUNT(DISTINCT image.id)::int AS "imageCount",
      (SELECT cover.id FROM operational_image cover
       WHERE cover.vehicle_id = v.id AND cover.place_id IS NULL AND cover.item_id IS NULL
       ORDER BY cover.is_cover DESC, cover.sort_order, cover.created_at LIMIT 1) AS "coverImageId"
    FROM operational_vehicle v
    LEFT JOIN operational_place p ON p.vehicle_id = v.id
    LEFT JOIN operational_item i ON i.place_id = p.id
    LEFT JOIN operational_document d ON d.vehicle_id = v.id
    LEFT JOIN operational_video video ON video.vehicle_id = v.id
    LEFT JOIN operational_image image ON image.vehicle_id = v.id
    GROUP BY v.id, v.name, v.description, v.sort_order
    ORDER BY v.sort_order, v.name
  `;
}

export async function getOperationalVehicle(id: string): Promise<OperationalVehicleDetail | null> {
  const vehicles = await prisma.$queryRaw<OperationalVehicleSummary[]>`
    SELECT v.id, v.name, COALESCE(v.description, '') AS description,
      COUNT(DISTINCT p.id)::int AS "placeCount",
      COUNT(DISTINCT i.id)::int AS "itemCount",
      COUNT(DISTINCT d.id)::int AS "documentCount",
      COUNT(DISTINCT video.id)::int AS "videoCount",
      COUNT(DISTINCT image.id)::int AS "imageCount",
      (SELECT cover.id FROM operational_image cover
       WHERE cover.vehicle_id = v.id AND cover.place_id IS NULL AND cover.item_id IS NULL
       ORDER BY cover.is_cover DESC, cover.sort_order, cover.created_at LIMIT 1) AS "coverImageId"
    FROM operational_vehicle v
    LEFT JOIN operational_place p ON p.vehicle_id = v.id
    LEFT JOIN operational_item i ON i.place_id = p.id
    LEFT JOIN operational_document d ON d.vehicle_id = v.id
    LEFT JOIN operational_video video ON video.vehicle_id = v.id
    LEFT JOIN operational_image image ON image.vehicle_id = v.id
    WHERE v.id = ${id}
    GROUP BY v.id, v.name, v.description, v.sort_order
  `;
  const vehicle = vehicles[0];
  if (!vehicle) return null;

  const [places, documents, videos, images] = await Promise.all([
    prisma.$queryRaw<OperationalPlaceSummary[]>`
      SELECT p.id, p.vehicle_id AS "vehicleId", p.name, p.sort_order AS "sortOrder",
        COUNT(DISTINCT i.id)::int AS "itemCount",
        COUNT(DISTINCT image.id)::int AS "imageCount",
        (SELECT cover.id FROM operational_image cover
         WHERE cover.place_id = p.id AND cover.item_id IS NULL
         ORDER BY cover.is_cover DESC, cover.sort_order, cover.created_at LIMIT 1) AS "coverImageId"
      FROM operational_place p
      LEFT JOIN operational_item i ON i.place_id = p.id
      LEFT JOIN operational_image image ON image.place_id = p.id AND image.item_id IS NULL
      WHERE p.vehicle_id = ${id}
      GROUP BY p.id, p.vehicle_id, p.name, p.sort_order
      ORDER BY p.sort_order, p.name
    `,
    prisma.$queryRaw<OperationalDocument[]>`
      SELECT d.id, d.vehicle_id AS "vehicleId", v.name AS "vehicleName", d.title,
        d.original_name AS "originalName", d.storage_name AS "storageName",
        d.mime_type AS "mimeType", d.size_bytes AS "sizeBytes", d.created_at AS "createdAt"
      FROM operational_document d LEFT JOIN operational_vehicle v ON v.id = d.vehicle_id
      WHERE d.vehicle_id = ${id} ORDER BY d.created_at DESC
    `,
    prisma.$queryRaw<OperationalVideo[]>`
      SELECT video.id, video.vehicle_id AS "vehicleId", v.name AS "vehicleName",
        video.item_id AS "itemId", i.name AS "itemName", video.title,
        COALESCE(video.description, '') AS description, video.category,
        video.youtube_url AS "youtubeUrl", video.youtube_id AS "youtubeId",
        video.sort_order AS "sortOrder", video.created_at AS "createdAt"
      FROM operational_video video
      LEFT JOIN operational_vehicle v ON v.id = video.vehicle_id
      LEFT JOIN operational_item i ON i.id = video.item_id
      WHERE video.vehicle_id = ${id} ORDER BY video.sort_order, video.created_at DESC
    `,
    listOperationalImagesForVehicle(id)
  ]);
  return { ...vehicle, places, documents, videos, images };
}

export async function getOperationalPlace(id: string): Promise<OperationalPlaceDetail | null> {
  const places = await prisma.$queryRaw<Array<{ id: string; vehicleId: string; vehicleName: string; name: string; coverImageId: string | null }>>`
    SELECT p.id, p.vehicle_id AS "vehicleId", v.name AS "vehicleName", p.name,
      (SELECT cover.id FROM operational_image cover
       WHERE cover.place_id = p.id AND cover.item_id IS NULL
       ORDER BY cover.is_cover DESC, cover.sort_order, cover.created_at LIMIT 1) AS "coverImageId"
    FROM operational_place p INNER JOIN operational_vehicle v ON v.id = p.vehicle_id
    WHERE p.id = ${id}
  `;
  const place = places[0];
  if (!place) return null;

  const [items, images] = await Promise.all([
    prisma.$queryRaw<OperationalItemSummary[]>`
      SELECT i.id, i.place_id AS "placeId", i.name, i.quantity,
        COALESCE(i.note, '') AS note, i.sort_order AS "sortOrder",
        (SELECT COUNT(*)::int FROM operational_image image WHERE image.item_id = i.id) AS "imageCount",
        (SELECT cover.id FROM operational_image cover WHERE cover.item_id = i.id
         ORDER BY cover.is_cover DESC, cover.sort_order, cover.created_at LIMIT 1) AS "coverImageId"
      FROM operational_item i WHERE i.place_id = ${id}
      ORDER BY i.sort_order, i.name
    `,
    listOperationalImagesForPlace(id)
  ]);
  return { ...place, items, images };
}

export async function getOperationalItem(id: string): Promise<OperationalItemDetail | null> {
  const items = await prisma.$queryRaw<Array<OperationalItemSummary & { placeName: string; vehicleId: string; vehicleName: string }>>`
    SELECT i.id, i.place_id AS "placeId", i.name, i.quantity,
      COALESCE(i.note, '') AS note, i.sort_order AS "sortOrder",
      p.name AS "placeName", v.id AS "vehicleId", v.name AS "vehicleName",
      (SELECT COUNT(*)::int FROM operational_image image WHERE image.item_id = i.id) AS "imageCount",
      (SELECT cover.id FROM operational_image cover WHERE cover.item_id = i.id
       ORDER BY cover.is_cover DESC, cover.sort_order, cover.created_at LIMIT 1) AS "coverImageId"
    FROM operational_item i
    INNER JOIN operational_place p ON p.id = i.place_id
    INNER JOIN operational_vehicle v ON v.id = p.vehicle_id
    WHERE i.id = ${id}
  `;
  const item = items[0];
  if (!item) return null;

  const [videos, images] = await Promise.all([
    prisma.$queryRaw<OperationalVideo[]>`
      SELECT video.id, video.vehicle_id AS "vehicleId", v.name AS "vehicleName",
        video.item_id AS "itemId", i.name AS "itemName", video.title,
        COALESCE(video.description, '') AS description, video.category,
        video.youtube_url AS "youtubeUrl", video.youtube_id AS "youtubeId",
        video.sort_order AS "sortOrder", video.created_at AS "createdAt"
      FROM operational_video video
      LEFT JOIN operational_vehicle v ON v.id = video.vehicle_id
      LEFT JOIN operational_item i ON i.id = video.item_id
      WHERE video.item_id = ${id} ORDER BY video.sort_order, video.created_at DESC
    `,
    listOperationalImagesForItem(id)
  ]);
  return { ...item, videos, images };
}

export async function listOperationalImagesForVehicle(vehicleId: string): Promise<OperationalImage[]> {
  return prisma.$queryRawUnsafe<OperationalImage[]>(
    `SELECT ${imageColumns} FROM operational_image image
     WHERE image.vehicle_id = $1 AND image.place_id IS NULL AND image.item_id IS NULL
     ORDER BY image.is_cover DESC, image.sort_order, image.created_at`,
    vehicleId
  );
}

export async function listOperationalImagesForPlace(placeId: string): Promise<OperationalImage[]> {
  return prisma.$queryRawUnsafe<OperationalImage[]>(
    `SELECT ${imageColumns} FROM operational_image image
     WHERE image.place_id = $1 AND image.item_id IS NULL
     ORDER BY image.is_cover DESC, image.sort_order, image.created_at`,
    placeId
  );
}

export async function listOperationalImagesForItem(itemId: string): Promise<OperationalImage[]> {
  return prisma.$queryRawUnsafe<OperationalImage[]>(
    `SELECT ${imageColumns} FROM operational_image image
     WHERE image.item_id = $1
     ORDER BY image.is_cover DESC, image.sort_order, image.created_at`,
    itemId
  );
}

export async function getOperationalImage(id: string): Promise<OperationalImage | null> {
  const rows = await prisma.$queryRawUnsafe<OperationalImage[]>(
    `SELECT ${imageColumns} FROM operational_image image WHERE image.id = $1`,
    id
  );
  return rows[0] ?? null;
}

export async function listOperationalDocuments(): Promise<OperationalDocument[]> {
  return prisma.$queryRaw<OperationalDocument[]>`
    SELECT d.id, d.vehicle_id AS "vehicleId", v.name AS "vehicleName", d.title,
      d.original_name AS "originalName", d.storage_name AS "storageName",
      d.mime_type AS "mimeType", d.size_bytes AS "sizeBytes", d.created_at AS "createdAt"
    FROM operational_document d LEFT JOIN operational_vehicle v ON v.id = d.vehicle_id
    ORDER BY d.created_at DESC
  `;
}

export async function getOperationalDocument(id: string): Promise<OperationalDocument | null> {
  const rows = await prisma.$queryRaw<OperationalDocument[]>`
    SELECT d.id, d.vehicle_id AS "vehicleId", v.name AS "vehicleName", d.title,
      d.original_name AS "originalName", d.storage_name AS "storageName",
      d.mime_type AS "mimeType", d.size_bytes AS "sizeBytes", d.created_at AS "createdAt"
    FROM operational_document d LEFT JOIN operational_vehicle v ON v.id = d.vehicle_id
    WHERE d.id = ${id}
  `;
  return rows[0] ?? null;
}

export async function listOperationalVideos(): Promise<OperationalVideo[]> {
  return prisma.$queryRaw<OperationalVideo[]>`
    SELECT video.id, video.vehicle_id AS "vehicleId", v.name AS "vehicleName",
      video.item_id AS "itemId", i.name AS "itemName", video.title,
      COALESCE(video.description, '') AS description, video.category,
      video.youtube_url AS "youtubeUrl", video.youtube_id AS "youtubeId",
      video.sort_order AS "sortOrder", video.created_at AS "createdAt"
    FROM operational_video video
    LEFT JOIN operational_vehicle v ON v.id = video.vehicle_id
    LEFT JOIN operational_item i ON i.id = video.item_id
    ORDER BY video.sort_order, video.created_at DESC
  `;
}

export async function searchOperationalPortal(query: string) {
  const normalized = query.trim();
  if (!normalized) return { vehicles: [], places: [], items: [], videos: [], documents: [] };
  const pattern = `%${normalized}%`;
  const [vehicles, places, items, videos, documents] = await Promise.all([
    prisma.$queryRaw<Array<{ id: string; name: string; description: string }>>`
      SELECT id, name, COALESCE(description, '') AS description FROM operational_vehicle
      WHERE name ILIKE ${pattern} OR description ILIKE ${pattern} ORDER BY name LIMIT 25
    `,
    prisma.$queryRaw<Array<{ id: string; name: string; vehicleId: string; vehicleName: string }>>`
      SELECT p.id, p.name, v.id AS "vehicleId", v.name AS "vehicleName"
      FROM operational_place p INNER JOIN operational_vehicle v ON v.id = p.vehicle_id
      WHERE p.name ILIKE ${pattern} ORDER BY p.name LIMIT 25
    `,
    prisma.$queryRaw<Array<{ id: string; name: string; note: string; placeName: string; vehicleName: string }>>`
      SELECT i.id, i.name, COALESCE(i.note, '') AS note, p.name AS "placeName", v.name AS "vehicleName"
      FROM operational_item i
      INNER JOIN operational_place p ON p.id = i.place_id
      INNER JOIN operational_vehicle v ON v.id = p.vehicle_id
      WHERE i.name ILIKE ${pattern} OR i.note ILIKE ${pattern} ORDER BY i.name LIMIT 50
    `,
    prisma.$queryRaw<OperationalVideo[]>`
      SELECT video.id, video.vehicle_id AS "vehicleId", v.name AS "vehicleName",
        video.item_id AS "itemId", i.name AS "itemName", video.title,
        COALESCE(video.description, '') AS description, video.category,
        video.youtube_url AS "youtubeUrl", video.youtube_id AS "youtubeId",
        video.sort_order AS "sortOrder", video.created_at AS "createdAt"
      FROM operational_video video
      LEFT JOIN operational_vehicle v ON v.id = video.vehicle_id
      LEFT JOIN operational_item i ON i.id = video.item_id
      WHERE video.title ILIKE ${pattern} OR video.description ILIKE ${pattern} OR video.category ILIKE ${pattern}
      ORDER BY video.title LIMIT 25
    `,
    prisma.$queryRaw<OperationalDocument[]>`
      SELECT d.id, d.vehicle_id AS "vehicleId", v.name AS "vehicleName", d.title,
        d.original_name AS "originalName", d.storage_name AS "storageName",
        d.mime_type AS "mimeType", d.size_bytes AS "sizeBytes", d.created_at AS "createdAt"
      FROM operational_document d LEFT JOIN operational_vehicle v ON v.id = d.vehicle_id
      WHERE d.title ILIKE ${pattern} OR d.original_name ILIKE ${pattern} ORDER BY d.title LIMIT 25
    `
  ]);
  return { vehicles, places, items, videos, documents };
}
