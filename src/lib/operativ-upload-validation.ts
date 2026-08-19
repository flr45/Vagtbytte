import path from "node:path";

export type ValidatedOperationalUpload = {
  mimeType: string;
  extension: string;
};

const JPEG = Buffer.from([0xff, 0xd8, 0xff]);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const PDF = Buffer.from("%PDF-", "ascii");
const OLE = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);

const IMAGE_TYPES: Record<string, ValidatedOperationalUpload> = {
  "image/jpeg": { mimeType: "image/jpeg", extension: ".jpg" },
  "image/png": { mimeType: "image/png", extension: ".png" },
  "image/webp": { mimeType: "image/webp", extension: ".webp" }
};

const DOCUMENT_TYPES: Record<string, ValidatedOperationalUpload> = {
  "application/pdf": { mimeType: "application/pdf", extension: ".pdf" },
  "application/msword": { mimeType: "application/msword", extension: ".doc" },
  "application/vnd.ms-excel": { mimeType: "application/vnd.ms-excel", extension: ".xls" },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    extension: ".docx"
  },
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": {
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    extension: ".xlsx"
  },
  ...IMAGE_TYPES
};

function startsWith(buffer: Buffer, signature: Buffer) {
  return buffer.length >= signature.length && buffer.subarray(0, signature.length).equals(signature);
}

function isWebp(buffer: Buffer) {
  return (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  );
}

function isZip(buffer: Buffer) {
  return (
    buffer.length >= 4 &&
    buffer[0] === 0x50 &&
    buffer[1] === 0x4b &&
    ((buffer[2] === 0x03 && buffer[3] === 0x04) ||
      (buffer[2] === 0x05 && buffer[3] === 0x06) ||
      (buffer[2] === 0x07 && buffer[3] === 0x08))
  );
}

function zipContainsEntryPrefix(buffer: Buffer, prefix: string) {
  return buffer.includes(Buffer.from(prefix, "utf8"));
}

export function detectOperationalImageType(buffer: Buffer): ValidatedOperationalUpload | null {
  if (startsWith(buffer, JPEG)) return IMAGE_TYPES["image/jpeg"];
  if (startsWith(buffer, PNG)) return IMAGE_TYPES["image/png"];
  if (isWebp(buffer)) return IMAGE_TYPES["image/webp"];
  return null;
}

export function validateOperationalImageUpload(
  buffer: Buffer,
  declaredMimeType: string
): ValidatedOperationalUpload | null {
  const detected = detectOperationalImageType(buffer);
  if (!detected || detected.mimeType !== declaredMimeType) return null;
  return detected;
}

export function validateOperationalDocumentUpload(
  buffer: Buffer,
  declaredMimeType: string,
  originalName: string
): ValidatedOperationalUpload | null {
  const allowed = DOCUMENT_TYPES[declaredMimeType];
  if (!allowed) return null;

  const detectedImage = detectOperationalImageType(buffer);
  if (detectedImage) {
    return detectedImage.mimeType === declaredMimeType ? detectedImage : null;
  }

  if (declaredMimeType === "application/pdf") {
    return startsWith(buffer, PDF) ? allowed : null;
  }

  const originalExtension = path.extname(originalName).toLowerCase();
  if (declaredMimeType === "application/msword" || declaredMimeType === "application/vnd.ms-excel") {
    if (!startsWith(buffer, OLE) || originalExtension !== allowed.extension) return null;
    return allowed;
  }

  if (!isZip(buffer)) return null;

  if (declaredMimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    if (originalExtension !== ".docx" || !zipContainsEntryPrefix(buffer, "word/")) return null;
    return allowed;
  }

  if (declaredMimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") {
    if (originalExtension !== ".xlsx" || !zipContainsEntryPrefix(buffer, "xl/")) return null;
    return allowed;
  }

  return null;
}
