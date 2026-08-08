import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("Operativ køretøjsredigering", () => {
  it("sender interaktiv redigering til det samlede administrationsværktøj", () => {
    const source = read("src/app/admin/operativ-portal/koeretoejer/[vehicleId]/page.tsx");
    expect(source).not.toContain("OperationalHotspotEditor");
    expect(source).not.toContain("setOperationalInteractiveImageAction");
    expect(source).toContain("/administration");
    expect(source).toContain("Front, Højre, Bagende, Venstre og Tag");
  });

  it("bruger AppIcon frem for gamle tekstsymboler på køretøjssiden", () => {
    const source = read("src/app/admin/operativ-portal/koeretoejer/[vehicleId]/page.tsx");
    expect(source).toContain("AppIconName");
    expect(source).not.toContain('icon="▣"');
    expect(source).not.toContain('icon="◒"');
    expect(source).not.toContain('icon="♙"');
    expect(source).not.toContain("Åbn fuld interaktiv visning ›");
  });

  it("har professionelle kalender- og brændstofikoner til køretøjsmetadata", () => {
    const source = read("src/components/AppIcon.tsx");
    expect(source).toContain('| "calendar"');
    expect(source).toContain('| "fuel"');
  });
});
