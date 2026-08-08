import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("SBR Fire App review pass 8", () => {
  it("springer notifikationsoptælling over for administrator", () => {
    const source = read("src/components/TopBar.tsx");
    expect(source).toContain('user && user.role !== "ADMIN"');
  });

  it("bruger fælles professionelle ikoner på admin-genveje", () => {
    const source = read("src/app/admin/page.tsx");
    for (const icon of ["activity", "chart", "archive", "users", "database", "mail", "truck", "chevronRight"]) {
      expect(source).toContain(`\"${icon}\"`);
    }
    expect(source).toContain("AppIconName");
  });
});
