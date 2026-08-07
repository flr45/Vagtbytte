import { groupRooms } from "./operativ-interactive";
import {
  OPERATIONAL_VIEW_CONFIG,
  OPERATIONAL_VIEW_KEYS,
  type OperationalVehicleViewKey
} from "./operativ-vehicle-view-model";
import { prisma } from "./prisma";

export type OperationalPhotoTask = {
  key: string;
  kind: "vehicle-view" | "room" | "node";
  label: string;
  section: string;
  completed: boolean;
  imageId: string | null;
  viewKey: OperationalVehicleViewKey | null;
  placeId: string | null;
  nodeId: string | null;
  detail: string;
};

export type OperationalPhotoPlan = {
  vehicleId: string;
  vehicleName: string;
  tasks: OperationalPhotoTask[];
  completed: number;
  total: number;
  percent: number;
};

type RoomRow = {
  id: string;
  name: string;
  sortOrder: number;
  imageId: string | null;
};

type NodeRow = {
  id: string;
  name: string;
  placeId: string;
  placeName: string;
  imageId: string | null;
  sortOrder: number;
};

export function nextIncompletePhotoTask(tasks: OperationalPhotoTask[], currentKey?: string | null) {
  if (!tasks.length) return null;
  const currentIndex = currentKey ? tasks.findIndex((task) => task.key === currentKey) : -1;
  const ordered = currentIndex >= 0
    ? [...tasks.slice(currentIndex + 1), ...tasks.slice(0, currentIndex)]
    : tasks;
  return ordered.find((task) => !task.completed && task.key !== currentKey) ?? null;
}

export function operationalPhotoProgress(tasks: OperationalPhotoTask[]) {
  const completed = tasks.filter((task) => task.completed).length;
  const total = tasks.length;
  return {
    completed,
    total,
    percent: total ? Math.round((completed / total) * 100) : 100
  };
}

export async function getOperationalPhotoPlan(vehicleId: string): Promise<OperationalPhotoPlan | null> {
  const vehicleRows = await prisma.$queryRaw<Array<{ id: string; name: string }>>`
    SELECT id, name FROM operational_vehicle WHERE id = ${vehicleId} LIMIT 1
  `;
  const vehicle = vehicleRows[0];
  if (!vehicle) return null;

  const [viewRows, roomRows, nodeRows] = await Promise.all([
    prisma.$queryRaw<Array<{ viewKey: string; imageId: string }>>`
      SELECT view_key AS "viewKey", image_id AS "imageId"
      FROM operational_vehicle_view
      WHERE vehicle_id = ${vehicleId}
    `,
    prisma.$queryRaw<RoomRow[]>`
      SELECT p.id, p.name, p.sort_order AS "sortOrder",
        COALESCE(
          p.interactive_image_id,
          (SELECT image.id FROM operational_image image
           WHERE image.place_id = p.id AND image.item_id IS NULL
           ORDER BY image.is_cover DESC, image.sort_order, image.created_at LIMIT 1)
        ) AS "imageId"
      FROM operational_place p
      WHERE p.vehicle_id = ${vehicleId}
      ORDER BY p.sort_order, p.name
    `,
    prisma.$queryRaw<NodeRow[]>`
      SELECT n.id, n.name, n.place_id AS "placeId", p.name AS "placeName",
        n.image_id AS "imageId", n.sort_order AS "sortOrder"
      FROM operational_interactive_node n
      INNER JOIN operational_place p ON p.id = n.place_id
      WHERE p.vehicle_id = ${vehicleId}
      ORDER BY p.sort_order, n.sort_order, n.name
    `
  ]);

  const viewImages = new Map(viewRows.map((row) => [row.viewKey, row.imageId]));
  const tasks: OperationalPhotoTask[] = OPERATIONAL_VIEW_KEYS.map((viewKey) => {
    const imageId = viewImages.get(viewKey) ?? null;
    return {
      key: `view:${viewKey}`,
      kind: "vehicle-view" as const,
      label: OPERATIONAL_VIEW_CONFIG[viewKey].label,
      section: "Køretøjet rundt om",
      completed: Boolean(imageId),
      imageId,
      viewKey,
      placeId: null,
      nodeId: null,
      detail: "Køretøjsvisning"
    };
  });

  for (const group of groupRooms(roomRows)) {
    for (const room of group.rooms) {
      tasks.push({
        key: `room:${room.id}`,
        kind: "room",
        label: room.name,
        section: group.section,
        completed: Boolean(room.imageId),
        imageId: room.imageId,
        viewKey: null,
        placeId: room.id,
        nodeId: null,
        detail: "Rum / skab"
      });
    }
  }

  for (const node of nodeRows) {
    tasks.push({
      key: `node:${node.id}`,
      kind: "node",
      label: node.name,
      section: "Underområder",
      completed: Boolean(node.imageId),
      imageId: node.imageId,
      viewKey: null,
      placeId: node.placeId,
      nodeId: node.id,
      detail: node.placeName
    });
  }

  const progress = operationalPhotoProgress(tasks);
  return {
    vehicleId: vehicle.id,
    vehicleName: vehicle.name,
    tasks,
    ...progress
  };
}
