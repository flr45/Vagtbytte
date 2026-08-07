import { NextResponse } from "next/server";
import { canManageOperationalPortal, getCurrentUser } from "@/lib/auth";
import {
  MAX_PACKING_LIST_PDF_BYTES,
  extractTextFromPackingListPdf,
  normalizeKey,
  parsePackingListText,
  type PackingListPreviewRow
} from "@/lib/operativ-packing-list";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ExistingRow = {
  placeId: string;
  placeName: string;
  itemId: string | null;
  itemName: string | null;
};

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Log ind for at fortsætte." }, { status: 401 });
  if (!canManageOperationalPortal(user)) {
    return NextResponse.json({ error: "Kun administratorer kan importere pakkelister." }, { status: 403 });
  }

  const formData = await request.formData();
  const vehicleId = String(formData.get("vehicleId") ?? "").trim();
  const file = formData.get("file");

  if (!/^[0-9a-f-]{36}$/i.test(vehicleId)) {
    return NextResponse.json({ error: "Køretøjet er ugyldigt." }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Vælg en PDF-pakkeliste." }, { status: 400 });
  }
  if (file.size <= 0 || file.size > MAX_PACKING_LIST_PDF_BYTES) {
    return NextResponse.json({ error: "PDF-filen må højst fylde 15 MB." }, { status: 413 });
  }
  const looksLikePdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  if (!looksLikePdf) {
    return NextResponse.json({ error: "Filen skal være en PDF." }, { status: 415 });
  }

  const vehicle = await prisma.$queryRaw<Array<{ id: string; name: string }>>`
    SELECT id, name FROM operational_vehicle WHERE id = ${vehicleId}
  `;
  if (!vehicle[0]) return NextResponse.json({ error: "Køretøjet blev ikke fundet." }, { status: 404 });

  let text: string;
  try {
    text = await extractTextFromPackingListPdf(new Uint8Array(await file.arrayBuffer()));
  } catch (error) {
    console.error("PDF packing list extraction failed", error);
    return NextResponse.json({ error: "PDF'en kunne ikke læses. Kontrollér at filen er gyldig og prøv igen." }, { status: 422 });
  }

  const parsedRows = parsePackingListText(text);
  if (parsedRows.length === 0) {
    return NextResponse.json(
      { error: "Der blev ikke fundet en læsbar pakkeliste i PDF'en. Hvis PDF'en kun består af scannede billeder, skal den først gøres tekstgenkendelig." },
      { status: 422 }
    );
  }

  const existing = await prisma.$queryRaw<ExistingRow[]>`
    SELECT p.id AS "placeId", p.name AS "placeName", i.id AS "itemId", i.name AS "itemName"
    FROM operational_place p
    LEFT JOIN operational_item i ON i.place_id = p.id
    WHERE p.vehicle_id = ${vehicleId}
    ORDER BY p.sort_order, p.name, i.sort_order, i.name
  `;

  const placeByKey = new Map<string, { id: string; name: string }>();
  const itemByKey = new Map<string, { id: string; name: string }>();
  for (const row of existing) {
    const placeKey = normalizeKey(row.placeName);
    if (!placeByKey.has(placeKey)) placeByKey.set(placeKey, { id: row.placeId, name: row.placeName });
    if (row.itemId && row.itemName) itemByKey.set(`${row.placeId}:${normalizeKey(row.itemName)}`, { id: row.itemId, name: row.itemName });
  }

  const rows: PackingListPreviewRow[] = parsedRows.map((row) => {
    const place = placeByKey.get(normalizeKey(row.placeName)) ?? null;
    const item = place ? itemByKey.get(`${place.id}:${normalizeKey(row.itemName)}`) ?? null : null;
    let action: PackingListPreviewRow["action"] = "create-place-and-item";
    if (row.confidence < 0.75) action = "review";
    else if (item) action = "update-item";
    else if (place) action = "create-item";
    return {
      ...row,
      placeId: place?.id ?? null,
      existingPlaceName: place?.name ?? null,
      itemId: item?.id ?? null,
      existingItemName: item?.name ?? null,
      action
    };
  });

  const stats = {
    total: rows.length,
    existingPlaces: new Set(rows.filter((row) => row.placeId).map((row) => row.placeId)).size,
    newPlaces: new Set(rows.filter((row) => !row.placeId && row.action !== "review").map((row) => normalizeKey(row.placeName))).size,
    newItems: rows.filter((row) => row.action === "create-item" || row.action === "create-place-and-item").length,
    updates: rows.filter((row) => row.action === "update-item").length,
    review: rows.filter((row) => row.action === "review").length
  };

  return NextResponse.json({ vehicle: vehicle[0], fileName: file.name, rows, stats });
}
