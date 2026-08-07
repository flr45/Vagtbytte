import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";
import { canManageOperationalPortal, getCurrentUser } from "@/lib/auth";
import { normalizeKey, normalizePlaceKey } from "@/lib/operativ-packing-list";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const rowSchema = z.object({
  placeName: z.string().trim().min(1).max(180),
  itemName: z.string().trim().min(1).max(180),
  quantity: z.coerce.number().int().min(1).max(999),
  note: z.string().trim().max(1000).default(""),
  confidence: z.coerce.number().min(0).max(1),
  confirmed: z.boolean().default(false)
});

const bodySchema = z.object({
  vehicleId: z.string().uuid(),
  rows: z.array(rowSchema).min(1).max(1500)
});

type ExistingRow = {
  placeId: string;
  placeName: string;
  placeSortOrder: number;
  itemId: string | null;
  itemName: string | null;
  itemSortOrder: number | null;
};

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Log ind for at fortsætte." }, { status: 401 });
  if (!canManageOperationalPortal(user)) {
    return NextResponse.json({ error: "Kun administratorer kan importere pakkelister." }, { status: 403 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Importdata er ugyldige." }, { status: 400 });
  }

  const vehicle = await prisma.$queryRaw<Array<{ id: string; name: string }>>`
    SELECT id, name FROM operational_vehicle WHERE id = ${parsed.data.vehicleId}
  `;
  if (!vehicle[0]) return NextResponse.json({ error: "Køretøjet blev ikke fundet." }, { status: 404 });

  const uniqueRows = new Map<string, z.infer<typeof rowSchema>>();
  for (const row of parsed.data.rows) {
    if (row.confidence < 0.75 && !row.confirmed) continue;
    const key = `${normalizePlaceKey(row.placeName)}::${normalizeKey(row.itemName)}`;
    if (!uniqueRows.has(key)) uniqueRows.set(key, row);
  }
  if (uniqueRows.size === 0) {
    return NextResponse.json({ error: "Der er ingen bekræftede poster at importere." }, { status: 400 });
  }

  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.$queryRaw<ExistingRow[]>`
      SELECT p.id AS "placeId", p.name AS "placeName", p.sort_order AS "placeSortOrder",
        i.id AS "itemId", i.name AS "itemName", i.sort_order AS "itemSortOrder"
      FROM operational_place p
      LEFT JOIN operational_item i ON i.place_id = p.id
      WHERE p.vehicle_id = ${parsed.data.vehicleId}
      ORDER BY p.sort_order, p.name, i.sort_order, i.name
    `;

    const placeByKey = new Map<string, { id: string; name: string; nextItemSort: number }>();
    let nextPlaceSort = 0;
    for (const row of existing) {
      nextPlaceSort = Math.max(nextPlaceSort, row.placeSortOrder + 1);
      const key = normalizePlaceKey(row.placeName);
      const current = placeByKey.get(key);
      const nextItemSort = Math.max(current?.nextItemSort ?? 0, (row.itemSortOrder ?? -1) + 1);
      placeByKey.set(key, { id: row.placeId, name: row.placeName, nextItemSort });
    }

    const itemByKey = new Map<string, { id: string; name: string }>();
    for (const row of existing) {
      if (row.itemId && row.itemName) itemByKey.set(`${row.placeId}:${normalizeKey(row.itemName)}`, { id: row.itemId, name: row.itemName });
    }

    let createdPlaces = 0;
    let createdItems = 0;
    let updatedItems = 0;

    for (const row of uniqueRows.values()) {
      const placeKey = normalizePlaceKey(row.placeName);
      let place = placeByKey.get(placeKey);
      if (!place) {
        const placeId = randomUUID();
        await tx.$executeRaw`
          INSERT INTO operational_place (id, vehicle_id, name, description, sort_order)
          VALUES (${placeId}, ${parsed.data.vehicleId}, ${row.placeName}, '', ${nextPlaceSort})
        `;
        nextPlaceSort += 1;
        place = { id: placeId, name: row.placeName, nextItemSort: 0 };
        placeByKey.set(placeKey, place);
        createdPlaces += 1;
      }

      const itemKey = `${place.id}:${normalizeKey(row.itemName)}`;
      const existingItem = itemByKey.get(itemKey);
      if (existingItem) {
        await tx.$executeRaw`
          UPDATE operational_item
          SET quantity = ${row.quantity},
              note = CASE WHEN ${row.note} <> '' THEN ${row.note} ELSE note END
          WHERE id = ${existingItem.id}
        `;
        updatedItems += 1;
      } else {
        const itemId = randomUUID();
        await tx.$executeRaw`
          INSERT INTO operational_item (id, place_id, name, quantity, note, specifications, sort_order)
          VALUES (${itemId}, ${place.id}, ${row.itemName}, ${row.quantity}, ${row.note}, '', ${place.nextItemSort})
        `;
        place.nextItemSort += 1;
        itemByKey.set(itemKey, { id: itemId, name: row.itemName });
        createdItems += 1;
      }
    }

    return { createdPlaces, createdItems, updatedItems, importedRows: uniqueRows.size };
  });

  await prisma.auditLog.create({
    data: {
      actorUserId: user.id,
      actorRole: user.role,
      action: "OPERATIONAL_PACKING_LIST_PDF_IMPORTED",
      description: `PDF-pakkeliste importeret til ${vehicle[0].name}: ${result.importedRows} poster, ${result.createdPlaces} nye rum, ${result.createdItems} nye udstyrsposter og ${result.updatedItems} opdateringer`
    }
  });

  revalidatePath("/admin/operativ-portal");
  revalidatePath("/admin/operativ-portal/koeretoejer");
  revalidatePath(`/admin/operativ-portal/koeretoejer/${parsed.data.vehicleId}`);
  revalidatePath("/admin/operativ-portal/soeg");

  return NextResponse.json({ ok: true, ...result });
}
