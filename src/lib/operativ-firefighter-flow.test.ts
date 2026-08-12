import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("Operativ Portal brandmandsflow", () => {
  it("viser direkte sidevalg, sikre touchflader og entydige venstre/højre pile", () => {
    const viewer = read("src/components/OperationalVehicleInteractiveViewer.tsx");
    expect(viewer).toContain('aria-label="Vælg side af køretøjet"');
    expect(viewer).toContain("operativ-hotspot-hit");
    expect(viewer).toContain("operativ-hotspot-mark");
    expect(viewer).toContain('"--hotspot-size"');
    expect(viewer).toContain('aria-label="Vis venstre side af køretøjet"');
    expect(viewer).toContain('onClick={() => goGround("left")}');
    expect(viewer).toContain('aria-label="Vis højre side af køretøjet"');
    expect(viewer).toContain('onClick={() => goGround("right")}');
    expect(viewer).not.toContain("function rotate(");
    expect(viewer).not.toContain(">‹<");
    expect(viewer).not.toContain(">›<");
  });

  it("åbner køretøjets hovedvisning på højre side og bruger kompakte mobilplus", () => {
    const viewer = read("src/components/OperationalVehicleViewer.tsx");
    expect(viewer).toContain('configuredViews.find((view) => view.viewKey === "right")');
    expect(viewer).toContain("operativ-hotspot-hit");
    expect(viewer).toContain("operativ-hotspot-mark");
    expect(viewer).toContain('aria-label="Vis venstre side af køretøjet"');
    expect(viewer).toContain('onClick={() => setActiveKey("left")}');
    expect(viewer).toContain('aria-label="Vis højre side af køretøjet"');
    expect(viewer).toContain('onClick={() => setActiveKey("right")}');
    expect(viewer).not.toContain("function move(");
    expect(viewer).not.toContain('aria-label="Næste side af køretøjet"');
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
    expect(room).toContain("operativ-hotspot-hit");
    expect(item).toContain("safeOperationalReturnTo");
    expect(item).toContain("requestedReturnTo");
    expect(item).toContain("sourceNode");
  });

  it("viser udstyrsnavn stort og giver admin direkte video- og dokumenthandlinger", () => {
    const item = read("src/app/admin/operativ-portal/udstyr/[itemId]/page.tsx");
    expect(item).toContain('text-3xl font-black leading-tight text-white sm:text-4xl');
    expect(item).toContain("videoAdminHref");
    expect(item).toContain("documentAdminHref");
    expect(item).toContain("Tilføj video");
    expect(item).toContain("Tilføj dokument");
  });

  it("bevarer søgningen når udstyr åbnes fra søgeresultater", () => {
    const search = read("src/app/admin/operativ-portal/soeg/page.tsx");
    expect(search).toContain("searchReturnHref");
    expect(search).toContain("returnTo=${encodeURIComponent(searchReturnHref)}");
    expect(search).toContain('aria-label="Søg"');
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
