import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

export const OPERATIONAL_BACKUP_TABLE_NAMES = [
  "operationalVehicles",
  "operationalPlaces",
  "operationalItems",
  "operationalImages",
  "operationalDocuments",
  "operationalVideos",
  "operationalHotspots",
  "operationalPlaceHotspots",
  "operationalVehicleViews",
  "operationalInteractiveNodes",
  "operationalInteractiveLinks",
  "operationalFavorites",
  "operationalRecent"
];

const TABLE_CONFIG = {
  operationalVehicles: { sqlName: "operational_vehicle", orderBy: "id" },
  operationalPlaces: { sqlName: "operational_place", orderBy: "vehicle_id, sort_order, id" },
  operationalItems: { sqlName: "operational_item", orderBy: "place_id, sort_order, id" },
  operationalImages: { sqlName: "operational_image", orderBy: "vehicle_id, place_id, item_id, sort_order, id" },
  operationalDocuments: { sqlName: "operational_document", orderBy: "vehicle_id, place_id, item_id, created_at, id" },
  operationalVideos: { sqlName: "operational_video", orderBy: "vehicle_id, place_id, item_id, sort_order, id" },
  operationalHotspots: { sqlName: "operational_hotspot", orderBy: "vehicle_id, view_key, sort_order, id" },
  operationalPlaceHotspots: { sqlName: "operational_place_hotspot", orderBy: "place_id, sort_order, id" },
  operationalVehicleViews: { sqlName: "operational_vehicle_view", orderBy: "vehicle_id, sort_order, id" },
  operationalInteractiveNodes: { sqlName: "operational_interactive_node", orderBy: "place_id, sort_order, id" },
  operationalInteractiveLinks: { sqlName: "operational_interactive_link", orderBy: "place_id, source_node_id, sort_order, id" },
  operationalFavorites: { sqlName: "operational_favorite", orderBy: "user_id, created_at, id" },
  operationalRecent: { sqlName: "operational_recent", orderBy: "user_id, last_viewed_at, id" }
};

function storageRoot(env = process.env) {
  return String(env.OPERATIV_PORTAL_DATA_DIRECTORY || "").trim() || "/data/operativ-portal";
}

function storageDirectory(kind, env = process.env) {
  return path.join(storageRoot(env), kind === "image" ? "images" : "documents");
}

function safeStorageName(value) {
  const name = String(value ?? "").trim();
  if (!name || name === "." || name === ".." || name.includes("\0") || name !== path.basename(name) || path.isAbsolute(name)) {
    throw new Error("Operativ Portal indeholder et ugyldigt storage-filnavn.");
  }
  return name;
}

function storedPath(kind, storageName, env = process.env) {
  const directory = path.resolve(storageDirectory(kind, env));
  const name = safeStorageName(storageName);
  const resolved = path.resolve(directory, name);
  if (!resolved.startsWith(`${directory}${path.sep}`)) {
    throw new Error("Operativ storage-reference ligger uden for den tilladte mappe.");
  }
  return resolved;
}

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

async function queryTable(prisma, config) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT to_jsonb(t) AS row FROM ${config.sqlName} t ORDER BY ${config.orderBy}`
  );
  return rows.map((entry) => entry.row);
}

export async function collectOperationalBackup(prisma, env = process.env) {
  const entries = await Promise.all(
    OPERATIONAL_BACKUP_TABLE_NAMES.map(async (name) => [name, await queryTable(prisma, TABLE_CONFIG[name])])
  );
  const tables = Object.fromEntries(entries);
  const files = [];
  const seen = new Set();

  for (const { kind, rows } of [
    { kind: "image", rows: tables.operationalImages },
    { kind: "document", rows: tables.operationalDocuments }
  ]) {
    for (const row of rows) {
      const storageName = safeStorageName(row.storage_name);
      const key = `${kind}:${storageName}`;
      if (seen.has(key)) throw new Error(`Dubleret operativ storage-reference: ${storageName}`);
      seen.add(key);
      const filePath = storedPath(kind, storageName, env);
      let data;
      try {
        data = await readFile(filePath);
      } catch {
        throw new Error(`Operativ backup kan ikke oprettes, fordi filen ${storageName} mangler.`);
      }
      const expectedSize = Number(row.size_bytes);
      if (Number.isFinite(expectedSize) && expectedSize >= 0 && expectedSize !== data.length) {
        throw new Error(`Operativ filstørrelse stemmer ikke for ${storageName}.`);
      }
      files.push({ kind, storageName, data });
    }
  }

  return { tables, files };
}

export function normalizeOperationalTables(tables = {}) {
  return Object.fromEntries(
    OPERATIONAL_BACKUP_TABLE_NAMES.map((name) => [name, Array.isArray(tables[name]) ? tables[name] : []])
  );
}

export function validateOperationalBackupFiles(rawTables, files) {
  const tables = normalizeOperationalTables(rawTables);
  const expected = new Map();
  for (const [kind, rows] of [
    ["image", tables.operationalImages],
    ["document", tables.operationalDocuments]
  ]) {
    for (const row of rows) {
      const storageName = safeStorageName(row.storage_name);
      const key = `${kind}:${storageName}`;
      if (expected.has(key)) throw new Error(`Dubleret operativ database-reference: ${storageName}`);
      expected.set(key, Number(row.size_bytes));
    }
  }

  const actual = new Set();
  for (const file of files) {
    const kind = file?.kind === "image" || file?.kind === "document" ? file.kind : null;
    if (!kind) throw new Error("Backupen indeholder en ukendt operativ filtype.");
    const storageName = safeStorageName(file.storageName);
    const key = `${kind}:${storageName}`;
    if (actual.has(key)) throw new Error(`Backupen indeholder filen ${storageName} flere gange.`);
    actual.add(key);
    if (!expected.has(key)) throw new Error(`Backupen indeholder en uventet operativ fil: ${storageName}`);
    const expectedSize = expected.get(key);
    if (Number.isFinite(expectedSize) && expectedSize >= 0 && expectedSize !== file.sizeBytes) {
      throw new Error(`Backupfilens størrelse stemmer ikke med databasen for ${storageName}.`);
    }
  }

  for (const key of expected.keys()) {
    if (!actual.has(key)) throw new Error(`Backupen mangler den operative fil ${key.split(":").slice(1).join(":")}.`);
  }
}

async function insertJsonRows(tx, config, rows) {
  if (!rows.length) return;
  await tx.$executeRawUnsafe(
    `INSERT INTO ${config.sqlName} SELECT * FROM jsonb_populate_recordset(NULL::${config.sqlName}, $1::jsonb)`,
    JSON.stringify(rows)
  );
}

async function restoreInteractiveNodes(tx, rows) {
  if (!rows.length) return;
  const pending = rows.map((row) => ({ ...row }));
  const inserted = new Set();
  while (pending.length > 0) {
    const ready = pending.filter((row) => !row.parent_node_id || inserted.has(row.parent_node_id));
    if (ready.length === 0) {
      throw new Error("Operativ backup indeholder en ugyldig/cyklisk node-hierarki-reference.");
    }
    await insertJsonRows(tx, TABLE_CONFIG.operationalInteractiveNodes, ready);
    for (const row of ready) inserted.add(row.id);
    const readyIds = new Set(ready.map((row) => row.id));
    for (let index = pending.length - 1; index >= 0; index -= 1) {
      if (readyIds.has(pending[index].id)) pending.splice(index, 1);
    }
  }
}

async function restoreInteractiveImageRefs(tx, vehicles, places) {
  const vehicleRefs = vehicles
    .filter((row) => row.interactive_image_id)
    .map((row) => ({ id: row.id, interactive_image_id: row.interactive_image_id }));
  const placeRefs = places
    .filter((row) => row.interactive_image_id)
    .map((row) => ({ id: row.id, interactive_image_id: row.interactive_image_id }));

  if (vehicleRefs.length) {
    await tx.$executeRawUnsafe(
      `UPDATE operational_vehicle v
       SET interactive_image_id = x.interactive_image_id
       FROM jsonb_to_recordset($1::jsonb) AS x(id text, interactive_image_id text)
       WHERE v.id = x.id`,
      JSON.stringify(vehicleRefs)
    );
  }
  if (placeRefs.length) {
    await tx.$executeRawUnsafe(
      `UPDATE operational_place p
       SET interactive_image_id = x.interactive_image_id
       FROM jsonb_to_recordset($1::jsonb) AS x(id text, interactive_image_id text)
       WHERE p.id = x.id`,
      JSON.stringify(placeRefs)
    );
  }
}

export async function deleteOperationalData(tx) {
  await tx.$executeRawUnsafe('DELETE FROM operational_recent');
  await tx.$executeRawUnsafe('DELETE FROM operational_favorite');
  await tx.$executeRawUnsafe('DELETE FROM operational_interactive_link');
  await tx.$executeRawUnsafe('DELETE FROM operational_interactive_node');
  await tx.$executeRawUnsafe('DELETE FROM operational_place_hotspot');
  await tx.$executeRawUnsafe('DELETE FROM operational_hotspot');
  await tx.$executeRawUnsafe('DELETE FROM operational_vehicle_view');
  await tx.$executeRawUnsafe('DELETE FROM operational_video');
  await tx.$executeRawUnsafe('DELETE FROM operational_document');
  await tx.$executeRawUnsafe('UPDATE operational_vehicle SET interactive_image_id = NULL');
  await tx.$executeRawUnsafe('UPDATE operational_place SET interactive_image_id = NULL');
  await tx.$executeRawUnsafe('DELETE FROM operational_image');
  await tx.$executeRawUnsafe('DELETE FROM operational_item');
  await tx.$executeRawUnsafe('DELETE FROM operational_place');
  await tx.$executeRawUnsafe('DELETE FROM operational_vehicle');
}

export async function restoreOperationalData(tx, rawTables) {
  const tables = normalizeOperationalTables(rawTables);
  const vehicles = tables.operationalVehicles;
  const places = tables.operationalPlaces;

  await insertJsonRows(
    tx,
    TABLE_CONFIG.operationalVehicles,
    vehicles.map((row) => ({ ...row, interactive_image_id: null }))
  );
  await insertJsonRows(
    tx,
    TABLE_CONFIG.operationalPlaces,
    places.map((row) => ({ ...row, interactive_image_id: null }))
  );
  await insertJsonRows(tx, TABLE_CONFIG.operationalItems, tables.operationalItems);
  await insertJsonRows(tx, TABLE_CONFIG.operationalImages, tables.operationalImages);
  await restoreInteractiveImageRefs(tx, vehicles, places);
  await insertJsonRows(tx, TABLE_CONFIG.operationalDocuments, tables.operationalDocuments);
  await insertJsonRows(tx, TABLE_CONFIG.operationalVideos, tables.operationalVideos);
  await insertJsonRows(tx, TABLE_CONFIG.operationalHotspots, tables.operationalHotspots);
  await insertJsonRows(tx, TABLE_CONFIG.operationalPlaceHotspots, tables.operationalPlaceHotspots);
  await insertJsonRows(tx, TABLE_CONFIG.operationalVehicleViews, tables.operationalVehicleViews);
  await restoreInteractiveNodes(tx, tables.operationalInteractiveNodes);
  await insertJsonRows(tx, TABLE_CONFIG.operationalInteractiveLinks, tables.operationalInteractiveLinks);
  await insertJsonRows(tx, TABLE_CONFIG.operationalFavorites, tables.operationalFavorites);
  await insertJsonRows(tx, TABLE_CONFIG.operationalRecent, tables.operationalRecent);
}

export async function prepareOperationalFiles(files, env = process.env) {
  const createdPaths = [];
  try {
    await Promise.all([
      mkdir(storageDirectory("image", env), { recursive: true }),
      mkdir(storageDirectory("document", env), { recursive: true })
    ]);

    for (const file of files) {
      if (!file || !Buffer.isBuffer(file.data)) throw new Error("Operativ backupfil mangler filbytes.");
      const target = storedPath(file.kind, file.storageName, env);
      try {
        const existing = await readFile(target);
        if (sha256(existing) !== file.sha256 || existing.length !== file.sizeBytes) {
          throw new Error(`Eksisterende operativ fil kolliderer med backupen: ${file.storageName}`);
        }
        continue;
      } catch (error) {
        if (error instanceof Error && error.message.startsWith("Eksisterende operativ fil kolliderer")) throw error;
      }

      await writeFile(target, file.data, { flag: "wx", mode: 0o600 });
      createdPaths.push(target);
    }
    return createdPaths;
  } catch (error) {
    await cleanupPreparedOperationalFiles(createdPaths);
    throw error;
  }
}

export async function cleanupPreparedOperationalFiles(createdPaths) {
  for (const filePath of createdPaths) {
    await rm(filePath, { force: true }).catch(() => undefined);
  }
}

export async function pruneOperationalFiles(files, env = process.env) {
  const expected = {
    image: new Set(files.filter((file) => file.kind === "image").map((file) => safeStorageName(file.storageName))),
    document: new Set(files.filter((file) => file.kind === "document").map((file) => safeStorageName(file.storageName)))
  };

  for (const kind of ["image", "document"]) {
    const directory = storageDirectory(kind, env);
    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!entry.isFile() || expected[kind].has(entry.name)) continue;
      await rm(storedPath(kind, entry.name, env), { force: true }).catch(() => undefined);
    }
  }
}
