import { OPERATIONAL_VIEW_CONFIG, OPERATIONAL_VIEW_KEYS } from "./operativ-vehicle-view-model";
import { prisma } from "./prisma";

export type OperationalInteractiveNode = {
  id: string;
  placeId: string;
  parentNodeId: string | null;
  name: string;
  description: string;
  imageId: string | null;
  sortOrder: number;
};

export type OperationalInteractiveLink = {
  id: string;
  placeId: string;
  sourceNodeId: string | null;
  targetNodeId: string | null;
  itemId: string | null;
  targetName: string;
  targetType: "node" | "item";
  label: string;
  xPercent: number;
  yPercent: number;
  sizePx: number;
  sortOrder: number;
};

export type OperationalInteractiveItemOption = {
  id: string;
  name: string;
  quantity: number;
  coverImageId: string | null;
};

export type OperationalInteractiveImageOption = {
  id: string;
  title: string;
  originalName: string;
};

export type OperationalInteractiveBreadcrumb = {
  id: string;
  name: string;
};

export type OperationalInteractiveContext = {
  placeId: string;
  placeName: string;
  vehicleId: string;
  vehicleName: string;
  nodeId: string | null;
  nodeName: string | null;
  nodeDescription: string;
  parentNodeId: string | null;
  imageId: string | null;
  breadcrumbs: OperationalInteractiveBreadcrumb[];
  children: OperationalInteractiveNode[];
  links: OperationalInteractiveLink[];
  items: OperationalInteractiveItemOption[];
  images: OperationalInteractiveImageOption[];
};

type PlaceRow = {
  id: string;
  name: string;
  vehicleId: string;
  vehicleName: string;
  rootImageId: string | null;
};

async function getPlaceRow(placeId: string): Promise<PlaceRow | null> {
  const rows = await prisma.$queryRaw<PlaceRow[]>`
    SELECT p.id, p.name, p.vehicle_id AS "vehicleId", v.name AS "vehicleName",
      COALESCE(
        p.interactive_image_id,
        (SELECT image.id FROM operational_image image
          WHERE image.place_id = p.id AND image.item_id IS NULL
          ORDER BY image.is_cover DESC, image.sort_order, image.created_at LIMIT 1)
      ) AS "rootImageId"
    FROM operational_place p
    INNER JOIN operational_vehicle v ON v.id = p.vehicle_id
    WHERE p.id = ${placeId}
    LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function getOperationalInteractiveContext(
  placeId: string,
  nodeId: string | null = null
): Promise<OperationalInteractiveContext | null> {
  const place = await getPlaceRow(placeId);
  if (!place) return null;

  let node: OperationalInteractiveNode | null = null;
  if (nodeId) {
    const rows = await prisma.$queryRaw<OperationalInteractiveNode[]>`
      SELECT id, place_id AS "placeId", parent_node_id AS "parentNodeId", name,
        COALESCE(description, '') AS description, image_id AS "imageId", sort_order AS "sortOrder"
      FROM operational_interactive_node
      WHERE id = ${nodeId} AND place_id = ${placeId}
      LIMIT 1
    `;
    node = rows[0] ?? null;
    if (!node) return null;
  }

  const [children, links, items, images, breadcrumbs] = await Promise.all([
    prisma.$queryRaw<OperationalInteractiveNode[]>`
      SELECT id, place_id AS "placeId", parent_node_id AS "parentNodeId", name,
        COALESCE(description, '') AS description, image_id AS "imageId", sort_order AS "sortOrder"
      FROM operational_interactive_node
      WHERE place_id = ${placeId}
        AND parent_node_id IS NOT DISTINCT FROM ${nodeId}
      ORDER BY sort_order, name, created_at
    `,
    prisma.$queryRaw<OperationalInteractiveLink[]>`
      SELECT l.id, l.place_id AS "placeId", l.source_node_id AS "sourceNodeId",
        l.target_node_id AS "targetNodeId", l.item_id AS "itemId",
        CASE WHEN l.target_node_id IS NOT NULL THEN n.name ELSE i.name END AS "targetName",
        CASE WHEN l.target_node_id IS NOT NULL THEN 'node' ELSE 'item' END AS "targetType",
        COALESCE(l.label, '') AS label,
        l.x_percent::float8 AS "xPercent", l.y_percent::float8 AS "yPercent",
        l.size_px AS "sizePx", l.sort_order AS "sortOrder"
      FROM operational_interactive_link l
      LEFT JOIN operational_interactive_node n ON n.id = l.target_node_id
      LEFT JOIN operational_item i ON i.id = l.item_id
      WHERE l.place_id = ${placeId}
        AND l.source_node_id IS NOT DISTINCT FROM ${nodeId}
        AND l.deleted_at IS NULL
      ORDER BY l.sort_order, l.created_at
    `,
    prisma.$queryRaw<OperationalInteractiveItemOption[]>`
      SELECT i.id, i.name, i.quantity,
        (SELECT image.id FROM operational_image image
          WHERE image.item_id = i.id
          ORDER BY image.is_cover DESC, image.sort_order, image.created_at LIMIT 1) AS "coverImageId"
      FROM operational_item i
      WHERE i.place_id = ${placeId}
      ORDER BY i.sort_order, i.name
    `,
    prisma.$queryRaw<OperationalInteractiveImageOption[]>`
      SELECT id, title, original_name AS "originalName"
      FROM operational_image
      WHERE place_id = ${placeId} AND item_id IS NULL
      ORDER BY is_cover DESC, sort_order, created_at
    `,
    nodeId
      ? prisma.$queryRaw<OperationalInteractiveBreadcrumb[]>`
          WITH RECURSIVE trail AS (
            SELECT id, parent_node_id, name, 0 AS depth
            FROM operational_interactive_node
            WHERE id = ${nodeId} AND place_id = ${placeId}
            UNION ALL
            SELECT parent.id, parent.parent_node_id, parent.name, trail.depth + 1
            FROM operational_interactive_node parent
            INNER JOIN trail ON trail.parent_node_id = parent.id
            WHERE parent.place_id = ${placeId}
          )
          SELECT id, name FROM trail ORDER BY depth DESC
        `
      : Promise.resolve([] as OperationalInteractiveBreadcrumb[])
  ]);

  return {
    placeId: place.id,
    placeName: place.name,
    vehicleId: place.vehicleId,
    vehicleName: place.vehicleName,
    nodeId: node?.id ?? null,
    nodeName: node?.name ?? null,
    nodeDescription: node?.description ?? "",
    parentNodeId: node?.parentNodeId ?? null,
    imageId: node?.imageId ?? place.rootImageId,
    breadcrumbs,
    children,
    links,
    items,
    images
  };
}

export type OperationalContentReadiness = {
  vehicleId: string;
  vehicleName: string;
  configuredVehicleViews: number;
  missingVehicleViews: string[];
  roomCount: number;
  roomsMissingImage: Array<{ id: string; name: string }>;
  roomsMissingInteractiveLinks: Array<{ id: string; name: string }>;
  itemsMissingImage: Array<{ id: string; name: string; placeName: string }>;
  nodesMissingImage: Array<{ id: string; name: string; placeId: string; placeName: string }>;
  nodesMissingLinks: Array<{ id: string; name: string; placeId: string; placeName: string }>;
};

export async function getOperationalContentReadiness(vehicleId: string): Promise<OperationalContentReadiness | null> {
  const vehicleRows = await prisma.$queryRaw<Array<{ id: string; name: string }>>`
    SELECT id, name FROM operational_vehicle WHERE id = ${vehicleId} LIMIT 1
  `;
  const vehicle = vehicleRows[0];
  if (!vehicle) return null;

  const [viewRows, roomRows, itemRows, nodeRows] = await Promise.all([
    prisma.$queryRaw<Array<{ viewKey: string }>>`
      SELECT view_key AS "viewKey" FROM operational_vehicle_view WHERE vehicle_id = ${vehicleId}
    `,
    prisma.$queryRaw<Array<{ id: string; name: string; hasImage: boolean; linkCount: number }>>`
      SELECT p.id, p.name,
        (p.interactive_image_id IS NOT NULL OR EXISTS(
          SELECT 1 FROM operational_image image
          WHERE image.place_id = p.id AND image.item_id IS NULL
        )) AS "hasImage",
        (SELECT COUNT(*)::int FROM operational_interactive_link link
          WHERE link.place_id = p.id AND link.source_node_id IS NULL AND link.deleted_at IS NULL) AS "linkCount"
      FROM operational_place p
      WHERE p.vehicle_id = ${vehicleId}
      ORDER BY p.sort_order, p.name
    `,
    prisma.$queryRaw<Array<{ id: string; name: string; placeName: string }>>`
      SELECT i.id, i.name, p.name AS "placeName"
      FROM operational_item i
      INNER JOIN operational_place p ON p.id = i.place_id
      WHERE p.vehicle_id = ${vehicleId}
        AND NOT EXISTS(SELECT 1 FROM operational_image image WHERE image.item_id = i.id)
      ORDER BY p.sort_order, i.sort_order, i.name
    `,
    prisma.$queryRaw<Array<{ id: string; name: string; placeId: string; placeName: string; hasImage: boolean; linkCount: number }>>`
      SELECT n.id, n.name, n.place_id AS "placeId", p.name AS "placeName",
        (n.image_id IS NOT NULL) AS "hasImage",
        (SELECT COUNT(*)::int FROM operational_interactive_link link
          WHERE link.place_id = n.place_id AND link.source_node_id = n.id AND link.deleted_at IS NULL) AS "linkCount"
      FROM operational_interactive_node n
      INNER JOIN operational_place p ON p.id = n.place_id
      WHERE p.vehicle_id = ${vehicleId}
      ORDER BY p.sort_order, n.sort_order, n.name
    `
  ]);

  const configured = new Set(viewRows.map((row) => row.viewKey));
  const missingVehicleViews = OPERATIONAL_VIEW_KEYS
    .filter((key) => !configured.has(key))
    .map((key) => OPERATIONAL_VIEW_CONFIG[key].label);

  return {
    vehicleId: vehicle.id,
    vehicleName: vehicle.name,
    configuredVehicleViews: configured.size,
    missingVehicleViews,
    roomCount: roomRows.length,
    roomsMissingImage: roomRows.filter((room) => !room.hasImage).map(({ id, name }) => ({ id, name })),
    roomsMissingInteractiveLinks: roomRows.filter((room) => room.linkCount === 0).map(({ id, name }) => ({ id, name })),
    itemsMissingImage: itemRows,
    nodesMissingImage: nodeRows.filter((node) => !node.hasImage).map(({ id, name, placeId, placeName }) => ({ id, name, placeId, placeName })),
    nodesMissingLinks: nodeRows.filter((node) => node.linkCount === 0).map(({ id, name, placeId, placeName }) => ({ id, name, placeId, placeName }))
  };
}
