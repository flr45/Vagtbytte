import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("SBR Fire App icon polish pass 5", () => {
  it("bruger det fælles ikonlag i TopBar uden emoji eller tekstprikker", () => {
    const source = read("src/components/TopBar.tsx");
    expect(source).toContain('name="alarm"');
    expect(source).toContain('name="truck"');
    expect(source).toContain('name="more"');
    expect(source).not.toContain("🚨");
    expect(source).not.toContain("🚒");
    expect(source).not.toContain(">•••<");
  });

  it("bruger professionelle ikoner i den guidede fototur", () => {
    const source = read("src/app/admin/operativ-portal/koeretoejer/[vehicleId]/foto/page.tsx");
    expect(source).toContain('name="camera"');
    expect(source).toContain('name="checkCircle"');
    expect(source).toContain('name="chevronRight"');
    expect(source).not.toContain("📷");
    expect(source).not.toContain(">✓<");
    expect(source).not.toContain(">›<");
  });

  it("bruger professionelle ikoner i køretøjsadministrationen", () => {
    const source = read("src/app/admin/operativ-portal/koeretoejer/[vehicleId]/administration/page.tsx");
    expect(source).toContain('name="settings"');
    expect(source).toContain('name="camera"');
    expect(source).not.toContain("⚙");
    expect(source).not.toContain("📷");
  });
});
