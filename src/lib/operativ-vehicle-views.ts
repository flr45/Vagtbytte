import { getVehicleInteractiveData } from "./operativ-interactive";
import type { OperationalVehicleView, OperationalVehicleViewHotspot } from "./operativ-vehicle-view-model";
import { prisma } from "./prisma";

export async function listOperationalVehicleViews(vehicleId: string): Promise<OperationalVehicleView[]> {
  return prisma.$queryRaw<OperationalVehicleView[]>`
    SELECT id, vehicle_id AS "vehicleId", view_key AS "viewKey", label,
      image_id AS "imageId", sort_order AS "sortOrder"
    FROM operational_vehicle_view
    WHERE vehicle_id = ${vehicleId}
    ORDER BY sort_order, created_at
  `;
}

export async function listOperationalVehicleViewHotspots(vehicleId: string): Promise<OperationalVehicleViewHotspot[]> {
  return prisma.$queryRaw<OperationalVehicleViewHotspot[]>`
    SELECT h.id, h.vehicle_id AS "vehicleId", h.place_id AS "placeId", p.name AS "placeName",
      COALESCE(h.view_key, 'front') AS "viewKey", COALESCE(h.label, '') AS label,
      h.x_percent::float8 AS "xPercent", h.y_percent::float8 AS "yPercent",
      h.size_px AS "sizePx", h.sort_order AS "sortOrder"
    FROM operational_hotspot h
    INNER JOIN operational_place p ON p.id = h.place_id
    WHERE h.vehicle_id = ${vehicleId}
    ORDER BY COALESCE(h.view_key, 'front'), h.sort_order, h.created_at
  `;
}

export async function getOperationalVehicleViewBundle(vehicleId: string) {
  const [vehicle, views, hotspots] = await Promise.all([
    getVehicleInteractiveData(vehicleId),
    listOperationalVehicleViews(vehicleId),
    listOperationalVehicleViewHotspots(vehicleId)
  ]);
  if (!vehicle) return null;

  if (views.length === 0 && (vehicle.interactiveImageId || vehicle.coverImageId)) {
    views.push({
      id: "legacy-front",
      vehicleId: vehicle.id,
      viewKey: "front",
      label: "Front",
      imageId: vehicle.interactiveImageId || vehicle.coverImageId || "",
      sortOrder: 0
    });
  }

  return { ...vehicle, views, viewHotspots: hotspots };
}
