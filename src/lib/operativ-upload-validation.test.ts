import { describe, expect, it } from "vitest";
import {
  sanitizeOperationalImageMetadata,
  validateOperationalDocumentUpload,
  validateOperationalImageUpload
} from "./operativ-upload-validation";

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function pngChunk(type: string, data = Buffer.alloc(0)) {
  const chunk = Buffer.alloc(12 + data.length);
  chunk.writeUInt32BE(data.length, 0);
  chunk.write(type, 4, "ascii");
  data.copy(chunk, 8);
  return chunk;
}

function webpChunk(type: string, data: Buffer) {
  const padded = data.length + (data.length % 2);
  const chunk = Buffer.alloc(8 + padded);
  chunk.write(type, 0, "ascii");
  chunk.writeUInt32LE(data.length, 4);
  data.copy(chunk, 8);
  return chunk;
}

function webp(...chunks: Buffer[]) {
  const body = Buffer.concat(chunks);
  const header = Buffer.alloc(12);
  header.write("RIFF", 0, "ascii");
  header.writeUInt32LE(body.length + 4, 4);
  header.write("WEBP", 8, "ascii");
  return Buffer.concat([header, body]);
}

describe("Operativ Portal uploadvalidering", () => {
  it("afviser et spoofet JPEG, selv om browseren kalder filen image/jpeg", () => {
    expect(validateOperationalImageUpload(Buffer.from("ikke et billede"), "image/jpeg")).toBeNull();
  });

  it("genkender JPEG, PNG og WebP fra filens bytes", () => {
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
    const png = Buffer.concat([PNG_SIGNATURE, pngChunk("IEND")]);
    const vp8x = Buffer.alloc(10);
    const webpFile = webp(webpChunk("VP8X", vp8x));

    expect(validateOperationalImageUpload(jpeg, "image/jpeg")?.extension).toBe(".jpg");
    expect(validateOperationalImageUpload(png, "image/png")?.extension).toBe(".png");
    expect(validateOperationalImageUpload(webpFile, "image/webp")?.extension).toBe(".webp");
    expect(validateOperationalImageUpload(png, "image/jpeg")).toBeNull();
  });

  it("validerer PDF og Office-format mod filindhold og filendelse", () => {
    expect(
      validateOperationalDocumentUpload(Buffer.from("%PDF-1.7\n"), "application/pdf", "instruks.pdf")
    ).toMatchObject({ extension: ".pdf" });

    const docx = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from("word/document.xml")]);
    expect(
      validateOperationalDocumentUpload(
        docx,
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "instruks.docx"
      )
    ).toMatchObject({ extension: ".docx" });
    expect(
      validateOperationalDocumentUpload(
        docx,
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "instruks.xlsx"
      )
    ).toBeNull();
  });
});

describe("Operativ Portal metadata-rensning", () => {
  it("fjerner EXIF/APP1 og kommentarer fra JPEG", () => {
    const app1 = Buffer.concat([
      Buffer.from([0xff, 0xe1, 0x00, 0x08]),
      Buffer.from("Exif\u0000\u0000", "binary")
    ]);
    const comment = Buffer.concat([
      Buffer.from([0xff, 0xfe, 0x00, 0x07]),
      Buffer.from("GPS12", "ascii")
    ]);
    const scan = Buffer.from([0xff, 0xda, 0x00, 0x02, 0xff, 0xd9]);
    const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8]), app1, comment, scan, Buffer.from("trailing")]);

    const sanitized = sanitizeOperationalImageMetadata(jpeg, "image/jpeg");
    expect(sanitized).not.toBeNull();
    expect(sanitized?.includes(Buffer.from("Exif", "ascii"))).toBe(false);
    expect(sanitized?.includes(Buffer.from("GPS12", "ascii"))).toBe(false);
    expect(sanitized?.includes(Buffer.from("trailing", "ascii"))).toBe(false);
  });

  it("fjerner tekst- og EXIF-chunks fra PNG", () => {
    const png = Buffer.concat([
      PNG_SIGNATURE,
      pngChunk("tEXt", Buffer.from("GPS=55.4,11.3")),
      pngChunk("eXIf", Buffer.from("private")),
      pngChunk("IDAT", Buffer.from([1, 2, 3])),
      pngChunk("IEND")
    ]);

    const sanitized = sanitizeOperationalImageMetadata(png, "image/png");
    expect(sanitized).not.toBeNull();
    expect(sanitized?.includes(Buffer.from("GPS=", "ascii"))).toBe(false);
    expect(sanitized?.includes(Buffer.from("private", "ascii"))).toBe(false);
    expect(sanitized?.includes(Buffer.from("IDAT", "ascii"))).toBe(true);
  });

  it("fjerner EXIF/XMP fra WebP og nulstiller metadata-flags", () => {
    const vp8x = Buffer.alloc(10);
    vp8x[0] = 0x0c;
    const original = webp(
      webpChunk("VP8X", vp8x),
      webpChunk("EXIF", Buffer.from("GPS private")),
      webpChunk("XMP ", Buffer.from("xmp private")),
      webpChunk("VP8 ", Buffer.from([1, 2, 3, 4]))
    );

    const sanitized = sanitizeOperationalImageMetadata(original, "image/webp");
    expect(sanitized).not.toBeNull();
    expect(sanitized?.includes(Buffer.from("GPS private"))).toBe(false);
    expect(sanitized?.includes(Buffer.from("xmp private"))).toBe(false);
    expect(sanitized?.subarray(20, 21)[0] & 0x0c).toBe(0);
  });
});
