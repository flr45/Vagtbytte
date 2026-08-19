import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  OPERATIONAL_BACKUP_TABLE_NAMES,
  cleanupPreparedOperationalFiles,
  normalizeOperationalTables,
  prepareOperationalFiles,
  pruneOperationalFiles,
  restoreOperationalData
} from "./operational-backup.mjs";

const tempRoots = [];
afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function tempEnv() {
  const root = await mkdtemp(path.join(os.tmpdir(), "sbr-operativ-backup-"));
  tempRoots.push(root);
  return { OPERATIV_PORTAL_DATA_DIRECTORY: root };
}

function descriptor(kind, storageName, data) {
  return {
    kind,
    storageName,
    data,
    sizeBytes: data.length,
    sha256: createHash("sha256").update(data).digest("hex")
  };
}

describe("Operativ Portal backupfiler", () => {
  it("forbereder manglende filer med korrekt indhold", async () => {
    const env = await tempEnv();
    const data = Buffer.from("billede");
    const created = await prepareOperationalFiles([descriptor("image", "image-1.jpg", data)], env);

    expect(created).toHaveLength(1);
    expect(await readFile(path.join(env.OPERATIV_PORTAL_DATA_DIRECTORY, "images", "image-1.jpg"), "utf8")).toBe("billede");

    await cleanupPreparedOperationalFiles(created);
  });

  it("accepterer identisk eksisterende fil, men afviser kolliderende bytes", async () => {
    const env = await tempEnv();
    const dir = path.join(env.OPERATIV_PORTAL_DATA_DIRECTORY, "documents");
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, "doc-1.pdf"), Buffer.from("original"));

    const identical = descriptor("document", "doc-1.pdf", Buffer.from("original"));
    expect(await prepareOperationalFiles([identical], env)).toEqual([]);

    const collision = descriptor("document", "doc-1.pdf", Buffer.from("andet"));
    await expect(prepareOperationalFiles([collision], env)).rejects.toThrow(/kolliderer/);
  });

  it("pruner kun filer, som ikke findes i det gendannede snapshot", async () => {
    const env = await tempEnv();
    const dir = path.join(env.OPERATIV_PORTAL_DATA_DIRECTORY, "images");
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, "keep.jpg"), "keep");
    await writeFile(path.join(dir, "orphan.jpg"), "orphan");

    await pruneOperationalFiles([descriptor("image", "keep.jpg", Buffer.from("keep"))], env);

    expect(await readFile(path.join(dir, "keep.jpg"), "utf8")).toBe("keep");
    await expect(readFile(path.join(dir, "orphan.jpg"))).rejects.toThrow();
  });
});

describe("Operativ Portal database-restore", () => {
  it("normaliserer alle operative tabeller, så manglende input aldrig bliver undefined", () => {
    const tables = normalizeOperationalTables({ operationalVehicles: [{ id: "v1" }] });
    expect(Object.keys(tables)).toEqual(OPERATIONAL_BACKUP_TABLE_NAMES);
    expect(tables.operationalVehicles).toHaveLength(1);
    expect(tables.operationalImages).toEqual([]);
  });

  it("indsætter forældrenoder før børn og nulstiller billedreference indtil billeder findes", async () => {
    const calls = [];
    const tx = {
      async $executeRawUnsafe(query, ...values) {
        calls.push({ query, values });
        return 1;
      }
    };

    await restoreOperationalData(tx, {
      operationalVehicles: [{ id: "v1", name: "V1", interactive_image_id: "img-1" }],
      operationalPlaces: [{ id: "p1", vehicle_id: "v1", name: "Rum", interactive_image_id: "img-1" }],
      operationalItems: [],
      operationalImages: [{ id: "img-1", vehicle_id: "v1", storage_name: "img.jpg" }],
      operationalDocuments: [],
      operationalVideos: [],
      operationalHotspots: [],
      operationalPlaceHotspots: [],
      operationalVehicleViews: [],
      operationalInteractiveNodes: [
        { id: "child", place_id: "p1", parent_node_id: "parent", name: "Barn" },
        { id: "parent", place_id: "p1", parent_node_id: null, name: "Forælder" }
      ],
      operationalInteractiveLinks: [],
      operationalFavorites: [],
      operationalRecent: []
    });

    const insertCalls = calls.filter((call) => call.query.startsWith("INSERT INTO"));
    const vehicleRows = JSON.parse(insertCalls[0].values[0]);
    expect(vehicleRows[0].interactive_image_id).toBeNull();

    const nodeCalls = insertCalls.filter((call) => call.query.includes("operational_interactive_node"));
    expect(nodeCalls).toHaveLength(2);
    expect(JSON.parse(nodeCalls[0].values[0])[0].id).toBe("parent");
    expect(JSON.parse(nodeCalls[1].values[0])[0].id).toBe("child");
    expect(calls.some((call) => call.query.includes("SET interactive_image_id"))).toBe(true);
  });

  it("afviser cykliske node-hierarkier", async () => {
    const tx = { async $executeRawUnsafe() { return 1; } };
    await expect(restoreOperationalData(tx, {
      operationalInteractiveNodes: [
        { id: "a", parent_node_id: "b" },
        { id: "b", parent_node_id: "a" }
      ]
    })).rejects.toThrow(/cyklisk/);
  });
});
