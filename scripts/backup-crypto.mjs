import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";

const MAGIC = Buffer.from("VAGTBK2\0", "ascii");
const VERSION = 1;
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const PREFIX_LENGTH = MAGIC.length + 1 + IV_LENGTH;
const HEADER_LENGTH = PREFIX_LENGTH + AUTH_TAG_LENGTH;

export async function loadBackupEncryptionKey(env = process.env) {
  let raw = "";

  if (env.BACKUP_ENCRYPTION_KEY_FILE) {
    try {
      raw = await readFile(env.BACKUP_ENCRYPTION_KEY_FILE, "utf8");
    } catch {
      throw new Error("Backupkrypteringsnøglen kunne ikke læses fra BACKUP_ENCRYPTION_KEY_FILE.");
    }
  } else {
    raw = env.BACKUP_ENCRYPTION_KEY || "";
  }

  return parseBackupEncryptionKey(raw);
}

export function parseBackupEncryptionKey(raw) {
  const value = String(raw || "").trim();
  if (!value) {
    throw new Error(
      "Backupkrypteringsnøglen mangler. Nye backups oprettes ikke ukrypteret."
    );
  }

  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(value) || value.length % 4 !== 0) {
    throw new Error("Backupkrypteringsnøglen skal være gyldig base64.");
  }

  const key = Buffer.from(value, "base64");
  if (key.length !== 32 || key.toString("base64") !== value) {
    throw new Error("Backupkrypteringsnøglen skal være præcis 32 tilfældige bytes i base64-format.");
  }

  return key;
}

export function encryptCompressedBackup(compressed, key, iv = randomBytes(IV_LENGTH)) {
  assertKey(key);
  if (!Buffer.isBuffer(compressed)) throw new Error("Backupdata skal være en Buffer.");
  if (!Buffer.isBuffer(iv) || iv.length !== IV_LENGTH) {
    throw new Error(`AES-GCM IV skal være ${IV_LENGTH} bytes.`);
  }

  const version = Buffer.from([VERSION]);
  const prefix = Buffer.concat([MAGIC, version, iv]);
  const cipher = createCipheriv("aes-256-gcm", key, iv, { authTagLength: AUTH_TAG_LENGTH });
  cipher.setAAD(prefix);
  const ciphertext = Buffer.concat([cipher.update(compressed), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return Buffer.concat([prefix, authTag, ciphertext]);
}

export function decryptStoredBackup(stored, key) {
  assertKey(key);
  if (!isEncryptedBackup(stored)) {
    throw new Error("Filen er ikke en krypteret Vagtbytte-backup.");
  }
  if (stored.length <= HEADER_LENGTH) {
    throw new Error("Den krypterede backupfil er beskadiget eller ufuldstændig.");
  }

  const version = stored[MAGIC.length];
  if (version !== VERSION) {
    throw new Error(`Backupens krypteringsformat version ${version} understøttes ikke.`);
  }

  const prefix = stored.subarray(0, PREFIX_LENGTH);
  const iv = stored.subarray(MAGIC.length + 1, PREFIX_LENGTH);
  const authTag = stored.subarray(PREFIX_LENGTH, HEADER_LENGTH);
  const ciphertext = stored.subarray(HEADER_LENGTH);

  try {
    const decipher = createDecipheriv("aes-256-gcm", key, iv, {
      authTagLength: AUTH_TAG_LENGTH
    });
    decipher.setAAD(prefix);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  } catch {
    throw new Error(
      "Backupfilen kunne ikke dekrypteres. Nøglen er forkert, eller filen er blevet ændret."
    );
  }
}

export function isEncryptedBackup(value) {
  return (
    Buffer.isBuffer(value) &&
    value.length >= MAGIC.length + 1 &&
    value.subarray(0, MAGIC.length).equals(MAGIC)
  );
}

export function isLegacyGzipBackup(value) {
  return Buffer.isBuffer(value) && value.length >= 2 && value[0] === 0x1f && value[1] === 0x8b;
}

function assertKey(key) {
  if (!Buffer.isBuffer(key) || key.length !== 32) {
    throw new Error("AES-256-GCM kræver en nøgle på 32 bytes.");
  }
}
