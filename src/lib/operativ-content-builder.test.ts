import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("Operativ Portal v0.12 indholdsbygger", () => {
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

  it("har direkte flytning og fortryd i både rum- og køretøjseditor", () => {
    const builder = read("src/components/OperationalContentBuilder.tsx");
    const vehicleManager = read("src/components/OperationalVehicleViewManager.tsx");
    expect(builder).toContain("Fortryd flytning");
    expect(builder).toContain("Fortryd sletning");
    expect(builder).toContain("editTargetType");
    expect(vehicleManager).toContain("moveOperationalVehicleViewHotspotAction");
    expect(vehicleManager).toContain("Fortryd flytning");
  });
});
