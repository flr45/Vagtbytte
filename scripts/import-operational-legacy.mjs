import { randomUUID } from "node:crypto";
import { copyFile, mkdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const exportPath = process.argv[2];
const legacyRoot = process.argv[3] ? path.resolve(process.argv[3]) : null;
const storageRoot = process.env.OPERATIV_PORTAL_DATA_DIRECTORY?.trim() || "/data/operativ-portal";
const imageDirectory = path.join(storageRoot, "images");
const documentDirectory = path.join(storageRoot, "documents");

if (!exportPath) {
  console.error("Brug: node scripts/import-operational-legacy.mjs <export.json> [legacy-root]");
  process.exit(2);
}

const counters = {
  vehiclesCreated: 0,
  vehiclesMatched: 0,
  placesCreated: 0,
  placesMatched: 0,
  itemsCreated: 0,
  itemsMatched: 0,
  imagesCopied: 0,
  documentsCopied: 0,
  filesSkipped: 0
};

try {
  const raw = JSON.parse(await readFile(exportPath, "utf8"));
  if (!raw || !Array.isArray(raw.vehicles)) {
    throw new Error("Eksporten mangler vehicles-arrayet.");
  }

  await mkdir(imageDirectory, { recursive: true });
  await mkdir(documentDirectory, { recursive: true });

  for (const legacyVehicle of raw.vehicles) {
    const vehicleName = clean(legacyVehicle.name, 180);
    if (!vehicleName) continue;
    const vehicle = await findOrCreateVehicle(legacyVehicle, vehicleName);

    const places = Array.isArray(legacyVehicle.places) ? legacyVehicle.places : [];
    for (const legacyPlace of places) {
      const placeName = clean(legacyPlace.name, 180);
      if (!placeName) continue;
      const place = await findOrCreatePlace(vehicle.id, legacyPlace, placeName);

      const items = Array.isArray(legacyPlace.items) ? legacyPlace.items : [];
      for (const legacyItem of items) {
        const itemName = clean(legacyItem.name, 180);
        if (!itemName) continue;
        const item = await findOrCreateItem(place.id, legacyItem, itemName);
        if (legacyRoot && legacyItem.photo_path) {
          await importItemPhoto(vehicle.id, place.id, item.id, itemName, legacyItem.photo_path);
        }
      }
    }

    if (legacyRoot && Array.isArray(legacyVehicle.docs)) {
      for (const legacyDoc of legacyVehicle.docs) {
        await importVehicleDocument(vehicle.id, legacyDoc);
      }
    }
  }

  console.log(JSON.stringify({ ok: true, ...counters }, null, 2));
} catch (error) {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}

async function findOrCreateVehicle(legacy, name) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT id, description, sort_order AS "sortOrder" FROM operational_vehicle
     WHERE lower(trim(name)) = lower(trim($1)) LIMIT 1`,
    name
  );
  if (rows[0]) {
    counters.vehiclesMatched += 1;
    const legacyDescription = clean(legacy.description, 3000);
    if (!rows[0].description && legacyDescription) {
      await prisma.$executeRawUnsafe(
        `UPDATE operational_vehicle SET description = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
        legacyDescription,
        rows[0].id
      );
    }
    return rows[0];
  }

  const id = randomUUID();
  await prisma.$executeRawUnsafe(
    `INSERT INTO operational_vehicle (id, name, description, sort_order)
     VALUES ($1, $2, $3, $4)`,
    id,
    name,
    clean(legacy.description, 3000),
    integer(legacy.sort, 0)
  );
  counters.vehiclesCreated += 1;
  return { id };
}

async function findOrCreatePlace(vehicleId, legacy, name) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT id, description, sort_order AS "sortOrder" FROM operational_place
     WHERE vehicle_id = $1 AND lower(trim(name)) = lower(trim($2)) LIMIT 1`,
    vehicleId,
    name
  );
  if (rows[0]) {
    counters.placesMatched += 1;
    return rows[0];
  }

  const id = randomUUID();
  await prisma.$executeRawUnsafe(
    `INSERT INTO operational_place (id, vehicle_id, name, sort_order)
     VALUES ($1, $2, $3, $4)`,
    id,
    vehicleId,
    name,
    integer(legacy.sort, 0)
  );
  counters.placesCreated += 1;
  return { id };
}

async function findOrCreateItem(placeId, legacy, name) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT id, quantity, note, sort_order AS "sortOrder" FROM operational_item
     WHERE place_id = $1 AND lower(trim(name)) = lower(trim($2)) LIMIT 1`,
    placeId,
    name
  );
  const quantity = Math.max(1, integer(legacy.quantity, 1));
  const note = clean(legacy.note, 1000);
  if (rows[0]) {
    counters.itemsMatched += 1;
    const nextQuantity = Number(rows[0].quantity) === 1 && quantity !== 1 ? quantity : Number(rows[0].quantity);
    const nextNote = rows[0].note ? rows[0].note : note;
    if (nextQuantity !== Number(rows[0].quantity) || nextNote !== rows[0].note) {
      await prisma.$executeRawUnsafe(
        `UPDATE operational_item SET quantity = $1, note = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3`,
        nextQuantity,
        nextNote,
        rows[0].id
      );
    }
    return rows[0];
  }

  const id = randomUUID();
  await prisma.$executeRawUnsafe(
    `INSERT INTO operational_item (id, place_id, name, quantity, note, sort_order)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    id,
    placeId,
    name,
    quantity,
    note,
    integer(legacy.sort, 0)
  );
  counters.itemsCreated += 1;
  return { id };
}

async function importItemPhoto(vehicleId, placeId, itemId, itemName, sourceValue) {
  const source = resolveLegacyPath(sourceValue);
  if (!source) {
    counters.filesSkipped += 1;
    return;
  }
  const extension = path.extname(source).toLowerCase();
  const mimeType = imageMime(extension);
  if (!mimeType) {
    counters.filesSkipped += 1;
    return;
  }
  try {
    const fileStat = await stat(source);
    if (!fileStat.isFile()) throw new Error("not-file");
    const originalName = path.basename(source);
    const existing = await prisma.$queryRawUnsafe(
      `SELECT id FROM operational_image WHERE item_id = $1 AND original_name = $2 LIMIT 1`,
      itemId,
      originalName
    );
    if (existing[0]) return;

    const storageName = `${randomUUID()}${extension === ".jpeg" ? ".jpg" : extension}`;
    await copyFile(source, path.join(imageDirectory, storageName));
    const coverRows = await prisma.$queryRawUnsafe(
      `SELECT COUNT(*)::int AS count FROM operational_image WHERE item_id = $1`,
      itemId
    );
    const isCover = Number(coverRows[0]?.count ?? 0) === 0;
    await prisma.$executeRawUnsafe(
      `INSERT INTO operational_image
        (id, vehicle_id, place_id, item_id, title, alt_text, original_name, storage_name,
         mime_type, size_bytes, is_cover, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 0)`,
      randomUUID(),
      vehicleId,
      placeId,
      itemId,
      itemName,
      itemName,
      originalName,
      storageName,
      mimeType,
      Number(fileStat.size),
      isCover
    );
    counters.imagesCopied += 1;
  } catch {
    counters.filesSkipped += 1;
  }
}

async function importVehicleDocument(vehicleId, legacyDoc) {
  const sourceValue = legacyDoc?.path;
  if (!sourceValue) return;
  const source = resolveLegacyPath(sourceValue);
  if (!source) {
    counters.filesSkipped += 1;
    return;
  }
  const extension = path.extname(source).toLowerCase();
  const mimeType = documentMime(extension);
  if (!mimeType) {
    counters.filesSkipped += 1;
    return;
  }
  try {
    const fileStat = await stat(source);
    if (!fileStat.isFile()) throw new Error("not-file");
    const originalName = clean(legacyDoc.filename || path.basename(source), 240) || path.basename(source);
    const existing = await prisma.$queryRawUnsafe(
      `SELECT id FROM operational_document WHERE vehicle_id = $1 AND original_name = $2 LIMIT 1`,
      vehicleId,
      originalName
    );
    if (existing[0]) return;

    const storageName = `${randomUUID()}${extension}`;
    await copyFile(source, path.join(documentDirectory, storageName));
    await prisma.$executeRawUnsafe(
      `INSERT INTO operational_document
        (id, vehicle_id, title, original_name, storage_name, mime_type, size_bytes, description, category)
       VALUES ($1, $2, $3, $4, $5, $6, $7, '', 'Instruks')`,
      randomUUID(),
      vehicleId,
      originalName.replace(/\.[^.]+$/, ""),
      originalName,
      storageName,
      mimeType,
      Number(fileStat.size)
    );
    counters.documentsCopied += 1;
  } catch {
    counters.filesSkipped += 1;
  }
}

function resolveLegacyPath(value) {
  if (!legacyRoot) return null;
  const text = String(value).replace(/^\/+/, "");
  const candidate = path.resolve(legacyRoot, text);
  if (candidate !== legacyRoot && !candidate.startsWith(`${legacyRoot}${path.sep}`)) return null;
  return candidate;
}

function clean(value, max) {
  return String(value ?? "").trim().slice(0, max);
}

function integer(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : fallback;
}

function imageMime(extension) {
  if ([".jpg", ".jpeg"].includes(extension)) return "image/jpeg";
  if (extension === ".png") return "image/png";
  if (extension === ".webp") return "image/webp";
  return null;
}

function documentMime(extension) {
  const map = {
    ".pdf": "application/pdf",
    ".doc": "application/msword",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".xls": "application/vnd.ms-excel",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp"
  };
  return map[extension] ?? null;
}
