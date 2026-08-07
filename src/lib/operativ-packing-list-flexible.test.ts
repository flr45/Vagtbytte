import { describe, expect, it } from "vitest";
import { parseOperationalPackingListText } from "./operativ-packing-list-flexible";

describe("fleksibel Operativ Portal pakkeliste-parser", () => {
  it("læser den læsbare M2-tabel med rigtige rumnavne", () => {
    const rows = parseOperationalPackingListText(`
      Slagelse Brand og Redning
      Station Slagelse
      Pakningsliste for Automobilsprøjte
      M2
      Dato: april, 2024
      Side 1
      Førerhus
      Antal Benævnelse
      2 Røgdykkerlygter
      1 Røgdykker apparat m. maske (HL)
      3 Håndterminaler
      Førerhus - handskerum
      Antal Benævnelse
      1 Elektronisk nøgle
      Højre side midterste rum
      Antal Benævnelse
      1 HT-Slange (På rulle)
      2 D-Angrebstasker m. Agon-rør
    `);

    expect(rows).toEqual(expect.arrayContaining([
      expect.objectContaining({ placeName: "Førerhus", itemName: "Røgdykkerlygter", quantity: 2 }),
      expect.objectContaining({ placeName: "Førerhus - handskerum", itemName: "Elektronisk nøgle", quantity: 1 }),
      expect.objectContaining({ placeName: "Højre side midterste rum", itemName: "HT-Slange (På rulle)", quantity: 1 }),
      expect.objectContaining({ placeName: "Højre side midterste rum", itemName: "D-Angrebstasker m. Agon-rør", quantity: 2 })
    ]));
    expect(rows.some((row) => row.itemName === "Slagelse Brand og Redning")).toBe(false);
    expect(rows.some((row) => row.itemName === "M2")).toBe(false);
  });

  it("læser den programvenlige M2-PDF uden tabeloverskrifter", () => {
    const rows = parseOperationalPackingListText(`
      Førerhus
      2 Røgdykkerlygter
      1 Termisk kamera
      Mandskabskabine (Venstre side)
      1 Brandtæppe
      Hylde system (Øverst)
      1 Kasse m:; 6 X trafikveste
      Højre side forreste rum (Øverst/midten)
      9 Røgdykkerflasker
      2 CAFS-spyd (Defensiv/offensiv)
      Pumpehuset
      1 Brandhanenøgle
      Venstreside bagerste rum (Nederst)
      2 B/C slangenøgler
    `);

    expect(rows).toEqual(expect.arrayContaining([
      expect.objectContaining({ placeName: "Førerhus", itemName: "Røgdykkerlygter", quantity: 2 }),
      expect.objectContaining({ placeName: "Mandskabskabine (Venstre side)", itemName: "Brandtæppe", quantity: 1 }),
      expect.objectContaining({ placeName: "Højre side forreste rum (Øverst/midten)", itemName: "Røgdykkerflasker", quantity: 9 }),
      expect.objectContaining({ placeName: "Pumpehuset", itemName: "Brandhanenøgle", quantity: 1 }),
      expect.objectContaining({ placeName: "Venstreside bagerste rum (Nederst)", itemName: "B/C slangenøgler", quantity: 2 })
    ]));
  });

  it("samler gentagne identiske poster og markerer X-antal til kontrol", () => {
    const rows = parseOperationalPackingListText(`
      Faldsikringsudstyr (Tasken)
      1 Taske m. faldsikring
      1 Taske m. faldsikring
      Førstehjælpstaske (lille)
      X Bandager, plastre, sårrens
    `);

    expect(rows).toEqual(expect.arrayContaining([
      expect.objectContaining({ placeName: "Faldsikringsudstyr (Tasken)", itemName: "Taske m. faldsikring", quantity: 2 }),
      expect.objectContaining({ placeName: "Førstehjælpstaske (lille)", itemName: "Bandager, plastre, sårrens", quantity: 1, confidence: 0.72 })
    ]));
  });

  it("bevarer H1/V1 som rumkoder", () => {
    const rows = parseOperationalPackingListText(`
      H1
      2 x Højtryksslange (HT)
      V1
      1 Brandhanenøgle
    `);
    expect(rows).toEqual(expect.arrayContaining([
      expect.objectContaining({ placeName: "H1", itemName: "Højtryksslange (HT)", quantity: 2 }),
      expect.objectContaining({ placeName: "V1", itemName: "Brandhanenøgle", quantity: 1 })
    ]));
  });
});
