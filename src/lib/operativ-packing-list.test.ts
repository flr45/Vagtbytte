import { describe, expect, it } from "vitest";
import { createPackingListPdf, normalizePlaceKey, parsePackingListText } from "./operativ-packing-list";

describe("operativ pakkeliste PDF", () => {
  it("finder rum, udstyr og antal under rumoverskrifter", () => {
    const rows = parsePackingListText(`
      Pakkeliste M2
      H1
      2 x Højtryksslange (HT)
      1 x Skumrør
      Note: ignoreres som metadata

      Rum 2 - højre side
      Motorsav    1    Reserve
    `);

    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({ placeName: "H1", itemName: "Højtryksslange (HT)", quantity: 2 });
    expect(rows[1]).toMatchObject({ placeName: "H1", itemName: "Skumrør", quantity: 1 });
    expect(rows[2]).toMatchObject({ placeName: "Rum 2 - højre side", itemName: "Motorsav", quantity: 1, note: "Reserve" });
  });

  it("matcher stabile rumkoder selv med beskrivende suffix", () => {
    expect(normalizePlaceKey("Rum 1 - venstre forrest")).toBe(normalizePlaceKey("Rum 1"));
    expect(normalizePlaceKey("H 1")).toBe(normalizePlaceKey("H1"));
  });

  it("genererer en gyldig PDF-signatur", () => {
    const pdf = createPackingListPdf({
      vehicleName: "Sprøjte M2",
      code: "M2",
      model: "Scania P 360",
      generatedAt: new Date("2026-08-07T12:00:00Z"),
      places: [{
        name: "H1",
        items: [{ name: "Højtryksslange (HT)", quantity: 1, note: "60 meter" }]
      }]
    });

    expect(Buffer.from(pdf).subarray(0, 8).toString("latin1")).toBe("%PDF-1.4");
    expect(Buffer.from(pdf).toString("latin1")).toContain("Højtryksslange (HT)");
  });
});
