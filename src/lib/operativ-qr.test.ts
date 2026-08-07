import { describe, expect, it } from "vitest";
import { isAllowedOperationalPath, normalizeOperationalQrValue } from "./operativ-qr";

const VEHICLE_ID = "4e26e091-c1d6-4e34-a0e9-6d9f9c6632ee";
const ITEM_ID = "11111111-2222-4333-8444-555555555555";

describe("Operativ Portal QR-links", () => {
  it("accepterer interne køretøj rum og udstyrslinks", () => {
    expect(isAllowedOperationalPath(`/admin/operativ-portal/koeretoejer/${VEHICLE_ID}`)).toBe(true);
    expect(isAllowedOperationalPath(`/admin/operativ-portal/udstyr/${ITEM_ID}`)).toBe(true);
  });

  it("afviser links uden for Operativ Portal", () => {
    expect(isAllowedOperationalPath("/admin/brugere")).toBe(false);
    expect(isAllowedOperationalPath("/admin/operativ-portal/../brugere")).toBe(false);
    expect(isAllowedOperationalPath("https://example.com/")).toBe(false);
  });

  it("normaliserer absolutte links fra samme host", () => {
    expect(normalizeOperationalQrValue(
      `https://sbr-portal.racher.dk/admin/operativ-portal/koeretoejer/${VEHICLE_ID}`,
      "https://sbr-portal.racher.dk/admin/operativ-portal/scan"
    )).toBe(`/admin/operativ-portal/koeretoejer/${VEHICLE_ID}`);
  });

  it("afviser absolutte QR-links fra en anden host", () => {
    expect(normalizeOperationalQrValue(
      `https://example.com/admin/operativ-portal/koeretoejer/${VEHICLE_ID}`,
      "https://sbr-portal.racher.dk/admin/operativ-portal/scan"
    )).toBeNull();
  });
});
