import { prisma } from "./prisma";

export type OperationalPlaceDocument = {
  id: string;
  title: string;
  category: string;
  vehicleName: string | null;
  placeName: string | null;
  itemName: string | null;
};

export type OperationalPlaceVideo = {
  id: string;
  title: string;
  description: string;
  category: string;
  youtubeId: string;
  sortOrder: number;
};

export async function listOperationalPlaceDocuments(placeId: string): Promise<OperationalPlaceDocument[]> {
  return prisma.$queryRaw<OperationalPlaceDocument[]>`
    SELECT d.id, d.title, d.category,
      v.name AS "vehicleName", p.name AS "placeName", i.name AS "itemName"
    FROM operational_document d
    LEFT JOIN operational_vehicle v ON v.id = d.vehicle_id
    LEFT JOIN operational_place p ON p.id = d.place_id
    LEFT JOIN operational_item i ON i.id = d.item_id
    WHERE d.place_id = ${placeId}
    ORDER BY d.created_at DESC
  `;
}

export async function listOperationalPlaceVideos(placeId: string): Promise<OperationalPlaceVideo[]> {
  return prisma.$queryRaw<OperationalPlaceVideo[]>`
    SELECT video.id, video.title, COALESCE(video.description, '') AS description,
      video.category, video.youtube_id AS "youtubeId", video.sort_order AS "sortOrder"
    FROM operational_video video
    WHERE video.place_id = ${placeId}
    ORDER BY video.sort_order, video.created_at DESC
  `;
}
