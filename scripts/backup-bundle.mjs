import { createHash } from "node:crypto";
import { validateOperationalBackupFiles } from "./operational-backup.mjs";

const BUNDLE_MAGIC = Buffer.from("SBRBND2\0", "ascii");
const LENGTH_BYTES = 4;
const MAX_MANIFEST_BYTES = 64 * 1024 * 1024;

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function safeStorageName(value) {
  const name = String(value ?? "").trim();
  if (!name || name === "." || name === ".." || name.includes("\0") || name.includes("/") || name.includes("\\")) {
    throw new Error("Backupen indeholder et ugyldigt storage-filnavn.");
  }
  return name;
}

function normalizeFiles(files) {
  return files.map((file) => {
    if (!file || !Buffer.isBuffer(file.data)) {
      throw new Error("Backupfilens operative filindhold er ugyldigt.");
    }
    const kind = file.kind === "image" || file.kind === "document" ? file.kind : null;
    if (!kind) throw new Error("Backupfilen indeholder en ukendt operativ filtype.");
    const storageName = safeStorageName(file.storageName);
    return {
      kind,
      storageName,
      sizeBytes: file.data.length,
      sha256: sha256(file.data),
      data: file.data
    };
  });
}

export function encodeBackupBundle(data, files = []) {
  const normalized = normalizeFiles(files);
  validateOperationalBackupFiles(data?.tables ?? {}, normalized);
  const manifest = {
    ...data,
    files: normalized.map(({ kind, storageName, sizeBytes, sha256: digest }) => ({
      kind,
      storageName,
      sizeBytes,
      sha256: digest
    }))
  };
  const manifestBuffer = Buffer.from(JSON.stringify(manifest), "utf8");
  if (manifestBuffer.length > MAX_MANIFEST_BYTES) {
    throw new Error("Backupmanifestet er for stort.");
  }

  const length = Buffer.alloc(LENGTH_BYTES);
  length.writeUInt32BE(manifestBuffer.length, 0);
  return Buffer.concat([
    BUNDLE_MAGIC,
    length,
    manifestBuffer,
    ...normalized.map((file) => file.data)
  ]);
}

export function decodeBackupBundle(buffer) {
  if (!Buffer.isBuffer(buffer)) throw new Error("Backupindholdet skal være en Buffer.");

  if (!buffer.subarray(0, BUNDLE_MAGIC.length).equals(BUNDLE_MAGIC)) {
    let legacy;
    try {
      legacy = JSON.parse(buffer.toString("utf8"));
    } catch {
      throw new Error("Backupfilens data er hverken et gyldigt v2-bundle eller ældre JSON-format.");
    }
    return { parsed: legacy, files: [], bundled: false };
  }

  if (buffer.length < BUNDLE_MAGIC.length + LENGTH_BYTES) {
    throw new Error("Backupbundlen er ufuldstændig.");
  }
  const manifestLength = buffer.readUInt32BE(BUNDLE_MAGIC.length);
  if (manifestLength < 2 || manifestLength > MAX_MANIFEST_BYTES) {
    throw new Error("Backupbundlens manifestlængde er ugyldig.");
  }

  const manifestStart = BUNDLE_MAGIC.length + LENGTH_BYTES;
  const manifestEnd = manifestStart + manifestLength;
  if (manifestEnd > buffer.length) throw new Error("Backupbundlens manifest er ufuldstændigt.");

  let parsed;
  try {
    parsed = JSON.parse(buffer.subarray(manifestStart, manifestEnd).toString("utf8"));
  } catch {
    throw new Error("Backupbundlens manifest er ikke gyldig JSON.");
  }

  if (!Array.isArray(parsed.files)) throw new Error("Backupbundlen mangler fillisten.");

  const seen = new Set();
  const files = [];
  let offset = manifestEnd;
  for (const descriptor of parsed.files) {
    const kind = descriptor?.kind === "image" || descriptor?.kind === "document" ? descriptor.kind : null;
    if (!kind) throw new Error("Backupbundlen indeholder en ukendt operativ filtype.");
    const storageName = safeStorageName(descriptor.storageName);
    const key = `${kind}:${storageName}`;
    if (seen.has(key)) throw new Error("Backupbundlen indeholder samme operative fil flere gange.");
    seen.add(key);

    const sizeBytes = Number(descriptor.sizeBytes);
    if (!Number.isSafeInteger(sizeBytes) || sizeBytes < 0) {
      throw new Error("Backupbundlen indeholder en ugyldig filstørrelse.");
    }
    const end = offset + sizeBytes;
    if (end > buffer.length) throw new Error(`Backupbundlen mangler bytes til ${storageName}.`);
    const data = Buffer.from(buffer.subarray(offset, end));
    const digest = sha256(data);
    if (!/^[0-9a-f]{64}$/i.test(String(descriptor.sha256 ?? "")) || digest !== String(descriptor.sha256).toLowerCase()) {
      throw new Error(`Integritetskontrollen fejlede for ${storageName}.`);
    }
    files.push({ kind, storageName, sizeBytes, sha256: digest, data });
    offset = end;
  }

  if (offset !== buffer.length) {
    throw new Error("Backupbundlen indeholder uventede ekstra bytes.");
  }

  validateOperationalBackupFiles(parsed.tables ?? {}, files);
  return { parsed, files, bundled: true };
}
