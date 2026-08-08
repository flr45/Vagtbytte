import { prisma } from "./prisma";

export type OperationalItemDocument = {
  id: string;
  title: string;
  category: string;
};

export type OperationalItemVideo = {
  id: string;
  title: string;
  description: string;
  category: string;
  youtubeId: string;
  sortOrder: number;
};

export async function listOperationalItemDocuments(itemId: string): Promise<OperationalItemDocument[]> {
  return prisma.$queryRaw<OperationalItemDocument[]>`
    SELECT id, title, category
    FROM operational_document
    WHERE item_id = ${itemId}
    ORDER BY created_at DESC
  `;
}

export async function listOperationalItemVideos(itemId: string): Promise<OperationalItemVideo[]> {
  return prisma.$queryRaw<OperationalItemVideo[]>`
    SELECT id, title, COALESCE(description, '') AS description, category,
      youtube_id AS "youtubeId", sort_order AS "sortOrder"
    FROM operational_video
    WHERE item_id = ${itemId}
    ORDER BY sort_order, created_at DESC
  `;
}
