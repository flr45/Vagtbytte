import { NextResponse } from "next/server";
import { canAccessOperationalPortal, getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type VehicleRow = {
  id: string;
  interactiveImageId: string | null;
  coverImageId: string | null;
};

type PlaceRow = {
  id: string;
  interactiveImageId: string | null;
  coverImageId: string | null;
};

type ItemRow = {
  id: string;
  coverImageId: string | null;
};

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Log ind for at fortsætte." }, { status: 401 });
  if (!canAccessOperationalPortal(user)) {
    return NextResponse.json({ error: "Du har ikke adgang til Operativ Portal." }, { status: 403 });
  }

  const [vehicles, places, items] = await Promise.all([
    prisma.$queryRaw<VehicleRow[]>`
      SELECT v.id, v.interactive_image_id AS "interactiveImageId",
        (SELECT image.id FROM operational_image image
         WHERE image.vehicle_id = v.id AND image.place_id IS NULL AND image.item_id IS NULL
         ORDER BY image.is_cover DESC, image.sort_order, image.created_at LIMIT 1) AS "coverImageId"
      FROM operational_vehicle v
      ORDER BY v.sort_order, v.name
    `,
    prisma.$queryRaw<PlaceRow[]>`
      SELECT p.id, p.interactive_image_id AS "interactiveImageId",
        (SELECT image.id FROM operational_image image
         WHERE image.place_id = p.id AND image.item_id IS NULL
         ORDER BY image.is_cover DESC, image.sort_order, image.created_at LIMIT 1) AS "coverImageId"
      FROM operational_place p
      ORDER BY p.sort_order, p.name
    `,
    prisma.$queryRaw<ItemRow[]>`
      SELECT i.id,
        (SELECT image.id FROM operational_image image
         WHERE image.item_id = i.id
         ORDER BY image.is_cover DESC, image.sort_order, image.created_at LIMIT 1) AS "coverImageId"
      FROM operational_item i
      ORDER BY i.sort_order, i.name
    `
  ]);

  const urls = new Set<string>([
    "/admin/operativ-portal/",
    "/admin/operativ-portal/koeretoejer",
    "/admin/operativ-portal/soeg",
    "/admin/operativ-portal/scan"
  ]);

  const imageIds = new Set<string>();
  for (const vehicle of vehicles) {
    urls.add(`/admin/operativ-portal/koeretoejer/${vehicle.id}`);
    urls.add(`/admin/operativ-portal/koeretoejer/${vehicle.id}/interaktiv`);
    if (vehicle.coverImageId) imageIds.add(vehicle.coverImageId);
    if (vehicle.interactiveImageId) imageIds.add(vehicle.interactiveImageId);
  }

  for (const place of places) {
    urls.add(`/admin/operativ-portal/rum/${place.id}`);
    urls.add(`/admin/operativ-portal/rum/${place.id}/interaktiv`);
    if (place.coverImageId) imageIds.add(place.coverImageId);
    if (place.interactiveImageId) imageIds.add(place.interactiveImageId);
  }

  for (const item of items) {
    urls.add(`/admin/operativ-portal/udstyr/${item.id}`);
    if (item.coverImageId) imageIds.add(item.coverImageId);
  }

  for (const imageId of imageIds) {
    urls.add(`/api/admin/operativ-portal/billeder/${encodeURIComponent(imageId)}`);
  }

  return NextResponse.json(
    {
      version: 1,
      generatedAt: new Date().toISOString(),
      counts: {
        vehicles: vehicles.length,
        places: places.length,
        items: items.length,
        images: imageIds.size,
        urls: urls.size
      },
      urls: Array.from(urls)
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
