import { prisma } from "./prisma";

export type VehicleInteractiveHotspot = {
  id: string;
  vehicleId: string;
  placeId: string;
  placeName: string;
  label: string;
  xPercent: number;
  yPercent: number;
  sizePx: number;
  sortOrder: number;
};

export type PlaceInteractiveHotspot = {
  id: string;
  placeId: string;
  itemId: string;
  itemName: string;
  label: string;
  xPercent: number;
  yPercent: number;
  sizePx: number;
  sortOrder: number;
};

export type InteractiveRoomSummary = {
  id: string;
  name: string;
  description: string;
  sortOrder: number;
  itemCount: number;
  coverImageId: string | null;
  interactiveImageId: string | null;
};

export type InteractiveItemSummary = {
  id: string;
  name: string;
  quantity: number;
  note: string;
  sortOrder: number;
  coverImageId: string | null;
};

export async function listVehicleInteractiveHotspots(vehicleId: string): Promise<VehicleInteractiveHotspot[]> {
  return prisma.$queryRaw<VehicleInteractiveHotspot[]>`
    SELECT h.id, h.vehicle_id AS "vehicleId", h.place_id AS "placeId", p.name AS "placeName",
      COALESCE(h.label, '') AS label,
      h.x_percent::float8 AS "xPercent", h.y_percent::float8 AS "yPercent",
      h.size_px AS "sizePx", h.sort_order AS "sortOrder"
    FROM operational_hotspot h
    INNER JOIN operational_place p ON p.id = h.place_id
    WHERE h.vehicle_id = ${vehicleId}
    ORDER BY h.sort_order, h.created_at
  `;
}

export async function getVehicleInteractiveData(vehicleId: string) {
  const vehicleRows = await prisma.$queryRaw<Array<{
    id: string;
    name: string;
    code: string;
    interactiveImageId: string | null;
    coverImageId: string | null;
  }>>`
    SELECT v.id, v.name, COALESCE(v.code, '') AS code,
      v.interactive_image_id AS "interactiveImageId",
      (SELECT image.id FROM operational_image image
       WHERE image.vehicle_id = v.id AND image.place_id IS NULL AND image.item_id IS NULL
       ORDER BY image.is_cover DESC, image.sort_order, image.created_at LIMIT 1) AS "coverImageId"
    FROM operational_vehicle v WHERE v.id = ${vehicleId}
  `;
  const vehicle = vehicleRows[0];
  if (!vehicle) return null;

  const [hotspots, rooms] = await Promise.all([
    listVehicleInteractiveHotspots(vehicleId),
    prisma.$queryRaw<InteractiveRoomSummary[]>`
      SELECT p.id, p.name, COALESCE(p.description, '') AS description,
        p.sort_order AS "sortOrder", p.interactive_image_id AS "interactiveImageId",
        (SELECT COUNT(*)::int FROM operational_item i WHERE i.place_id = p.id) AS "itemCount",
        (SELECT image.id FROM operational_image image
         WHERE image.place_id = p.id AND image.item_id IS NULL
         ORDER BY image.is_cover DESC, image.sort_order, image.created_at LIMIT 1) AS "coverImageId"
      FROM operational_place p
      WHERE p.vehicle_id = ${vehicleId}
      ORDER BY p.sort_order, p.name
    `
  ]);

  return { ...vehicle, hotspots, rooms };
}

export async function getPlaceInteractiveData(placeId: string) {
  const placeRows = await prisma.$queryRaw<Array<{
    id: string;
    name: string;
    vehicleId: string;
    vehicleName: string;
    interactiveImageId: string | null;
    coverImageId: string | null;
  }>>`
    SELECT p.id, p.name, p.vehicle_id AS "vehicleId", v.name AS "vehicleName",
      p.interactive_image_id AS "interactiveImageId",
      (SELECT image.id FROM operational_image image
       WHERE image.place_id = p.id AND image.item_id IS NULL
       ORDER BY image.is_cover DESC, image.sort_order, image.created_at LIMIT 1) AS "coverImageId"
    FROM operational_place p
    INNER JOIN operational_vehicle v ON v.id = p.vehicle_id
    WHERE p.id = ${placeId}
  `;
  const place = placeRows[0];
  if (!place) return null;

  const [hotspots, items] = await Promise.all([
    listPlaceInteractiveHotspots(placeId),
    prisma.$queryRaw<InteractiveItemSummary[]>`
      SELECT i.id, i.name, i.quantity, COALESCE(i.note, '') AS note,
        i.sort_order AS "sortOrder",
        (SELECT image.id FROM operational_image image
         WHERE image.item_id = i.id
         ORDER BY image.is_cover DESC, image.sort_order, image.created_at LIMIT 1) AS "coverImageId"
      FROM operational_item i
      WHERE i.place_id = ${placeId}
      ORDER BY i.sort_order, i.name
    `
  ]);

  return { ...place, hotspots, items };
}

export async function listPlaceInteractiveHotspots(placeId: string): Promise<PlaceInteractiveHotspot[]> {
  return prisma.$queryRaw<PlaceInteractiveHotspot[]>`
    SELECT h.id, h.place_id AS "placeId", h.item_id AS "itemId", i.name AS "itemName",
      COALESCE(h.label, '') AS label,
      h.x_percent::float8 AS "xPercent", h.y_percent::float8 AS "yPercent",
      h.size_px AS "sizePx", h.sort_order AS "sortOrder"
    FROM operational_place_hotspot h
    INNER JOIN operational_item i ON i.id = h.item_id
    WHERE h.place_id = ${placeId}
    ORDER BY h.sort_order, h.created_at
  `;
}

export function roomSection(name: string) {
  const normalized = name.toLocaleLowerCase("da-DK");
  if (/førerhus|foererhus|mandskab|kabine|handskerum/.test(normalized)) return "Førerhus & kabine";
  if (/højre|hoejre/.test(normalized)) return "Højre side";
  if (/venstre/.test(normalized)) return "Venstre side";
  if (/pumpe|bagerste|bagende|bagklap/.test(normalized)) return "Bag & pumpe";
  if (/tag|stige|faldsikring/.test(normalized)) return "Tag & udvendigt";
  return "Øvrige rum";
}

export function groupRooms<T extends { name: string }>(rooms: T[]) {
  const order = ["Førerhus & kabine", "Højre side", "Venstre side", "Bag & pumpe", "Tag & udvendigt", "Øvrige rum"];
  const groups = new Map<string, T[]>();
  for (const room of rooms) {
    const section = roomSection(room.name);
    const values = groups.get(section) ?? [];
    values.push(room);
    groups.set(section, values);
  }
  return order.flatMap((section) => {
    const values = groups.get(section);
    return values?.length ? [{ section, rooms: values }] : [];
  });
}
