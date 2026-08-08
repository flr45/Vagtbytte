import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("Operativ Portal brandmandsflow", () => {
  it("viser direkte sidevalg, store touchflader og entydige venstre/højre pile", () => {
    const viewer = read("src/components/OperationalVehicleInteractiveViewer.tsx");
    expect(viewer).toContain('aria-label="Vælg side af køretøjet"');
    expect(viewer).toContain("Math.max(48, hotspot.sizePx)");
    expect(viewer).toContain('aria-label="Vis venstre side af køretøjet"');
    expect(viewer).toContain('onClick={() => goGround("left")}');
    expect(viewer).toContain('aria-label="Vis højre side af køretøjet"');
    expect(viewer).toContain('onClick={() => goGround("right")}');
    expect(viewer).not.toContain("function rotate(");
    expect(viewer).not.toContain(">‹<");
    expect(viewer).not.toContain(">›<");
  });

  it("holder den fulde rumliste som fallback i stedet for primært flow", () => {
    const page = read("src/app/admin/operativ-portal/koeretoejer/[vehicleId]/interaktiv/page.tsx");
    expect(page).toContain("Kan du ikke finde rummet? Vis alle rum som liste");
    expect(page).toContain("<details");
    expect(page).toContain('loading="lazy"');
  });

  it("bevarer synlig placering og præcis retursti gennem underområder", () => {
    const room = read("src/app/admin/operativ-portal/rum/[placeId]/interaktiv/page.tsx");
    const item = read("src/app/admin/operativ-portal/udstyr/[itemId]/page.tsx");
    expect(room).toContain('aria-label="Din placering"');
    expect(room).toContain("currentHref");
    expect(room).toContain("returnTo=");
    expect(room).toContain("Math.max(48, hotspot.sizePx)");
    expect(item).toContain("safeOperationalReturnTo");
    expect(item).toContain("requestedReturnTo");
    expect(item).toContain("sourceNode");
  });

  it("giver editoren en trinvis tilbagevej gennem underområder", () => {
    const builder = read("src/app/admin/operativ-portal/rum/[placeId]/byg/page.tsx");
    expect(builder).toContain("context.parentNodeId");
    expect(builder).toContain("encodeURIComponent(context.parentNodeId)");
    expect(builder).toContain("backHref={backHref}");
  });

  it("henter kun indhold for det valgte rum og udstyr", () => {
    const placePage = read("src/app/admin/operativ-portal/rum/[placeId]/page.tsx");
    const placeContent = read("src/lib/operativ-place-content.ts");
    const itemPage = read("src/app/admin/operativ-portal/udstyr/[itemId]/page.tsx");
    const itemContent = read("src/lib/operativ-item-content.ts");

    expect(placePage).toContain("listOperationalPlaceDocuments(placeId)");
    expect(placePage).toContain("listOperationalPlaceVideos(placeId)");
    expect(placePage).not.toContain("listManagedOperationalDocuments");
    expect(placePage).not.toContain("listManagedOperationalVideos");
    expect(placeContent).toContain('WHERE d.place_id = ${placeId}');
    expect(placeContent).toContain('WHERE video.place_id = ${placeId}');

    expect(itemPage).toContain("listOperationalItemDocuments(itemId)");
    expect(itemPage).toContain("listOperationalItemVideos(itemId)");
    expect(itemPage).not.toContain("listManagedOperationalDocuments");
    expect(itemPage).not.toContain("listManagedOperationalVideos");
    expect(itemContent).toContain('WHERE item_id = ${itemId}');
  });
});
