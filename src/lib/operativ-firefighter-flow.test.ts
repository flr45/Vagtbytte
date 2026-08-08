import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("Operativ Portal brandmandsflow", () => {
  it("viser direkte sidevalg på køretøjet og store touchflader", () => {
    const viewer = read("src/components/OperationalVehicleInteractiveViewer.tsx");
    expect(viewer).toContain('aria-label="Vælg side af køretøjet"');
    expect(viewer).toContain("Math.max(48, hotspot.sizePx)");
    expect(viewer).toContain('name="back"');
    expect(viewer).toContain('name="chevronRight"');
    expect(viewer).not.toContain(">‹<");
    expect(viewer).not.toContain(">›<");
  });

  it("holder den fulde rumliste som fallback i stedet for primært flow", () => {
    const page = read("src/app/admin/operativ-portal/koeretoejer/[vehicleId]/interaktiv/page.tsx");
    expect(page).toContain("Kan du ikke finde rummet? Vis alle rum som liste");
    expect(page).toContain("<details");
    expect(page).toContain('loading="lazy"');
  });

  it("bevarer synlig placering og retursti gennem underområder", () => {
    const room = read("src/app/admin/operativ-portal/rum/[placeId]/interaktiv/page.tsx");
    const item = read("src/app/admin/operativ-portal/udstyr/[itemId]/page.tsx");
    expect(room).toContain('aria-label="Din placering"');
    expect(room).toContain("sourceNode=");
    expect(room).toContain("Math.max(48, hotspot.sizePx)");
    expect(item).toContain("sourceNode");
    expect(item).toContain('/interaktiv${sourceNode ?');
  });

  it("henter kun indhold for det valgte udstyr", () => {
    const itemPage = read("src/app/admin/operativ-portal/udstyr/[itemId]/page.tsx");
    const itemContent = read("src/lib/operativ-item-content.ts");
    expect(itemPage).toContain("listOperationalItemDocuments(itemId)");
    expect(itemPage).toContain("listOperationalItemVideos(itemId)");
    expect(itemPage).not.toContain("listManagedOperationalDocuments");
    expect(itemPage).not.toContain("listManagedOperationalVideos");
    expect(itemContent).toContain('WHERE item_id = ${itemId}');
  });
});
