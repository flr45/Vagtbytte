import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("Operativ billed- og plusstyring", () => {
  it("lader køretøjsbilleder kategoriseres som front, sider, bagende eller tag ved upload", () => {
    const source = read("src/components/OperationalImageUploadForm.tsx");
    expect(source).toContain('name="viewKey"');
    expect(source).toContain("OPERATIONAL_VIEW_KEYS.map");
    expect(source).toContain("setOperationalVehicleViewAction");
    expect(source).toContain("Placering / visning");
  });

  it("gør billedsletning og valg af interaktivt billede synligt i galleriet", () => {
    const manager = read("src/components/OperationalImageManager.tsx");
    const selector = read("src/components/OperationalVehicleImageUseButton.tsx");
    expect(manager).toContain("Slet billede");
    expect(manager).toContain("OperationalVehicleImageUseButton");
    expect(selector).toContain("setOperationalInteractiveImageAction");
    expect(selector).toContain("window.location.reload()");
  });

  it("lader et eksisterende plus vælges direkte på billedet og slettes", () => {
    const source = read("src/components/OperationalHotspotEditor.tsx");
    expect(source).toContain("selectedHotspotId");
    expect(source).toContain("Tryk på et eksisterende plus for at vælge eller slette det");
    expect(source).toContain("Slet plus");
    expect(source).toContain("deleteOperationalHotspotAction");
  });
});
