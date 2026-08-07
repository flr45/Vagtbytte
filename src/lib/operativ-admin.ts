import { prisma } from "./prisma";

export type OperationalAdminItem = {
  id: string;
  name: string;
  quantity: number;
  note: string;
  specifications: string;
  sortOrder: number;
};

export type OperationalAdminRoom = {
  id: string;
  name: string;
  description: string;
  sortOrder: number;
  items: OperationalAdminItem[];
};

export type OperationalAdminVehicle = {
  id: string;
  name: string;
  code: string;
  rooms: OperationalAdminRoom[];
};

export async function getOperationalAdminVehicle(vehicleId: string): Promise<OperationalAdminVehicle | null> {
  const vehicles = await prisma.$queryRaw<Array<{ id: string; name: string; code: string }>>`
    SELECT id, name, COALESCE(code, '') AS code
    FROM operational_vehicle
    WHERE id = ${vehicleId}
    LIMIT 1
  `;
  const vehicle = vehicles[0];
  if (!vehicle) return null;

  const rooms = await prisma.$queryRaw<Array<{
    id: string;
    name: string;
    description: string;
    sortOrder: number;
  }>>`
    SELECT id, name, COALESCE(description, '') AS description, sort_order AS "sortOrder"
    FROM operational_place
    WHERE vehicle_id = ${vehicleId}
    ORDER BY sort_order, name
  `;

  const items = rooms.length
    ? await prisma.$queryRaw<Array<OperationalAdminItem & { placeId: string }>>`
        SELECT id, place_id AS "placeId", name, quantity,
          COALESCE(note, '') AS note,
          COALESCE(specifications, '') AS specifications,
          sort_order AS "sortOrder"
        FROM operational_item
        WHERE place_id IN (
          SELECT id FROM operational_place WHERE vehicle_id = ${vehicleId}
        )
        ORDER BY place_id, sort_order, name
      `
    : [];

  const itemsByRoom = new Map<string, OperationalAdminItem[]>();
  for (const item of items) {
    const values = itemsByRoom.get(item.placeId) ?? [];
    values.push({
      id: item.id,
      name: item.name,
      quantity: item.quantity,
      note: item.note,
      specifications: item.specifications,
      sortOrder: item.sortOrder
    });
    itemsByRoom.set(item.placeId, values);
  }

  return {
    ...vehicle,
    rooms: rooms.map((room) => ({
      ...room,
      items: itemsByRoom.get(room.id) ?? []
    }))
  };
}
