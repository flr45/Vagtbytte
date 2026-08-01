import { describe, expect, it } from "vitest";
import {
  decryptStoredBackup,
  encryptCompressedBackup,
  isEncryptedBackup,
  parseBackupEncryptionKey
} from "./backup-crypto.mjs";

describe("backupkryptering", () => {
  const key = Buffer.alloc(32, 7);
  const otherKey = Buffer.alloc(32, 8);
  const iv = Buffer.alloc(12, 9);
  const compressed = Buffer.from("komprimeret backupindhold");

  it("kan kryptere og dekryptere samme indhold", () => {
    const encrypted = encryptCompressedBackup(compressed, key, iv);

    expect(isEncryptedBackup(encrypted)).toBe(true);
    expect(encrypted.equals(compressed)).toBe(false);
    expect(decryptStoredBackup(encrypted, key)).toEqual(compressed);
  });

  it("afviser en forkert nøgle", () => {
    const encrypted = encryptCompressedBackup(compressed, key, iv);

    expect(() => decryptStoredBackup(encrypted, otherKey)).toThrow(/kunne ikke dekrypteres/i);
  });

  it("opdager ændringer i den krypterede fil", () => {
    const encrypted = encryptCompressedBackup(compressed, key, iv);
    const changed = Buffer.from(encrypted);
    changed[changed.length - 1] ^= 1;

    expect(() => decryptStoredBackup(changed, key)).toThrow(/blevet ændret/i);
  });

  it("kræver en 32-byte base64-nøgle", () => {
    expect(parseBackupEncryptionKey(key.toString("base64"))).toEqual(key);
    expect(() => parseBackupEncryptionKey("for-kort")).toThrow();
    expect(() => parseBackupEncryptionKey("")).toThrow(/mangler/i);
  });
});
