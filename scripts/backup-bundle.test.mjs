import { describe, expect, it } from "vitest";
import { decodeBackupBundle, encodeBackupBundle } from "./backup-bundle.mjs";

function dataWithFiles({ image = null, document = null } = {}) {
  return {
    format: "vagtbytte-backup",
    version: 2,
    generatedAt: "2026-08-19T12:00:00.000Z",
    tables: {
      users: [],
      operationalVehicles: [],
      operationalPlaces: [],
      operationalItems: [],
      operationalImages: image
        ? [{ storage_name: "image-1.jpg", size_bytes: image.length }]
        : [],
      operationalDocuments: document
        ? [{ storage_name: "document-1.pdf", size_bytes: document.length }]
        : [],
      operationalVideos: [],
      operationalHotspots: [],
      operationalPlaceHotspots: [],
      operationalVehicleViews: [],
      operationalInteractiveNodes: [],
      operationalInteractiveLinks: [],
      operationalFavorites: [],
      operationalRecent: []
    }
  };
}

describe("backup v2 bundle", () => {
  it("pakker manifest og operative filer uden base64", () => {
    const image = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
    const document = Buffer.from("%PDF-1.7\n", "ascii");
    const encoded = encodeBackupBundle(dataWithFiles({ image, document }), [
      { kind: "image", storageName: "image-1.jpg", data: image },
      { kind: "document", storageName: "document-1.pdf", data: document }
    ]);
    const decoded = decodeBackupBundle(encoded);

    expect(decoded.bundled).toBe(true);
    expect(decoded.parsed.version).toBe(2);
    expect(decoded.files).toHaveLength(2);
    expect(decoded.files[0].data.equals(image)).toBe(true);
    expect(decoded.files[1].data.equals(document)).toBe(true);
    expect(decoded.parsed.files[0].sha256).toHaveLength(64);
  });

  it("afviser ændrede filbytes", () => {
    const image = Buffer.from("original");
    const encoded = encodeBackupBundle(dataWithFiles({ image }), [
      { kind: "image", storageName: "image-1.jpg", data: image }
    ]);
    const tampered = Buffer.from(encoded);
    tampered[tampered.length - 1] ^= 0xff;

    expect(() => decodeBackupBundle(tampered)).toThrow(/Integritetskontrollen fejlede/);
  });

  it("afviser path traversal i storage-navne", () => {
    const document = Buffer.from("x");
    const data = dataWithFiles({ document });
    data.tables.operationalDocuments[0].storage_name = "../secret.pdf";

    expect(() =>
      encodeBackupBundle(data, [
        { kind: "document", storageName: "../secret.pdf", data: document }
      ])
    ).toThrow(/ugyldigt storage-filnavn/);
  });

  it("afviser manglende fil, selv hvis manifesttabellen refererer til den", () => {
    const image = Buffer.from("image");
    expect(() => encodeBackupBundle(dataWithFiles({ image }), [])).toThrow(/mangler den operative fil/);
  });

  it("afviser ekstra fil, som ikke findes i databasen", () => {
    expect(() =>
      encodeBackupBundle(dataWithFiles(), [
        { kind: "image", storageName: "image-1.jpg", data: Buffer.from("extra") }
      ])
    ).toThrow(/uventet operativ fil/);
  });

  it("læser ældre JSON-payload som legacy uden operative filer", () => {
    const decoded = decodeBackupBundle(Buffer.from(JSON.stringify({
      format: "vagtbytte-backup",
      version: 1,
      generatedAt: "2026-08-01T00:00:00.000Z",
      tables: { users: [] }
    })));

    expect(decoded.bundled).toBe(false);
    expect(decoded.files).toEqual([]);
    expect(decoded.parsed.version).toBe(1);
  });
});
