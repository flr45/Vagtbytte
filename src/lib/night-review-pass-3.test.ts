import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("SBR Fire App professionel ikonpolish", () => {
  it("bruger SVG-statusikoner i brandmandens vagttildeling", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "src", "app", "brandmand", "page.tsx"), "utf8");

    expect(source).toContain('name={currentAssignment.acknowledgedAt ? "checkCircle" : "clock"}');
    expect(source).not.toContain("● Bekræftet");
    expect(source).not.toContain("● Afventer bekræftelse");
  });

  it("har genbrugelige ikoner til de resterende administrationsflader", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "src", "components", "AppIcon.tsx"), "utf8");

    for (const icon of ["activity", "chart", "archive", "users", "database", "mail", "warning", "checkCircle", "clock"]) {
      expect(source).toContain(`| "${icon}"`);
    }
  });
});
