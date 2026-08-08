import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("Operativ Portal interaktiv indholdsbygger", () => {
  it("opretter et rekursivt node/link-hierarki og migrerer gamle rum-hotspots", () => {
    const migration = read("prisma/migrations/20260807201000_operational_interactive_hierarchy/migration.sql");
    expect(migration).toContain('CREATE TABLE "operational_interactive_node"');
    expect(migration).toContain('"parent_node_id" TEXT');
    expect(migration).toContain('CREATE TABLE "operational_interactive_link"');
    expect(migration).toContain('"size_px" INTEGER NOT NULL DEFAULT 40');
    expect(migration).toContain('FROM "operational_place_hotspot" h');
    expect(migration).toContain('ON CONFLICT ("id") DO NOTHING');
  });

  it("bevarer offline-adgang til køretøjsvisninger og hierarkiske underområder", () => {
    const offlineRoute = read("src/app/api/admin/operativ-portal/offline-index/route.ts");
    expect(offlineRoute).toContain("FROM operational_vehicle_view");
    expect(offlineRoute).toContain("FROM operational_interactive_node");
    expect(offlineRoute).toContain("/interaktiv?node=");
    expect(offlineRoute).toContain("version: 2");
  });

  it("rydder gamle interaktive værktøjslinks når udstyr flyttes mellem rum", () => {
    const adminActions = read("src/lib/operativ-admin-actions.ts");
    expect(adminActions).toContain("DELETE FROM operational_place_hotspot WHERE item_id");
    expect(adminActions).toContain("DELETE FROM operational_interactive_link WHERE item_id");
    expect(adminActions).toContain("/byg`");
  });

  it("har én eksplicit interaktionstilstand i rum-editoren", () => {
    const builder = read("src/components/OperationalContentBuilder.tsx");
    const page = read("src/app/admin/operativ-portal/rum/[placeId]/byg/page.tsx");
    expect(builder).toContain("type Interaction =");
    expect(builder).toContain('{ kind: "placing" }');
    expect(builder).toContain("interaction.kind !== \"placing\"");
    expect(builder).toContain("Placér nyt +");
    expect(builder).toContain("onPointerCancel={cancelDrag}");
    expect(builder).toContain("context.nodeSortOrder");
    expect(builder).toContain("Fortryd");
    expect(page).toContain('import { OperationalContentBuilder }');
    expect(page).not.toContain("OperationalContentBuilderGuard");
  });

  it("samler editoren i tydelige arbejdsområder", () => {
    const builder = read("src/components/OperationalContentBuilder.tsx");
    expect(builder).toContain('type Workspace = "hotspots" | "image" | "children" | "settings"');
    expect(builder).toContain('aria-label="Redigeringsområder"');
    expect(builder).toContain('label: "Pluspunkter"');
    expect(builder).toContain('label: "Billede"');
    expect(builder).toContain('label: "Underområder"');
    expect(builder).toContain('label: "Indstillinger"');
  });

  it("kan starte placering af et plus direkte fra underområde-arbejdsområdet", () => {
    const builder = read("src/components/OperationalContentBuilder.tsx");
    expect(builder).toContain("function openHotspotPlacement()");
    expect(builder).toContain('setWorkspace("hotspots")');
    expect(builder).toContain('scrollIntoView({ behavior: "smooth", block: "center" })');
    expect(builder).toContain("onClick={openHotspotPlacement}");
    expect(builder).toContain("Tilføj +");
  });

  it("undgår fulde browser-reloads ved normal redigering", () => {
    const builder = read("src/components/OperationalContentBuilder.tsx");
    const capture = read("src/components/OperationalQuickImageCapture.tsx");
    expect(builder).not.toContain("window.location.reload");
    expect(builder).not.toContain("window.location.assign");
    expect(builder).toContain("router.refresh()");
    expect(builder).toContain("router.push(");
    expect(capture).not.toContain("window.location.reload");
    expect(capture).not.toContain("window.location.assign");
    expect(capture).toContain("MAX_IMAGE_EDGE = 2048");
  });

  it("cachelagrer beskyttede billeder kortvarigt uden at gøre cachen offentlig", () => {
    const route = read("src/app/api/admin/operativ-portal/billeder/[imageId]/route.ts");
    expect(route).toContain('private, max-age=300, must-revalidate');
    expect(route).toContain('request.headers.get("if-none-match")');
    expect(route).toContain("ETag: etag");
    expect(route).not.toContain('"Cache-Control": "private, no-store"');
  });

  it("gemmer nyt underområde og dets pluspunkt atomisk og afviser falsk succes", () => {
    const actions = read("src/lib/operativ-content-builder-actions.ts");
    expect(actions).toContain("prisma.$transaction([");
    expect(actions).toContain("createdNode !== 1 || createdLink !== 1");
    expect(actions).toContain("updated !== 1");
    expect(actions).toContain("Underområdet og pluspunktet kunne ikke oprettes samlet");
  });

  it("kræver eget billede på underområder og bevarer deres rigtige rækkefølge", () => {
    const data = read("src/lib/operativ-content-builder.ts");
    const builder = read("src/components/OperationalContentBuilder.tsx");
    expect(data).toContain("nodeSortOrder: node?.sortOrder ?? 0");
    expect(data).toContain("imageId: node ? node.imageId : place.rootImageId");
    expect(builder).toContain("defaultValue={context.nodeSortOrder}");
    expect(builder).not.toContain('defaultValue="0" min="0" name="sortOrder"');
  });

  it("bevarer direkte flytning i køretøjseditoren", () => {
    const vehicleManager = read("src/components/OperationalVehicleViewManager.tsx");
    expect(vehicleManager).toContain("moveOperationalVehicleViewHotspotAction");
    expect(vehicleManager).toContain("Fortryd flytning");
  });
});
