import path from "node:path";

export type ValidatedOperationalUpload = {
  mimeType: string;
  extension: string;
};

const JPEG = Buffer.from([0xff, 0xd8, 0xff]);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const PDF = Buffer.from("%PDF-", "ascii");
const OLE = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
const JPEG_EOI = Buffer.from([0xff, 0xd9]);

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
    buffer.subarray(8, 12).toString("ascii") === "WEBP" &&
    buffer.readUInt32LE(4) + 8 === buffer.length
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

export function sanitizeOperationalImageMetadata(buffer: Buffer, mimeType: string): Buffer | null {
  if (mimeType === "image/jpeg") return sanitizeJpeg(buffer);
  if (mimeType === "image/png") return sanitizePng(buffer);
  if (mimeType === "image/webp") return sanitizeWebp(buffer);
  return null;
}

function sanitizeJpeg(buffer: Buffer) {
  if (!startsWith(buffer, JPEG)) return null;

  const parts: Buffer[] = [buffer.subarray(0, 2)];
  let offset = 2;

  while (offset < buffer.length) {
    const markerStart = offset;
    if (buffer[offset] !== 0xff) return null;
    while (offset < buffer.length && buffer[offset] === 0xff) offset += 1;
    if (offset >= buffer.length) return null;

    const marker = buffer[offset];
    offset += 1;

    if (marker === 0xda) {
      if (offset + 2 > buffer.length) return null;
      const segmentLength = buffer.readUInt16BE(offset);
      if (segmentLength < 2 || offset + segmentLength > buffer.length) return null;
      const scanStart = offset + segmentLength;
      const eoi = buffer.indexOf(JPEG_EOI, scanStart);
      if (eoi < 0) return null;
      parts.push(buffer.subarray(markerStart, eoi + JPEG_EOI.length));
      return Buffer.concat(parts);
    }

    if (marker === 0xd9) {
      parts.push(buffer.subarray(markerStart, offset));
      return Buffer.concat(parts);
    }

    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      parts.push(buffer.subarray(markerStart, offset));
      continue;
    }

    if (offset + 2 > buffer.length) return null;
    const segmentLength = buffer.readUInt16BE(offset);
    const segmentEnd = offset + segmentLength;
    if (segmentLength < 2 || segmentEnd > buffer.length) return null;

    const containsPersonalMetadata = marker === 0xe1 || marker === 0xed || marker === 0xfe;
    if (!containsPersonalMetadata) parts.push(buffer.subarray(markerStart, segmentEnd));
    offset = segmentEnd;
  }

  return null;
}

function sanitizePng(buffer: Buffer) {
  if (!startsWith(buffer, PNG)) return null;

  const parts: Buffer[] = [buffer.subarray(0, PNG.length)];
  const strippedChunks = new Set(["tEXt", "zTXt", "iTXt", "eXIf"]);
  let offset = PNG.length;
  let sawIend = false;

  while (offset < buffer.length) {
    if (offset + 12 > buffer.length) return null;
    const dataLength = buffer.readUInt32BE(offset);
    const chunkEnd = offset + 12 + dataLength;
    if (chunkEnd > buffer.length) return null;
    const type = buffer.subarray(offset + 4, offset + 8).toString("ascii");

    if (!strippedChunks.has(type)) parts.push(buffer.subarray(offset, chunkEnd));
    offset = chunkEnd;

    if (type === "IEND") {
      sawIend = true;
      break;
    }
  }

  if (!sawIend || offset !== buffer.length) return null;
  return Buffer.concat(parts);
}

function sanitizeWebp(buffer: Buffer) {
  if (!isWebp(buffer)) return null;

  const chunks: Buffer[] = [];
  let offset = 12;

  while (offset < buffer.length) {
    if (offset + 8 > buffer.length) return null;
    const type = buffer.subarray(offset, offset + 4).toString("ascii");
    const dataLength = buffer.readUInt32LE(offset + 4);
    const paddedLength = dataLength + (dataLength % 2);
    const chunkEnd = offset + 8 + paddedLength;
    if (chunkEnd > buffer.length) return null;

    if (type !== "EXIF" && type !== "XMP ") {
      if (type === "VP8X" && dataLength >= 1) {
        const copy = Buffer.from(buffer.subarray(offset, chunkEnd));
        copy[8] &= ~0x0c;
        chunks.push(copy);
      } else {
        chunks.push(buffer.subarray(offset, chunkEnd));
      }
    }

    offset = chunkEnd;
  }

  if (offset !== buffer.length) return null;
  const body = Buffer.concat(chunks);
  const header = Buffer.alloc(12);
  header.write("RIFF", 0, "ascii");
  header.writeUInt32LE(body.length + 4, 4);
  header.write("WEBP", 8, "ascii");
  return Buffer.concat([header, body]);
}
