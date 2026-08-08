import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("operativ vehicle view isolation", () => {
  it("renders the vehicle landing page from view-specific data", () => {
    const source = read("src/app/admin/operativ-portal/koeretoejer/[vehicleId]/page.tsx");
    expect(source).toContain("OperationalVehicleViewer");
    expect(source).toContain("listOperationalVehicleViews");
    expect(source).toContain("listOperationalVehicleViewHotspots");
    expect(source).not.toContain("listVehicleInteractiveHotspots");
  });

  it("filters visible pluspoints by the active vehicle view", () => {
    const source = read("src/components/OperationalVehicleViewer.tsx");
    expect(source).toContain("hotspot.viewKey === activeView?.viewKey");
    expect(source).toContain("configuredViews");
    expect(source).toContain('role="tablist"');
  });

  it("maps legacy vehicle hotspots to front instead of every view", () => {
    const source = read("src/lib/operativ-vehicle-views.ts");
    expect(source).toContain("COALESCE(h.view_key, 'front') AS \"viewKey\"");
  });

  it("presents vehicle administration as two explicit steps", () => {
    const source = read("src/app/admin/operativ-portal/koeretoejer/[vehicleId]/administration/page.tsx");
    expect(source).toContain("1. Billeder og pluspunkter");
    expect(source).toContain("2. Rum og udstyr");
    expect(source).toContain('id="billeder-plus"');
    expect(source).toContain('id="rum-udstyr"');
  });
});
