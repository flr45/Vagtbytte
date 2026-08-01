import { readFile } from "node:fs/promises";

export type BackupEncryptionStatus = {
  configured: boolean;
  source: "secret-file" | "environment" | "missing";
  message: string;
};

export async function getBackupEncryptionStatus(): Promise<BackupEncryptionStatus> {
  let raw = "";
  let source: BackupEncryptionStatus["source"] = "missing";

  if (process.env.BACKUP_ENCRYPTION_KEY_FILE) {
    source = "secret-file";
    try {
      raw = await readFile(process.env.BACKUP_ENCRYPTION_KEY_FILE, "utf8");
    } catch {
      return {
        configured: false,
        source,
        message: "Nøglefilen findes ikke eller kan ikke læses."
      };
    }
  } else if (process.env.BACKUP_ENCRYPTION_KEY) {
    source = "environment";
    raw = process.env.BACKUP_ENCRYPTION_KEY;
  }

  const value = raw.trim();
  if (!value) {
    return {
      configured: false,
      source,
      message: "Backupkrypteringsnøglen mangler."
    };
  }

  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(value) || value.length % 4 !== 0) {
    return {
      configured: false,
      source,
      message: "Backupkrypteringsnøglen er ikke gyldig base64."
    };
  }

  const key = Buffer.from(value, "base64");
  if (key.length !== 32 || key.toString("base64") !== value) {
    return {
      configured: false,
      source,
      message: "Backupkrypteringsnøglen skal være præcis 32 bytes."
    };
  }

  return {
    configured: true,
    source,
    message:
      source === "secret-file"
        ? "AES-256-GCM er aktiv, og nøglen indlæses fra en Docker-secret."
        : "AES-256-GCM er aktiv."
  };
}

export function isEncryptedBackupFileName(fileName: string) {
  return fileName.endsWith(".vagtbackup.enc");
}
